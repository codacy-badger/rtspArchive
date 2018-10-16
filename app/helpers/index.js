`use strict`;

/**
    Provides helper functions used across the whole project
**/

const fs = require(`fs`);
const {promisify} = require(`util`);

module.exports = {
    /**
        Promisified fs functions
    **/
    fsAsync: {
        stat: promisify(fs.stat),
        unlink: promisify(fs.unlink)
    },
    /**
        Allows to use await in the forEach callback
    **/
    asyncForEach: async (iterable, callback) => {
        if (Array.isArray(iterable)){
            for (let index = 0; index < iterable.length; index++){
                await callback(iterable[index], index, iterable)
            }
        } else if (iterable instanceof Object){
            for (let prop in iterable){
                await callback(iterable[prop], prop, iterable)
            }
        }
    },
    /**
        Return a promise after ms number of milliseconds
    **/
    wait: (ms) => {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    },
}
