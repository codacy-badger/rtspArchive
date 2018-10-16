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

const recorderBeginCallback = async (streamMeta, destination) => {
    await h.wait(3000); //Wait for ffmpeg to create the file
    await fileRotator.addFile(destination, streamMeta.storageDuration);
    await fileRotator.rotate();
    await deleteEmpty(config.destinationDirectory);
}

const recorderEndCallback = async (streamMeta, destination) => {
    const streamDir = await ensureStreamDirExists(streamMeta);
    const streamPath = `${streamDir}${moment().format(`HH:mm:ss`)}.mp4`;
    recorder.addInstance({streamMeta, destination: streamPath, beginCallback: recorderBeginCallback, endCallback: recorderEndCallback});
    recorder.runSingle(streamMeta.name);
}

const addOldFilesToRotator = async () => {
    let files = new Array();
    try{
        files = await globAsync(`${config.destinationDirectory}/**`, {nodir: true});
    } catch(error){
        logger.error(`Error while trying to scan ${config.destinationDirectory} for old files: ${error}`, {identifier: `rtspArchive addOldFilesToRotator`});
        return false;
    }
    await h.asyncForEach(files, async (file) => {
        const pathSplit = file.replace(`${config.destinationDirectory}/`, ``).split(`/`);
        if (pathSplit.length > 0){
            const streamName = pathSplit[0];
            let streamStorageDuration = 0;
            config.streams.every((stream) => {
                if (stream.name === streamName){
                    streamStorageDuration = stream.storageDuration;
                    return false;
                }
                return true;
            });
            await fileRotator.addFile(file, streamStorageDuration);
        }
    });
}

module.exports = {
    run: async () => {
        if (config.rotateOldFiles){
            await addOldFilesToRotator();
            await fileRotator.rotate();
        }
        await h.asyncForEach(config.streams, async (stream) => {
            const streamDir = await ensureStreamDirExists(stream);
            const streamPath = `${streamDir}${moment().format(`HH:mm:ss`)}.mp4`;
            recorder.addInstance({streamMeta: stream, destination: streamPath, beginCallback: recorderBeginCallback, endCallback: recorderEndCallback});
        });
        recorder.run();
    },
    logger,
    recorder,
    fileRotator,
    config
};
