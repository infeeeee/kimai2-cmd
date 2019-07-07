# Kimai2-cmd

Command line client for [Kimai2](https://www.kimai.org/), the open source, self-hosted time tracker.

To use this program you have to install Kimai2 first!

This client is still under developement. See planned features in the next section

## Current and planned features

This client is not intended to replace the Kimai webUI, so only basic functions, starting and stopping measurements

Commands: 
- [x] Start, restart and stop measurements
- [x] List active and recent measurements
- [x] List projects and activities

UI:
- [x] Interactive terminal UI with autocomplete
- [x] Classic terminal UI for integration 

Integration:
- [x] Portable executable for all three platforms
- [ ] Generate output for Rainmeter (Windows) (Just like [kimai-cmd](https://github.com/infeeeee/kimai-cmd))
- [ ] Generate output for Argos/Kargos/Bitbar (Gnome, Kde, Mac)

## Installation

Download executable from [releases](https://github.com/infeeeee/kimai2-cmd/releases/latest). Standalone executable, no installation required

### Notes on Windows

Add the path of the containing folder to the %PATH% environment variable so you can run it from command line/powershell system wide. I didn't find any reliable way to do this from command line, so follow this guide. It should work on win 7-10

- Open start menu and type: SystemPropertiesAdvanced.exe
- Go to Advanced tab click Environment variables
- Select path on the top pane, click Edit
- on win 7,8 add the folloing to the end of the variable: `;c:\path\to\containing\folder`
- On win 10 click New and type `c:\path\to\containing\folder`
- Log off and on if not working

### Notes on Linux/Mac

On the following terminal examples use the file name you downloaded. 

Make the downloaded binary executable:
```
sudo chmod +x kimai2-cmd-os
```

Add kimai2-cmd to path so you have to just type `kimai` to the terminal:
```
sudo ln -s /path/to/kimai2-cmd-os /usr/bin/kimai
```

To remove:
```
sudo rm /usr/bin/kimai
```

## Usage

Two usage modes: interactive and classic ui

### Interactive ui

If you start without any commands, you will get to the interactive UI. Use your keyboard's arrow keys for navigation. On the *Start new measurement* menu item you can search for project and activity names.

You can exit with ctrl+c any time.

### Classic ui

You can find all the options in the help:

```
$ kimai2-cmd --help

Usage: kimai2-cmd [options] [command]

Command line client for Kimai2. For interactive mode start without any commands. To generate settings file start in interactive mode!

Options:
  -V, --version               output the version number
  -v, --verbose               verbose, longer logging
  -i, --id                    show id of elements when listing
  -h, --help                  output usage information

Commands:
  start [project] [activity]  start selected project and activity
  restart [id]                restart selected measurement
  stop                        stop all measurements
  list-active                 list active measurements
  list-recent                 list recent measurements
  list-projects               list all projects
  list-activities             list all activities
```

Project ans activity names are case insensitive. If your project or activity name contains a space, wrap it in double or single quotes. This example starts prject named foo with activity named bar bar:

```
kimai2-cmd start "foo" "bar bar"
```

### Settings and first run

All settings stored in the settings.ini file. Place this file to the same directory as the executable. If no settings file found you will drop to the interactive UI, where you can add your settings. 

You can create your settings.ini file manually, by downloading, renaming and editing [settings.ini.example](https://github.com/infeeeee/kimai2-cmd/blob/master/settings.ini.example).

## Developement version

### Installation

requirements:
- node js 10+
- git

```
git clone https://github.com/infeeeee/kimai2-cmd
cd kimai2-cmd
npm install
```

### Build

Requirements: globally installed [pkg](https://github.com/zeit/pkg): 

```
npm install pkg -g
```

Build for current platform and architecture

```
npm run build-current
```


Build x64 executables to linux, mac, win (not really working for unknown reason)

```
npm run build
```

About building for other platforms see pkg's documentation, or open an issue and I can build it for you.


### Usage

For interactive mode just simply:

```
npm start
```
or
```
node kimai2-cmd.js
```

For usage with options you have pass a `--` before the options if you start with `npm start`. You don't need this if you don't use options just commands

So this two lines are equivalent, both shows the current version of kimai2-cmd:

```
npm start -- -V
node kimai2-cmd.js -V
```

This two are equivalent as well, both starts the project `foo` with the activity `bar`

```
npm start start foo bar
node kimai2-cmd.js start foo bar
```

On the first run it will ask for your settings, but you can just copy settings.ini.example to settings.ini and modify it with your favourite text editor

## Troubleshooting

If you find a bug open an issue! The client is not finished yet, however all implemented features should work!

## License

MIT