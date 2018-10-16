`use strict`;

/**
    Allows to monitor and remove files based on a defined storage period
**/

const config = require(`../config`);
const logger = require(`../logger`);
const h = require(`../helpers`);
const moment = require(`moment-timezone`);


const fileRotator = class {
    constructor() {
        /*
            Structure of the _ffmpegInstances array:
            [{
                path: String,
                storageDuration: Integer,
                stats: fs.stats Object
            }]
        */
        this._fileList = new Array();
    }
    /*
        Adds a file to the list of monitored files
    */
    async addFile(path, storageDuration = 0){
        logger.verbose(`Adding a file ${path} with storage duration ${storageDuration}`, {identifier: `fileRotator addFile`, meta: {path, storageDuration}});
        const fileStats = await this._getFileStats(path);
        if (!fileStats || !fileStats.isFile()){
            logger.error(`${path} is not a file, ignoring it`, {identifier: `fileRotator addFile`, meta: {path, storageDuration}});
            return false;
        }
        this._fileList.push({
            path,
            storageDuration,
            stats: fileStats
        });
    }
    /*
        Removes the file from the list of monitored files AND from the file system
    */
    async removeFile(path){
        try{
            await h.fsAsync.unlink(path);
            this._fileList = this._fileList.filter(file => file.path !== path);
        } catch (error){
            logger.error(`Error while removing file ${path}: ${error}`, {identifier: `fileRotator removeFile`, meta: error});
        }
    }
    /*
        Removes previously added files based on their storage duration
    */
    async rotate(){
        await h.asyncForEach(this._fileList, async (file) => {
            const newFileList = new Array();
            const creationTime = moment.unix(Math.round(file.stats.birthtimeMs) / 1000);
            const currentTime = moment();
            const timeDifference = moment.duration(currentTime.diff(creationTime)).asSeconds();
            if (timeDifference > file.storageDuration){
                logger.verbose(`Removing file ${file.path} because it exceeded its storage duration (${file.storageDuration}s)`, {identifier: `fileRotator rotate`, meta: {file, timeDifference}});
                await this.removeFile(file.path);
            }
        });
    }
    async _getFileStats(path) {
        try{
            return await h.fsAsync.stat(path);
        } catch(error){
            return false;
        }
    }
}

module.exports = fileRotator;
