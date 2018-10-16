`use strict`;

/**
    Allows to control multiple FFMPEG instances. Each instance can be added by using the recorder.addInstance function with specified parameters. The added instances can be started with the recorder.run function. Each instance will be removed automatically upon error or when it finishes recording.
**/

const ffmpeg = require(`fluent-ffmpeg`);
const config = require(`../config`);
const logger = require(`../logger`);

const recorder = class {
    constructor() {
        /*
            Structure of the _ffmpegInstances array:
            [{
                name: String,
                destination: String,
                streamMeta: Object,
                ffmpeg: fluent-ffmpeg Object
            }]
        */
        this._ffmpegInstances = new Array();
    }
    /*
        Adds a new ffmpeg instance (doesn't start it). The instance name has to be unique
        destination: a full output path
        endCallback(streamMeta, destination): a function that will be called when ffmpeg finishes recording (e.g. after exceeding streamMeta.fileDuration)
        beginCallback(streamMeta, destination): a function that will be called when ffmpeg starts recording
        streamMeta: {
            name: String,
            source: String,
            destination: String,
            format: String,
            fileDuration: Integer (seconds),
            ffmpegOptions:{
                transcode: Boolean,
                recordVideo: Boolean,
                videoResolution: String,
                videoFps: Integer,
                videoCodec: String,
                videoBitrate: Integer/String,
                recordAudio: Boolean,
                audioCodec: String,
                audioBitrate: String,
                audioChannels: String,
                customInputOptions: Array of String,
                customOutputOptions: Array of String
            }
        }
    */
    addInstance({streamMeta, destination, beginCallback = null, endCallback = null} = {}) {
        logger.debug(`Adding a new recorder instance: ${streamMeta.name}`, {identifier: `recorder addInstance`, meta: {streamMeta}});
        //Prevent adding multiple instances with the same name
        const instanceAlreadyExists = this._ffmpegInstances.some((instance) => {
            return instance.name === streamMeta.name;
        });
        if (instanceAlreadyExists){
            logger.error(`Failed to add an instance "${streamMeta.name}" - it already exists`);
            return false;
        }
        //Create an ffmpeg instance based on the provided streamMeta
        let ffmpegConstructorOptions = {source: streamMeta.source, logger};
        if (streamMeta.fileDuration){ //If the file duration is set, define a timeout with additional 30 seconds for buffering
            ffmpegConstructorOptions = Object.assign(ffmpegConstructorOptions, {timeout: streamMeta.fileDuration + 30});
        }
        const newFfmpeg = ffmpeg(ffmpegConstructorOptions).output(destination);
        if (streamMeta.fileDuration){
            newFfmpeg.duration(streamMeta.fileDuration);
        }
        if (streamMeta.ffmpegOptions.format){
            newFfmpeg.format(streamMeta.ffmpegOptions.format);
        }
        if (streamMeta.ffmpegOptions.recordVideo){
            if (streamMeta.ffmpegOptions.transcode){ //Copy the video stream if transcoding is set to false
                if (streamMeta.ffmpegOptions.videoResolution){
                    newFfmpeg.size(streamMeta.ffmpegOptions.videoResolution);
                }
                if (streamMeta.ffmpegOptions.videoFps){
                    newFfmpeg.fps(streamMeta.ffmpegOptions.videoFps);
                }
                if (streamMeta.ffmpegOptions.videoCodec){
                    newFfmpeg.videoCodec(streamMeta.ffmpegOptions.videoCodec);
                }
                if (streamMeta.ffmpegOptions.videoBitrate){
                    newFfmpeg.videoBitrate(streamMeta.ffmpegOptions.videoBitrate);
                }
            } else {
                newFfmpeg.videoCodec(`copy`);
            }
        } else {
            newFfmpeg.noVideo();
        }
        if (streamMeta.ffmpegOptions.recordAudio){
            if (streamMeta.ffmpegOptions.transcode){ //Copy the audio stream if transcoding is set to false
                if (streamMeta.ffmpegOptions.audioCodec){
                    newFfmpeg.audioCodec(streamMeta.ffmpegOptions.audioCodec);
                }
                if (streamMeta.ffmpegOptions.audioBitrate){
                    newFfmpeg.audioBitrate(streamMeta.ffmpegOptions.audioBitrate);
                }
                if (streamMeta.ffmpegOptions.audioChannels){
                    newFfmpeg.audioChannels(streamMeta.ffmpegOptions.audioChannels);
                }
            } else {
                newFfmpeg.audioCodec(`copy`);
            }
        } else {
            newFfmpeg.noAudio();
        }
        if (streamMeta.ffmpegOptions.customInputOptions){
            newFfmpeg.inputOptions = streamMeta.ffmpegOptions.customInputOptions;
        }
        if (streamMeta.ffmpegOptions.customOutputOptions){
            newFfmpeg.outputOptions = streamMeta.ffmpegOptions.customOutputOptions;
        }
        //Create a new instance (ffmpeg + metadata) and add event handlers
        const newInstance = {
            name: streamMeta.name,
            destination,
            streamMeta,
            ffmpeg: newFfmpeg
        };
        this._addInstanceEventHandlers(newInstance, beginCallback, endCallback);
        //Push the newly created instance to the _ffmpegInstances array
        this._ffmpegInstances.push(newInstance);
    }
    /*
        Runs all added ffmpeg instances
    */
    run() {
        this._ffmpegInstances.forEach((instance) => {
            instance.ffmpeg.run();
        });
    }
    /*
        Runs a single instance with the specified name
    */
    runSingle(name) {
        this._ffmpegInstances.some((instance) => {
            if (instance.name === name){
                instance.ffmpeg.run();
                return true;
            }
        });
    }
    /*
        Adds `start`, `end` and `error` event handlers to the given instance (ffmpeg + metadata - as specified in the constructor)
    */
    _addInstanceEventHandlers(instance, beginCallback, endCallback) {
        instance.ffmpeg.on(`end`, () => {
            logger.info(`FFMpeg instance ${instance.name} has finished`, {identifier: `recorder event`, meta: {streamMeta: instance.streamMeta}});
            //Remove the instance from _ffmpegInstances array
            this._ffmpegInstances = this._ffmpegInstances.filter(instanceInner => instanceInner.name !== instance.name);
            if (typeof endCallback === `function`){
                endCallback(instance.streamMeta, instance.destination);
            }
        });
        instance.ffmpeg.on(`start`, (commandLine) => {
            logger.info(`FFMpeg instance ${instance.name} has started: ${commandLine}`, {identifier: `recorder event`, meta: {streamMeta: instance.streamMeta, commandLine: commandLine}});
            if (typeof beginCallback === `function`){
                beginCallback(instance.streamMeta, instance.destination);
            }
        });
        instance.ffmpeg.on(`error`, function(err, stdout, stderr) {
            logger.error(`FFMpeg instance ${instance.name} reported an error: ${err}`, {identifier: `recorder event`, meta: {streamMeta: instance.streamMeta, stdout: stdout, stderr: stderr, error: err}});
            //Remove the instance from _ffmpegInstances array
            this._ffmpegInstances = this._ffmpegInstances.filter(instanceInner => instanceInner.name !== instance.name);
        });
    }
}

module.exports = recorder;
