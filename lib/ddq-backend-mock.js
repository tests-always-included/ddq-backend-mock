"use strict";

/**
 * This is a fake backend for DDQ for testing it out. There are a lot of
 * console.log statements in here to give the sense of what it is doing when
 * testing out the functionality of DDQ.
 */
const EMIT_DATA = "data", EMIT_ERROR = "error", FILE = "/mock-db.json";

module.exports = function(config, crypto, EventEmitter, fs, timers) {
    function readData () {
        var file;

        file = fs.readFileSync(__dirname + FILE, "utf-8");

        if (! file) {
            return {};
        }

        return JSON.parse(file);
    }

    function writeData (dataToWrite) {
        fs.open(__dirname + FILE, "w+", function(err, fd) {
            var buffer;

            if (err) {
                this.emit(EMIT_ERROR, new Error("Could not open data."));
            }

            buffer = new Buffer(`${JSON.stringify(dataToWrite)}`);
            fs.write(fd, buffer, 0, buffer.length, null, function(err) {
                if (err) throw 'error writing file: ' + err;

                fs.close(fd, function() {
                    console.log("file written");
                });
            });
        });
    }

    class DdqBackendMock extends EventEmitter {
        constructor() {
            super();
            this.config = config;
            this.poller = null;
        }

        getWrappedMessage() {
            var file, files, keys;

            files = readData();
            keys = Object.keys(files);

            if (keys.length) {
                file = files[keys[keys.length * Math.random() << 0]];

                if (file) {
                    return {
                        heartbeat: this.heartbeat,
                        message: file.message,
                        requeue: this.requeue,
                        remove: this.remove,
                        original: file
                    };
                }
            }

            return null;
        }

        close (callback) {
            callback();
        }

        connect () {
            console.log("Connecting to database...");
        }

        heartbeat(callback) {
            callback();
        }

        remove (messageId) {
            console.log(`Removing: ${messageId}`);
            var compiledData;

            compiledData = readData();
            delete compiledData[messageId];
            writeData(compiledData);
        }

        requeue (messageId) {
            console.log(`Requeuing: ${messageId}`);
            var compiledData;

            compiledData = readData();
            compiledData[messageId].requeued = true;
            writeData(compiledData);
        }

        /**
         * Sends the message off to the file.
         *
         * @param {*} message
         * @param {Function} callback
         */
        sendMessage (message, callback) {
            var compiledData, finalMessage;

            finalMessage = {};
            finalMessage.id = crypto.createHash('sha256').update(message).digest("hex");
            finalMessage.message = message;
            finalMessage.owner = null;
            finalMessage.isProcessing = false;
            finalMessage.requeued = false;
            finalMessage.heartbeatTime = null;
            compiledData = readData();
            compiledData[finalMessage.id] = finalMessage;
            writeData(compiledData);
        }


        /**
         * Hey Listen()!
         *
         * Sets up the listeners for the backend and initiates the polling.
         *
         * @return {EventEmitter}
         */
        listen () {
            this.startPolling();
        }


        /**
         * For times when polling needs to pause so no more messages are sent.
         */
        pausePolling () {
            timers.clearInterval(this.poller);
            this.poller = null;
        }

        resumePolling () {
            console.log("Pausing Polling...");
            this.startPolling();
        }


        /**
         * Starts polling for data. If data isfound it emits "data" so DDQ knows
         * to take it's action for finding a piece of data.
         */
        startPolling () {
            console.log("Polling for data...");
            this.poller = timers.setInterval(() => {
                var grabbedMessage;

                // Looks for a message.
                grabbedMessage = this.getWrappedMessage();

                // If we have a message we return the wrapped message.
                // DDQ will handle what to do with the wrapped message.
                if (grabbedMessage) {
                    this.emit(EMIT_DATA, grabbedMessage);
                }
            }, this.config.pollingDelay);
        }


        setHeartbeat (data) {
            var compiledData;

            compiledData = readData();
            compiledData[data.heartbeatTime] = new Date();
            writeData(compiledData);

            return true;
        }

        splitData (data) {
            return data.toString().split("\n");
        }
    }

    return new DdqBackendMock();
};
