var iracing = require('node-irsdk-2021').getInstance({
    telemetryUpdateInterval: 100,
    sessionInfoUpdateInterval: 1000,
})
const io =  require('socket.io-client');
const chalk = require('chalk');
const fs = require('fs');
const { prompt } = require('enquirer');

var options = {
    updateInterval: 1000,
    sessionNum: 0,
    channel: 'pennyarcade',
    isStreamer: true,
}

var sessionRacers = []
var sessionInfo = {
    flags: [
        
    ],
    session: {
        number: 0,
        type: "PRACTICE",
        timeRemaining: 0,
        fastRepairs: 0,
        fastestLap: null,
    },
    track: {
      name: "Unknown Track",
      id: -1,
      longName: "unknown track",
      city: "Unknown City",
      country: "Unknown Country",  
      temperature: "N/A",
      length: "N/A"
    },
    weather: {
        windSpeed: "N/A",
        temperature: "N/A",
        skies: "Sunny"
    }
}

var driverData = {
    tiresRemaining: {
        left: { front: 0, rear: 0 },
        right: { front: 0, rear: 0 }
    },
    fuel: { remaining: 0, percent: 0}
}

const firstTimeSetup = async () => {
    console.log(chalk.bold("Performing First Time Setup"));

    let answers = {
        isStreamer: null,
        username: null
    }

    let isStreamer = {
        type: 'confirm',
        name: 'is_twitch',
        message: 'Do you stream iRacing on Twitch?'
    }

    let twitchUsername = {
        type: 'input',
        name: 'channel_name',
        message: 'What is your Twitch username?',
        validate: (a) => {
            if (!a) return false;
            else return true;
        }
    }

    let otherUsername = {
        type: 'input',
        name: 'username',
        message: 'What name would you like to go by on the Pit Wall?',
        validate: (a) => {
            if (!a) return false;
            else return true;
        }
    }

    prompt(isStreamer)
        .then((r) => {
            if (r.is_twitch) {
                setTimeout(() => {
                    prompt(twitchUsername)
                        .then((r2) => {
                            answers.isStreamer = r.is_twitch;
                            answers.username = r2.channel_name;

                            options.channel = answers.username;
                            options.isStreamer = answers.isStreamer;

                            fs.writeFileSync('./options.json', JSON.stringify(answers, null, 4));
                            init();
                        })
                }, 1000)
            } else {
                setTimeout(() => {
                    prompt(otherUsername)
                        .then((r2) => {
                            answers.isStreamer = r.is_twitch;
                            answers.username = r2.username;

                            options.channel = answers.username;
                            options.isStreamer = answers.isStreamer;

                            fs.writeFileSync('./options.json', JSON.stringify(answers, null, 4));
                            init();
                        })
                }, 1000)
            }
        })
}

const init = async () => {
    console.clear();
    console.log("Status: " + chalk.yellow("WAITING"));
    console.log("Waiting to go racing, when an iRacing instance is detected you will automatically be connected to the Gabir Motors Pit Wall");

    let timeout = setTimeout(() => {
        console.log(chalk.red("\n\n\n If this is your first time running this app and it is having trouble connecting, try restarting it."))
    }, 5000)

    const Streaming = io("https://streaming.gabirmotors.com")

    iracing.on('Connected', function (evt) {
        clearTimeout(timeout);

        console.clear();
        console.log(chalk.italic(chalk.gray("GABIR MOTORS PIT WALL V1.3")))
        console.log("Status: " + chalk.green("CONNECTED"));
        console.log(`Hello ${chalk.bold(options.channel)}, you are now connected to the Gabir Motors Pit Wall!`)
        console.log(`\n\nYour Link: https://pitwall.gabirmotors.com/${options.channel}`)
    })

    iracing.on('SessionInfo', function (evt) {
        let drivers = evt.data.DriverInfo.Drivers;

        sessionInfo.session.type = evt.data.SessionInfo.Sessions[sessionInfo.session.number].SessionName;
        sessionInfo.session.fastRepairs = evt.data.WeekendInfo.WeekendOptions.FastRepairsLimit;
        sessionInfo.session.fastestLap = evt.data.SessionInfo.Sessions[sessionInfo.session.number].ResultsFastestLap;
        sessionInfo.track = {
            name: evt.data.WeekendInfo.TrackDisplayName,
            id: evt.data.WeekendInfo.TrackID,
            city: evt.data.WeekendInfo.TrackCity,
            country: evt.data.WeekendInfo.TrackCountry,
            temperature: evt.data.WeekendInfo.TrackSurfaceTemp,
            length: evt.data.WeekendInfo.TrackLengthOfficial
        }
        sessionInfo.weather = {
            windSpeed: evt.data.WeekendInfo.TrackWindVel,
            temperature: evt.data.WeekendInfo.TrackAirTemp,
            skies: evt.data.WeekendInfo.TrackSkies
        }

        sessionRacers = [];

        for (var i = 0; i < drivers.length - 1; i ++) {
            let driver = drivers[i];
            
            if (!driver.CarIsPaceCar) {
                sessionRacers.push({
                    carIndex: driver.CarIdx,
                    name: driver.UserName,
                    userID: driver.UserID,
                    carNumber: driver.CarNumber,
                    classID: driver.CarClassID,
                    isPaceCar: driver.CarIsPaceCar === 1,
                    raceData: {
                        position: 0,
                        onPitRoad: true,
                        class: 0,
                        f2Time: 0,
                        lap: 0,
                        lapsCompleted: 0,
                        fastRepairsUsed: 0,
                        lapPercent: 0,
                    },
                    carData: {
                        trackSurface: "OnTrack",
                        steer: 0,
                        rpm: 0,
                        gear: 0,
                    },
                    lapTimes: {
                        last: 0,
                        best: {
                            time: 0,
                            lap: 0,
                        }
                    },
                    flags: []
                })
            }
        }
    })

    iracing.on('Telemetry', function (evt) {
        options.sessionNum = evt.values.SessionNum;
        sessionInfo = {
            flags: evt.values.SessionFlags,
            session: {
                number: evt.values.SessionNum,
                type: sessionInfo.session.type,
                timeRemaining: evt.values.SessionTimeRemain,
                fastRepairs: sessionInfo.session.fastRepairs,
                fastestLap: sessionInfo.session.fastestLap,
            },
            track: sessionInfo.track,
            weather: sessionInfo.weather,
        }

        for (let i = 0; i < sessionRacers.length; i++) {
            let _idx = sessionRacers[i].carIndex;
            sessionRacers[i].raceData.position = evt.values.CarIdxPosition[_idx];
            sessionRacers[i].raceData.onPitRoad = evt.values.CarIdxOnPitRoad[_idx];
            sessionRacers[i].raceData.f2Time = evt.values.CarIdxF2Time[_idx];
            sessionRacers[i].raceData.lap = evt.values.CarIdxLap[_idx];
            sessionRacers[i].raceData.lapsCompleted = evt.values.CarIdxLapCompleted[_idx];
            sessionRacers[i].raceData.class = evt.values.CarIdxClass[_idx];
            sessionRacers[i].carData.trackSurface = evt.values.CarIdxTrackSurface[_idx];
            sessionRacers[i].carData.steer = evt.values.CarIdxSteer[_idx];
            sessionRacers[i].carData.rpm = evt.values.CarIdxRPM[_idx];
            sessionRacers[i].carData.gear = evt.values.CarIdxGear[_idx];
            sessionRacers[i].lapTimes.last = evt.values.CarIdxLastLapTime[_idx];
            sessionRacers[i].lapTimes.best.time = evt.values.CarIdxBestLapTime[_idx];
            sessionRacers[i].lapTimes.best.lap = evt.values.CarIdxBestLapNum[_idx];
            sessionRacers[i].flags = evt.values.CarIdxSessionFlags[_idx];
            sessionRacers[i].raceData.fastRepairsUsed = evt.values.CarIdxFastRepairsUsed[_idx];
            sessionRacers[i].raceData.lapPercent = evt.values.CarIdxLapDistPct[_idx];
        }

        driverData = {
            tiresRemaining: {
                left: { 
                    front: evt.values.LFTiresAvailable, 
                    rear: evt.values.LRTiresAvailable 
                },
                right: { 
                    front: evt.values.RFTiresAvailable, 
                    rear: evt.values.RRTiresAvailable 
                }
            },
            fuel: { 
                remaining: evt.values.FuelLevel,
                percent: evt.values.FuelLevelPct
            }
        }
    })

    iracing.on('Disconnected', function (evt) {
        Streaming.emit("connected_standings", "false");
        console.clear();
        console.log("Status: " + chalk.red("DISCONNECTED"));
        console.log("Disconnected, waiting to go racing");

        options = {
            updateInterval: 1000,
            sessionNum: 0,
        }
        
        sessionRacers = []
        sessionInfo = {
            flags: [
                
            ],
            session: {
                number: 0,
                type: "PRACTICE",
                timeRemaining: 0,
                fastRepairs: 0,
                fastestLap: null
            },
            track: {
              name: "Unknown Track",
              city: "Unknown City",
              country: "Unknown Country",  
              temperature: "N/A",
              length: "N/A"
            },
            weather: {
                windSpeed: "N/A",
                temperature: "N/A",
                skies: "Sunny"
            }
        }

        Streaming.emit("standings", JSON.stringify({
            sessionInfo, 
            sessionRacers
        }))
    })

    setInterval(() => { 
        if (sessionRacers.length < 1) return;
        Streaming.emit("standings", JSON.stringify({
            sessionInfo, 
            sessionRacers,
            driverData,
            options: {
                channel: options.channel,
                isStreamer: options.isStreamer
            }
        }))
    }, options.updateInterval)

    Streaming.emit("awake", options.channel);

    Streaming.on("check_awake", (d) => {
        Streaming.emit("awake", options.channel);
    })
}

try {
    if (fs.existsSync('./options.json')) {
        let fileData = fs.readFileSync('./options.json', "utf8");
        let parsed = JSON.parse(fileData);

        options.channel = parsed.username;
        options.isStreamer = parsed.isStreamer;

        init();
    } else {
        firstTimeSetup();
    }
} catch (e) {
    firstTimeSetup();
}