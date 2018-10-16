`use strict`;

const app = require(`./app`);
const commandExists = require(`command-exists`);

//Check if ffmpeg is installed
commandExists(`ffmpeg`, (error) => {
    if (error){
        app.logger.error(`ffmpeg command not found - you need to install FFMPEG on your system`, {identifier: `rtspArchive`});
        process.exit(1);
    }
    app.run().then(() => {
        app.logger.info(`rtspRecorder has started`, {identifier: `main`});
    });
});
