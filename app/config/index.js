`use strict`;

/**
    Imports configuration from /config/config.json file
**/

const fs = require(`graceful-fs`);
const appRoot = require(`app-root-path`);

const configPath = `${appRoot}/config/config.json`;
let configJson = null; //Global variable in scope of this module

 //Reads the config.json file to configJson variable
if (fs.existsSync(configPath)){
    configJson = JSON.parse(fs.readFileSync(configPath, `utf8`));
} else {
    throw(`Error: /config/config.json not found`);
}

module.exports = configJson;
