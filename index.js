var iracing = require('node-irsdk-2021').getInstance({
    telemetryUpdateInterval: 100,
    sessionInfoUpdateInterval: 1000,
})
const io =  require('socket.io-client');
const chalk = require('chalk');

var options = {
    updateInterval: 1000,
    sessionNum: 0,
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
      name: "Unkown Track",
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

const init = async () => {
    console.clear();
    console.log("Status: " + chalk.yellow("WAITING"));
    console.log("Waiting to go racing, when an iRacing instance is detected something cool will happen");

    const Streaming = io("https://streaming.gabirmotors.com")

    iracing.on('Connected', function (evt) {
        Streaming.emit("connected_standings", "true");
        console.clear();
        console.log("Status: " + chalk.green("CONNECTED"));
    })

    iracing.on('SessionInfo', function (evt) {
        let drivers = evt.data.DriverInfo.Drivers;

        sessionInfo.session.type = evt.data.SessionInfo.Sessions[sessionInfo.session.number].SessionName;
        sessionInfo.session.fastRepairs = evt.data.WeekendInfo.WeekendOptions.FastRepairsLimit;
        sessionInfo.session.fastestLap = evt.data.SessionInfo.Sessions[sessionInfo.session.number].ResultsFastestLap;
        sessionInfo.track = {
            name: evt.data.WeekendInfo.TrackDisplayName,
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

        console.log("Session Update");
        // console.log(drivers)
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
            console.log(sessionRacers)
        }
    
        console.log(sessionRacers)
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
              name: "Unkown Track",
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
        console.log("Sent a list of " + sessionRacers.length + " drivers")
        Streaming.emit("standings", JSON.stringify({
            sessionInfo, 
            sessionRacers,
            driverData
        }))
    }, options.updateInterval)
}

init();