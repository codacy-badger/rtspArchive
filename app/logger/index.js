`use strict`;

/**
    Exposes an object which can log data in the defined destination containers
    Usage:
        logger.<level>(`<message>`, {logging: boolean, meta: OBJECT, identifier: String, callId: String});
        @logging: default: true
        @meta: default: {}
        @identifier: default: `unknown`
        @callId: default: ``
    Example:
        logger.silly(`Parsed configuration`, {meta: {parsedConfig: config}, callId: `12432`, identifier: `CONFIG`});
**/

const winston = require(`winston`);
require(`winston-daily-rotate-file`); //No need to assign it
const appRoot = require(`app-root-path`);
const config = require(`../config`);
const colors = require(`colors`);


/*
    Custom log levels and their colours for use in winston's transports
*/
const customLevels = {
    levels: {
        silly: 6,
        setup: 5,
        debug: 4,
        verbose: 3,
        info: 2,
        warn: 1,
        error: 0
    },
    colors: {
        silly: `grey`,
        setup: `white`,
        debug: `blue`,
        verbose: `cyan`,
        info: `green`,
        warn: `yellow`,
        error: `red`
    }
}

/*
    Parses custom variables displayed in log messages and constructs a colorized/not colorized log message. A list of supported custom variables that will be inserted to the returned log message:
    @meta: Object
    @identifier: String
    @callId: String
*/
const appPrintf = (colorize = false) => {
    return winston.format.printf((info) => {
        const metaObj = {};
        //Exclude undefined keys
        if (info.meta instanceof Object){
            for (let key in info.meta){
                if (info.meta[key] !== undefined){
                    metaObj[key] = info.meta[key];
                }
            }
        }
        //If prettyMeta is set to true, prettify the meta string
        let metaString = config.logging.prettyMeta ? JSON.stringify(metaObj, null, 4) : JSON.stringify(metaObj);
        //If the meta string length excdeeds the maximum meta length, replace it with a message
        if (typeof metaString === `string` && config.logging.maxMetaLength < metaString.length){
            metaString = `Too long (${metaString.length} characters)`;
        }
        let identifier = info.identifier ? info.identifier : `Unknown`;
        //Colorize the identifier if needed
        identifier = colorize ? colors.italic.bold.black(identifier) : identifier;
        const timestamp = info.timestamp;
        const level = info.level;
        const callId = info.callId ? ` ${colorize ? colors.italic.grey(info.callId) : info.callId}` : ``;
        const message = info.message;
        //Construct the actual metadata message
        let meta = ``;
        //If there is any metadata, create the meta message containing the meta string
        if (Object.keys(metaObj).length > 0){
            meta = colorize ? colors.dim(' | META: ' + metaString) : metaString;
        }
        const finalMessage = `${timestamp} - ${level} [${identifier}]${callId}: ${message} ${meta}`;
        return finalMessage;
    });
}

/*
    Uses the appPrintf function to create a formatted winston log message
*/
const appFormatter = (colorize = false) => {
    if (colorize) {
        return winston.format.combine(
            winston.format.colorize(),
            appPrintf(colorize)
        );
    } else {
        return winston.format.combine(
            appPrintf(colorize)
        );
    }
}

const logger = winston.createLogger({
    levels: customLevels.levels,
    format: winston.format.combine( //Add winston.timestamp and ignore the incoming log message if its logging is set to false
        (winston.format((info, opts) => {
            if (!info || info.logging === false){ //Don't log when logging is set to false
                return false;
            } else {
                return info;
            }
        }))(),
        winston.format.timestamp()
    ),
    transports: [
        new (winston.transports.Console)({
            format: appFormatter(true),
            name: `appConsole`,
            level: config.logging.level,
            handleExceptions: true,
        }),
        new (winston.transports.DailyRotateFile)({
            format: appFormatter(false),
            filename: `${appRoot}/logs/main.log`,
            name: `appFile`,
            datePattern: `YYYY-MM-DD-HH`,
            level: config.logging.level,
            handleExceptions: true,
            maxSize: `20m`,
            maxFiles: `30d`
        }),
    ],
    exitOnError: false,
});
winston.addColors(customLevels.colors);

module.exports = logger;
