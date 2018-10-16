`use strict`;

const recorder = new (require(`./recorder`))();
const fileRotator = new (require(`./fileRotator`))();
const fs = require(`fs-extra`);
const moment = require(`moment`);
const config = require(`./config`);
const asyncinterval = require(`asyncinterval`);
const logger = require(`./logger`);
const h = require(`./helpers`);
const glob = require(`glob`);
const {promisify} = require(`util`);
const deleteEmpty = require(`delete-empty`);

const globAsync = promisify(glob);

/**
    Creates the stream destination directory if it doesn't exist.
    Format: ${config.destinationDirectory}/year/month/day/

    Returns the created path as a String or false if there was an error
**/
const ensureStreamDirExists = async (stream = {}) => {
    const date = moment();
    const year = date.format(`YYYY`);
    const month = date.format(`M`);
    const day = date.format(`D`);
    let fullDestinationPath = `${config.destinationDirectory}/${stream.name}/${year}/${month}/${day}/`;
    try{
        await fs.ensureDir(fullDestinationPath);
        return fullDestinationPath;
    } catch (error){
        logger.error(`Error while trying to create a new directory for stream ${stream.name}: ${error}`, {identifier: `rtspArchive`, meta: {stream, error}});
    }
    return false;
}

/**
    Add the new output file to file rotator, run rotator and remove empty directories (rotator leftovers)
**/
const recorderBeginCallback = async (streamMeta, destination) => {
    await h.wait(3000); //Wait for ffmpeg to create the file
    await fileRotator.addFile(destination, streamMeta.storageDuration);
    await fileRotator.rotate();
    await deleteEmpty(config.destinationDirectory);
}

/**
    Create a new stream output path and a recorder instance. Run the instance immediately.
**/
const recorderEndCallback = async (streamMeta, destination) => {
    const streamDir = await ensureStreamDirExists(streamMeta);
    const streamPath = `${streamDir}${moment().format(`HH:mm:ss`)}.mp4`;
    recorder.addInstance({streamMeta, destination: streamPath, beginCallback: recorderBeginCallback, endCallback: recorderEndCallback});
    recorder.runSingle(streamMeta.name);
}

/**
    Recursively scans the config.destinationDirectory for files. Searches the config.streams array for corresponding stream configuration and adds the files to fileRotator (it does not run rotator).
**/
const addOldFilesToRotator = async () => {
    //Get all files in config.destinationDirectory (excluding directories)
    let files = new Array();
    try{
        files = await globAsync(`${config.destinationDirectory}/**`, {nodir: true});
    } catch(error){
        logger.error(`Error while trying to scan ${config.destinationDirectory} for old files: ${error}`, {identifier: `rtspArchive addOldFilesToRotator`});
        return false;
    }
    await h.asyncForEach(files, async (file) => {
        //Remove the config.destinationDirectory prefix from the found file path, so we'll hopefully be left with stream.name/year/month/...
        const pathSplit = file.replace(`${config.destinationDirectory}/`, ``).split(`/`);
        if (pathSplit.length > 0){
            const streamName = pathSplit[0]; //This should be the stream name (first string in the trimmed file path)
            let streamStorageDuration = 0; //If the stream configuration won't be found, the file will be removed immediately after running rotator
            config.streams.every((stream) => { //Search for the corresponding stream configuration and extract the stream storage duration. Overwrite the streamStorageDuration variable if found
                if (stream.name === streamName){
                    streamStorageDuration = stream.storageDuration;
                    return false;
                }
                return true;
            });
            await fileRotator.addFile(file, streamStorageDuration); //Add the file to rotator
        }
    });
}

module.exports = {
    run: async () => {
        if (config.rotateOldFiles){
            await addOldFilesToRotator();
            await fileRotator.rotate();
        }
        //For each stream create a new recorder instance. Output files will be added to rotator in the recorderBeginCallback
        await h.asyncForEach(config.streams, async (stream) => {
            const streamDir = await ensureStreamDirExists(stream);
            const streamPath = `${streamDir}${moment().format(`HH:mm:ss`)}.mp4`;
            recorder.addInstance({streamMeta: stream, destination: streamPath, beginCallback: recorderBeginCallback, endCallback: recorderEndCallback});
        });
        recorder.run(); //Run all the added recorder instances
    },
    logger,
    recorder,
    fileRotator,
    config
};
