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

/* -------------------------------------------------------------------------- */
/*                                  Functions                                 */
/* -------------------------------------------------------------------------- */

function callKimaiApi(httpMethod, kimaimethod, serversettings, qs = false, reqbody = false) {
    //console.log("calling kimai:", httpMethod, kimaimethod, serversettings)
    return new Promise((resolve, reject) => {
        const options = {
            url: sanitizeServerUrl(serversettings.kimaiurl) + '/api/' + kimaimethod,
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

        // console.log("op: ", options)
        request(options, (error, response, body) => {
            if (error) {
                reject(error)
            }

            let jsonarr = JSON.parse(response.body)
            if (jsonarr.message) {
                reject(jsonarr.message)
            }
            // console.log(jsonarr)
            resolve(jsonarr)
        })

    })
}


function mainMenu(settings) {
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
            // console.log(answers.mainmenu)
            switch (answers.mainmenu) {
                case 'restart':
                    kimaiList(settings, 'timesheets/recent', false)
                        .then(res => {
                            return selectMeasurement(res[1])
                        }).then(startId => {
                            return kimaiRestart(settings, startId)
                        })
                        .then(res => mainMenu(res[0]))
                    break;
                case 'start':
                    kimaiStart(settings)
                        .then(_ => mainMenu(settings))
                    break;
                case 'stop-all':
                    kimaiStop(settings, false)
                        .then(_ => mainMenu(settings))
                    break;
                case 'stop':
                    kimaiList(settings, 'timesheets/active', false)
                        .then(res => {
                            return selectMeasurement(res[1])
                        }).then(stopId => {
                            return kimaiStop(settings, stopId)
                        })
                        .then(res => mainMenu(res[0]))
                    break;

                case 'list-active':
                    kimaiList(settings, 'timesheets/active', true)
                        .then(res => mainMenu(res[0]))
                    break;
                case 'list-recent':
                    kimaiList(settings, 'timesheets/recent', true)
                        .then(res => mainMenu(res[0]))
                    break;
                case 'list-projects':
                    kimaiList(settings, 'projects', true)
                        .then(res => mainMenu(res[0]))
                    break;
                case 'list-activities':
                    kimaiList(settings, 'activities', true)
                        .then(res => mainMenu(res[0]))
                    break;
                default:
                    break;
            }
        })
}

function kimaiRestart(settings, id) {
    return new Promise((resolve, reject) => {
        callKimaiApi('PATCH', 'timesheets/' + id + '/restart', settings.serversettings)
            .then(res => {
                resolve([settings, res])
            })
    })
}

function kimaiStart(settings) {
    return new Promise((resolve, reject) => {
        const selected = {}
        kimaiList(settings, 'projects', false)
            .then(res => {
                // console.log(res[1])
                return autoSelect(res[1], 'Select project')
            })
            .then(res => {
                // console.log(res)
                selected.projectId = res.id
                return kimaiList(settings, 'activities', false, { project: res.id })
            })
            .then(res => {
                return autoSelect(res[1], 'Select activity')
            })
            .then(res => {
                selected.activityId = res.id

                let body = {
                    begin: moment().format(),
                    project: selected.projectId,
                    activity: selected.activityId

                }

                return callKimaiApi('POST', 'timesheets', settings.serversettings, false, body)
            })
            .then(res => {
                console.log('Started: ' + res.id)
                resolve()
            })
    })
}


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
                mainMenu(settings)
            }
        })
    // })
}

function kimaiList(settings, endpoint, print = false, filter = false) {
    return new Promise((resolve, reject) => {
        callKimaiApi('GET', endpoint, settings.serversettings, filter)
            .then(jsonList => {
                if (print) {
                    printList(jsonList, endpoint)
                }
                resolve([settings, jsonList])
            })
            .catch(msg => {
                console.log("Error: " + msg)
            })
    })
}

function selectMeasurement(thelist) {
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

function autoSelect(thelist, message) {

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




//prints lists to terminal:
function printList(arr, endpoint) {
    console.log()
    if (arr.length > 1) {
        console.log(arr.length + ' results:')
    } else if (arr.length == 0) {
        console.log('No results')
    } else {
        console.log('One result:')
    }
    for (let i = 0; i < arr.length; i++) {
        const element = arr[i];

        if (endpoint == 'projects' || endpoint == 'activities') {
            console.log((i + 1) + ': ', element.name, '(id:' + element.id + ')')
        } else {
            if (arr.length > 1) {
                console.log((i + 1) + ":")
            }
            console.log('   Id: ' + element.id)
            console.log('   Project: ' + element.project.name, '(id:' + element.project.id + ')')
            console.log('   Customer: ' + element.project.customer.name, '(id:' + element.project.customer.id + ')')
            console.log('   Activity: ' + element.activity.name, '(id:' + element.activity.id + ')')
            console.log()
        }
    }
    console.log()
}


function iniPath() {
    //different settings.ini path for developement and pkg version
    const settingsPathPkg = path.join(path.dirname(process.execPath), '/settings.ini')
    const settingsPathNode = path.join(__dirname, '/settings.ini')

    if (fs.existsSync(settingsPathPkg)) {
        return settingsPathPkg
    } else if (fs.existsSync(settingsPathNode)) {
        return settingsPathNode
    } else {
        return false
    }
}

function checkSettings() {
    return new Promise((resolve, reject) => {
        const settingsPath = iniPath()
        if (settingsPath) {
            let settings = ini.parse(fs.readFileSync(settingsPath, 'utf-8'))
            resolve(settings)
        } else {
            console.log('Settings.ini not found')
            askForSettings()
                .then(settings => {
                    resolve(settings)
                })

        }
    })
}

function askForSettings() {
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

function sanitizeServerUrl(kimaiurl) {
    return kimaiurl.replace(/\/+$/, "");
}

(function startup() {
    checkSettings()
        .then(settings => {
            mainMenu(settings)
        })
})()
