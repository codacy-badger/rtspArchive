`use strict`;

/**
    Provides helper functions used across the whole project
**/


module.exports = {
    /**
        Calls the "func" function endlessly in a loop with the given interval.
        Passes the "args" argument to this function. If defined, calls the callback
        function and passes a result of the "func" function to it.
    **/
    asyncEndlessLoop:(interval, func, args, callback) => {
        const doRecurse = () => {
            func(args).then((response) => {
                if (callback){
                    callback(response);
                }
                setTimeout(doRecurse, interval);
            });
        }
        doRecurse();
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
