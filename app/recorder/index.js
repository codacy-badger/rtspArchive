`use strict`;

/**
    Allows to control multiple FFMPEG instances. Each instance can be added by using the recorder.addInstance function with specified parameters. The added instances can be started with the recorder.run function and stopped with the recorder.stop function.
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
                options: Object,
                ffmpeg: fluent-ffmpeg Object
            }]
        */
        this._ffmpegInstances = new Array();
    }
    /*
        Adds a new ffmpeg instance (doesn't start it). The instance name has to be unique
        endCallback: a function that will be called when ffmpeg finishes recording (e.g. after exceeding options.fileDuration)
        beginCallback: a function that will be called when ffmpeg starts recording
        options: {
            name: String,
            source: String,
            destination: String,
            format: String,
            fileDuration: Integer (seconds),
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
    */
    addInstance(options = {}, beginCallback, endCallback) {
        //Prevent adding multiple instances with the same name
        const instanceAlreadyExists = this._ffmpegInstances.some((instance) => {
            return instance.name === options.name;
        });
        if (instanceAlreadyExists){
            logger.error(`Failed to add an instance "${options.name}" - it already exists`);
            return false;
        }
        //Create an ffmpeg instance based on the provided options
        let ffmpegConstructorOptions = {source: options.source, logger};
        if (options.fileDuration){ //If the file duration is set, define a timeout with additional 30 seconds for buffering
            ffmpegConstructorOptions = Object.assign(ffmpegConstructorOptions, {timeout: options.fileDuration + 30});
        }
        const newFfmpeg = ffmpeg(ffmpegConstructorOptions).output(options.destination);
        if (options.fileDuration){
            newFfmpeg.duration(options.fileDuration);
        }
        if (options.format){
            newFfmpeg.format(options.format);
        }
        if (options.recordVideo){
            if (options.videoResolution){
                newFfmpeg.size(options.videoResolution);
            }
            if (options.videoFps){
                newFfmpeg.fps(options.videoFps);
            }
            if (options.videoCodec){
                newFfmpeg.videoCodec(options.videoCodec);
            }
            if (options.videoBitrate){
                newFfmpeg.videoBitrate(options.videoBitrate);
            }
        } else {
            newFfmpeg.noVideo();
        }
        if (options.recordAudio){
            if (options.audioCodec){
                newFfmpeg.audioCodec(options.audioCodec);
            }
            if (options.audioBitrate){
                newFfmpeg.audioBitrate(options.audioBitrate);
            }
            if (options.audioChannels){
                newFfmpeg.audioChannels(options.audioChannels);
            }
        } else {
            newFfmpeg.noAudio();
        }
        if (options.customInputOptions){
            newFfmpeg.inputOptions = options.customInputOptions;
        }
        if (options.customOutputOptions){
            newFfmpeg.outputOptions = options.customOutputOptions;
        }
        //Create a new instance (ffmpeg + metadata) and add event handlers
        const newInstance = {
            name: options.name,
            options,
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
        Stops all added ffmpeg instances
    */
    stop() {
        this._ffmpegInstances.forEach((instance) => {
            instance.ffmpeg.kill();
        });
    }
    /*
        Stops a single instance with the specified name
    */
    stopSingle(name) {
        this._ffmpegInstances.some((instance) => {
            if (instance.name === name){
                instance.ffmpeg.stop();
                return true;
            }
        });
    }
    /*
        Adds `start`, `end` and `error` event handlers to the given instance (ffmpeg + metadata - as specified in the constructor)
    */
    _addInstanceEventHandlers(instance, beginCallback, endCallback) {
        instance.ffmpeg.on(`end`, () => {
            logger.info(`FFMpeg instance ${instance.name} has finished`, {identifier: `recorder event`, meta: {options: instance.options}});
            if (typeof endCallback === `function`){
                endCallback();
            }
        });
        instance.ffmpeg.on(`start`, (commandLine) => {
            logger.info(`FFMpeg instance ${instance.name} has started`, {identifier: `recorder event`, meta: {options: instance.options, commandLine: commandLine}});
            if (typeof beginCallback === `function`){
                beginCallback();
            }
        });
        instance.ffmpeg.on(`error`, function(err, stdout, stderr) {
            logger.error(`FFMpeg instance ${instance.name} reported an error: ${err}`, {identifier: `recorder event`, meta: {options: instance.options, stdout: stdout, stderr: stderr, error: err}});
        });
    }
}

module.exports = recorder;
