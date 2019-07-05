/* -------------------------------------------------------------------------- */
/*                                   Modules                                  */
/* -------------------------------------------------------------------------- */

//builtin
const path = require('path');
const fs = require('fs');

//request
const request = require('request');

//ui
const inquirer = require('inquirer');
const fuzzy = require('fuzzy');
const program = require('commander');

// ini
const ini = require('ini');

//moment
const moment = require('moment');

//reading version number from package.json
var pjson = require('./package.json');

/* -------------------------------------------------------------------------- */
/*                                  Functions                                 */
/* -------------------------------------------------------------------------- */

/**
 * Calls the kimai API
 * 
 * @param {string} httpMethod Http method: 'GET', 'POST', 'PATCH'...
 * @param {string} kimaiMethod Endpoint to call on the kimai API: timesheet, activities, timesheets/123/stop
 * @param {object} serversettings Serversettings section read from ini. Only serversettings, not the full settings!
 * @param {object} options All of them are optional: 
 * options.qs querystring
 * options.reqbody request body
 * options.verbose Verbose
 * @returns {object} The redponse body as an object
 * 
 */
function callKimaiApi(httpMethod, kimaiMethod, serversettings, options = false) {
    //default options to false:
    const qs = options.qs || false
    const reqbody = options.reqbody || false
    const verbose = options.verbose || false

    if (verbose) {
        console.log("calling kimai:", httpMethod, kimaiMethod, serversettings)
    }

    return new Promise((resolve, reject) => {
        const options = {
            url: sanitizeServerUrl(serversettings.kimaiurl) + '/api/' + kimaiMethod,
            headers: {
                'X-AUTH-USER': serversettings.username,
                'X-AUTH-TOKEN': serversettings.password,
            },
            method: httpMethod
        }

        if (qs) {
            options.qs = qs
        }
        if (reqbody) {
            options.body = JSON.stringify(reqbody)
            options.headers['Content-Type'] = 'application/json'
        }

        if (verbose) {
            console.log("request options:", options)
        }

        request(options, (error, response, body) => {
            if (error) {
                reject(error)
            }

            let jsonarr = JSON.parse(response.body)

            if (verbose) {
                console.log("Response body:", jsonarr)
            }

            if (jsonarr.message) {
                console.log('Server error message:')
                console.log(jsonarr.code)
                console.log(jsonarr.message)
                reject(jsonarr.message)
            }

            resolve(jsonarr)
        })
    })
}

/**
 * Interactive ui: displays the main menu
 * 
 * @param {object} settings The full settings object read from the ini
 * @param {boolean} verbose 
 */
function uiMainMenu(settings, verbose = false) {
    inquirer
        .prompt([
            {
                type: 'list',
                name: 'mainmenu',
                message: 'Select command',
                pageSize: process.stdout.rows - 1,
                choices:
                    [
                        { name: 'Restart recent measurement', value: 'restart' },
                        { name: 'Start new measurement', value: 'start' },
                        { name: 'Stop all active measurements', value: 'stop-all' },
                        { name: 'Stop an active measurement', value: 'stop' },
                        new inquirer.Separator(),
                        { name: 'List active measurements', value: 'list-active' },
                        { name: 'List recent measurements', value: 'list-recent' },
                        { name: 'List projects', value: 'list-projects' },
                        { name: 'List activities', value: 'list-activities' },
                        new inquirer.Separator(),
                        { name: 'Exit', value: 'exit' }
                    ]
            }
        ])
        .then(answers => {
            if (verbose) {
                console.log('selected answer: ' + answers.mainmenu)
            }
            switch (answers.mainmenu) {
                case 'restart':
                    kimaiList(settings, 'timesheets/recent', false)
                        .then(res => {
                            return uiSelectMeasurement(res[1])
                        }).then(startId => {
                            return kimaiRestart(settings, startId)
                        })
                        .then(res => uiMainMenu(res[0]))
                    break;
                case 'start':
                    uiKimaiStart(settings, verbose)
                        .then(_ => uiMainMenu(settings))
                    break;
                case 'stop-all':
                    kimaiStop(settings, false)
                        .then(_ => uiMainMenu(settings))
                    break;
                case 'stop':
                    kimaiList(settings, 'timesheets/active', false)
                        .then(res => {
                            return uiSelectMeasurement(res[1])
                        }).then(stopId => {
                            return kimaiStop(settings, stopId)
                        })
                        .then(res => uiMainMenu(res[0]))
                    break;

                case 'list-active':
                    kimaiList(settings, 'timesheets/active', true, { verbose: verbose })
                        .then(res => uiMainMenu(res[0], verbose))
                    break;
                case 'list-recent':
                    kimaiList(settings, 'timesheets/recent', true, { verbose: verbose })
                        .then(res => uiMainMenu(res[0], verbose))
                    break;
                case 'list-projects':
                    kimaiList(settings, 'projects', true, { verbose: verbose })
                        .then(res => uiMainMenu(res[0], verbose))
                    break;
                case 'list-activities':
                    kimaiList(settings, 'activities', true, { verbose: verbose })
                        .then(res => uiMainMenu(res[0], verbose))
                    break;
                default:
                    break;
            }
        })
}

/**
 * Restarts a measurement
 * 
 * @param {object} settings All settings read from ini
 * @param {string} id The id of the measurement to restart
 * 
 */
function kimaiRestart(settings, id) {
    return new Promise((resolve, reject) => {
        callKimaiApi('PATCH', 'timesheets/' + id + '/restart', settings.serversettings)
            .then(res => {
                resolve([settings, res])
            })
    })
}

/**
 * Interactive ui: select a project and activity and starts it
 * 
 * @param {object} settings All settings read from ini
 */
function uiKimaiStart(settings, verbose = false) {
    return new Promise((resolve, reject) => {
        const selected = {}
        kimaiList(settings, 'projects', false)
            .then(res => {
                // console.log(res[1])
                return uiAutocompleteSelect(res[1], 'Select project')
            })
            .then(res => {
                // console.log(res)
                selected.projectId = res.id
                return kimaiList(settings, 'activities', false, { filter: { project: res.id } })
            })
            .then(res => {
                return uiAutocompleteSelect(res[1], 'Select activity')
            })
            .then(res => {
                selected.activityId = res.id

                let body = {
                    begin: moment().format(),
                    project: selected.projectId,
                    activity: selected.activityId
                }
                if (verbose) {
                    console.log("kimaistart calling api:", body)
                }

                return callKimaiApi('POST', 'timesheets', settings.serversettings, { reqbody: body, verbose: verbose })
            })
            .then(res => {
                console.log('Started: ' + res.id)
                resolve()
            })
    })
}

/**
 * Stops one or all current measurements. If id is empty it stops all, if given only selected
 * 
 * @param {object} settings 
 * @param {string} id 
 */
function kimaiStop(settings, id = false) {
    return new Promise((resolve, reject) => {
        if (id) {
            callKimaiApi('PATCH', 'timesheets/' + id + '/stop', settings.serversettings)
                .then(res => {
                    resolve([settings, res])
                })
        } else {
            kimaiList(settings, 'timesheets/active', false)
                .then(res => {
                    const jsonList = res[1]
                    // return callKimaiStop(settings, jsonList)
                    callKimaiStop(settings, jsonList)
                })
            // .then(_ => {
            //     resolve()
            // })
        }
    })
}

function callKimaiStop(settings, jsonList, i = 0) {
    // return new Promise((resolve, reject) => {
    const element = jsonList[i];
    callKimaiApi('PATCH', 'timesheets/' + element.id + '/stop', settings.serversettings)
        .then(jsl => {
            console.log('Stopped: ', jsl.id)
            i++
            if (i < jsonList.length) {
                callKimaiStop(settings, jsonList, i)
            } else {
                // resolve()
                uiMainMenu(settings)
            }
        })
    // })
}

/**
 * Calls the api, lists and returns elements
 * 
 * @param {object} settings The full settings object read from the ini
 * @param {string} endpoint The endpoint to call in the api.
 * @param {boolean} print If true, it prints to the terminal
 * @param {object} options Options: 
 * options.filter: filter the query,
 * options.verbose 
 * @returns {array} res[0]: settings, res[1]: list of elements
 */
function kimaiList(settings, endpoint, print = false, options = false) {
    const filter = options.filter || false
    const verbose = options.verbose || false
    return new Promise((resolve, reject) => {
        callKimaiApi('GET', endpoint, settings.serversettings, { qs: filter })
            .then(jsonList => {
                if (print) {
                    printList(jsonList, endpoint, verbose)
                }
                resolve([settings, jsonList])
            })
            .catch(msg => {
                console.log("Error: " + msg)
            })
    })
}

/**
 * Interactive ui: select measurement from a list of measurements
 * @param {} thelist 
 */
function uiSelectMeasurement(thelist) {
    return new Promise((resolve, reject) => {
        const choices = []
        for (let i = 0; i < thelist.length; i++) {
            const element = thelist[i];
            choices.push({
                name: element.project.name + " | " + element.activity.name, value: element.id
            })
        }
        inquirer
            .prompt([
                {
                    type: 'list',
                    name: 'selectMeasurement',
                    message: 'Select measurement',
                    pageSize: process.stdout.rows - 1,
                    choices: choices
                }
            ]).then(answers => {
                resolve(answers.selectMeasurement)
            })
    })
}

/**
 * Returns a prompt with autocomplete
 * 
 * @param {array} thelist The list of elements to select from
 * @param {string} message Prompt message
 */
function uiAutocompleteSelect(thelist, message) {

    return new Promise((resolve, reject) => {
        const choices = []
        const names = []
        for (let i = 0; i < thelist.length; i++) {
            const element = thelist[i];
            choices.push({
                name: element.name, id: element.id
            })
            names.push(element.name)
        }
        inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
        inquirer
            .prompt([
                {
                    type: 'autocomplete',
                    name: 'autoSelect',
                    message: message,
                    pageSize: process.stdout.rows - 2,
                    source: function (answers, input) {
                        input = input || '';
                        return new Promise((resolve, reject) => {
                            var fuzzyResult = fuzzy.filter(input, names);
                            resolve(
                                fuzzyResult.map(function (el) {
                                    return el.original;
                                })
                            )
                        })
                    }
                }
            ]).then(answers => {
                let ind = names.indexOf(answers.autoSelect)
                let selectedChoice = choices[ind]
                // console.log(selectedChoice)
                resolve(selectedChoice)
            })
    })
}




/**
 * Prints list to terminal
 * 
 * @param {array} arr Items to list
 * @param {string} endpoint for selecting display layout
 * @param {boolean} verbose
 */
function printList(arr, endpoint, verbose = false) {
    if (verbose) {
        console.log()
        if (arr.length > 1) {
            console.log(arr.length + ' results:')
        } else if (arr.length == 0) {
            console.log('No results')
        } else {
            console.log('One result:')
        }
    }
    for (let i = 0; i < arr.length; i++) {
        const element = arr[i];

        if (endpoint == 'projects' || endpoint == 'activities') {
            if (verbose) {
                console.log((i + 1) + ': ', element.name, '(id:' + element.id + ')')
            } else {
                console.log(element.name)
            }

        } else {
            if (verbose) {
                if (arr.length > 1) {
                    console.log((i + 1) + ":")
                }
                console.log('   Id: ' + element.id)
                console.log('   Project: ' + element.project.name, '(id:' + element.project.id + ')')
                console.log('   Customer: ' + element.project.customer.name, '(id:' + element.project.customer.id + ')')
                console.log('   Activity: ' + element.activity.name, '(id:' + element.activity.id + ')')
                console.log()
            } else {
                console.log(element.project.name, '|', element.activity.name)
            }

        }
    }
    console.log()
}

/**
 * Finds settings file path
 * 
 * @param {boolean} verbose
 * @returns string: Path to settings.ini
 * @returns false: If no settings found
 */
function iniPath(verbose) {
    //different settings.ini path for developement and pkg version
    const root = [
        path.dirname(process.execPath),
        __dirname
    ]
    const settingsPathPkg = path.join(root[0], '/settings.ini')
    const settingsPathNode = path.join(root[1], '/settings.ini')
    if (verbose) {
        console.log('Looking for settings.ini in the following places:')
        console.log(settingsPathPkg)
        console.log(settingsPathNode)
    }
    if (fs.existsSync(settingsPathPkg)) {
        return settingsPathPkg
    } else if (fs.existsSync(settingsPathNode)) {
        return settingsPathNode
    } else {

        return false
    }
}

/**
 * Checks if settings file exists, if not it's asks for settings
 * 
 * @param {boolean} verbose 
 * @return {object} settings: all settings read from the settings file
 */
function checkSettings(verbose = false) {
    return new Promise((resolve, reject) => {
        const settingsPath = iniPath(verbose)
        if (verbose) console.log("found at: ", settingsPath)
        if (settingsPath) {
            let settings = ini.parse(fs.readFileSync(settingsPath, 'utf-8'))
            resolve(settings)
        } else {
            console.log('Settings.ini not found')
            uiAskForSettings()
                .then(settings => {
                    resolve(settings)
                })

        }
    })
}

/**
 * Interactive ui: asks for settings than saves them
 */
function uiAskForSettings() {
    return new Promise((resolve, reject) => {
        let questions = [
            {
                type: 'input',
                name: 'kimaiurl',
                message: "Kimai2 url:"
            },
            {
                type: 'input',
                name: 'username',
                message: "Username:"
            },
            {
                type: 'input',
                name: 'password',
                message: "API password:"
            }
        ]

        inquirer
            .prompt(questions)
            .then(answers => {
                let settings = {}
                settings.serversettings = answers
                fs.writeFileSync('./settings.ini', ini.stringify(settings))
                console.log('settings saved to ' + iniPath())
                resolve(settings)
            });
    })
}


/**
 * Removes trailing slashes from url
 * 
 * @param {string} kimaiurl Url to sanitize
 */
function sanitizeServerUrl(kimaiurl) {
    return kimaiurl.replace(/\/+$/, "");
}

/* -------------------------------------------------------------------------- */
/*                                  Commander                                 */
/* -------------------------------------------------------------------------- */

program
    .version(pjson.version)
    .description(pjson.description + '. For interactive mode start without any commands. To generate settings file start in interactive mode!')
    .option('-v, --verbose', 'verbose, longer logging')
// .option('-r, --rainmeter', 'generate rainmeter files')
// .option('-a, --argos', 'argos/bitbar output')

program.command('start [project] [activity]')
    .description('start selected project and activity.')
    .action(function (project, activity) {
        // console.log("starting: " + project + ", " + activity + " ");
        //do something
        console.log('not implemented yet, sorry!')
    })

program.command('stop')
    .description('stop all measurements')
    .action(function () {
        //do something
        console.log('not implemented yet, sorry!')
    })

program.command('list-recent')
    .description('list recent measurements')
    .action(function () {
        checkSettings()
            .then(settings => {
                kimaiList(settings, 'timesheets/recent', true, { verbose: program.verbose })
            })
    })

program.command('list-projects')
    .description('list all projects')
    .action(function () {
        checkSettings()
            .then(settings => {
                kimaiList(settings, 'projects', true, { verbose: program.verbose })
            })
    })

program.command('list-activities')
    .description('list all activities')
    .action(function () {
        checkSettings()
            .then(settings => {
                kimaiList(settings, 'activities', true, { verbose: program.verbose })
            })
    })

program.command('debug')
    .description('debug snapshot filesystem. If you see this you are using a developement build')
    .action(function () {
        fs.readdir(__dirname, (err, files) => { console.log(files) })
    })

program.parse(process.argv);


//interactive mode if no option added
if (!program.args.length) {
    checkSettings(program.verbose)
        .then(settings => {
            uiMainMenu(settings, program.verbose)
        })
}
