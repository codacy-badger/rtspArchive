`use strict`;

const app = require(`./app`);
const commandExists = require(`command-exists`);

//Anonymous async function to make things easier with await
(async () => {
    //Check if ffmpeg is installed
    try{
        await commandExists(`ffmpeg`);
    } catch(error){
        app.logger.error(`ffmpeg command not found - you need to install FFMPEG on your system`, {identifier: `rtspArchive`});
        return false;
    }
})();
