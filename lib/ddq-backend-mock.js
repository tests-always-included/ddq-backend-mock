"use strict";

/**
 * This is a fake backend for DDQ for testing it out. There are a lot of
 * console.log statements in here to give the sense of what it is doing when
 * testing out the functionality of DDQ.
 */
const EMIT_DATA = "data", EMIT_ERROR = "error";

module.exports = function(config, crypto, EventEmitter, fs, timers) {
    // sample for heartbeat
    function heartbeat(ddqBackendInstance, recordId, callback) {
        // Need to get the ID asynchronously.  :-(
        ddqBackendInstance.getId((instanceId) => {
            var record;

            if (! instanceId) {
                ddqBackendInstance.emit(new Error("Could not make instance id"));
            }


            record = ddqBackendInstance.getRecord(recordId);
            record.owner = instanceId;
            record.heartbeatDate = new Date().toISOString();
            ddqBackendInstance.writeRecord(record);
            callback();
        });
    }


    function remove(ddqBackendInstance, recordId) {
        // Note, this is not what we want.
        // it does not handle the times when the
        // whatever flag is true.
        ddqBackendInstance.deleteData(recordId);
    }



    function requeue(ddqBackendInstance, recordId) {
        var record;

        record = ddqBackendInstance.getRecord(recordId);
        record.recordId.owner = null;
        record.recordId.isProcessing = false;
        record.recordId.requeued = true;

    }

    class DdqBackendMock extends EventEmitter {
        constructor() {
            super();
            this.config = config;
            this.instanceId = null;
            this.storedData = {};
            this.poller = null;
        }

        getWrappedMessage() {
            var file, files, keys;

            files = this.readData();
            keys = Object.keys(files);

            if (keys.length) {
                file = files[keys[keys.length * Math.random() << 0]];

                if (file && !file.isProcessing) {
                    files[file.id].isProcessing = true;
                    this.writeRecord(file);

                    return {
                        heartbeat: heartbeat.bind(null, this, file.id),
                        message: file.message,
                        requeue: requeue.bind(null, this, file.id),
                        remove: remove.bind(null, this, file.id)
                    };
                }
            }

            return null;
        }


        close(callback) {
            this.removeListener(EMIT_DATA, () => {});
            this.removeListener(EMIT_ERROR, () => {});

            if (this.config.closeFail) {
                callback(new Error("Could not close connection."));
            } else {

                callback();
            }
        }


        connect() {
            console.log("Connecting to database...");
        }


        deleteData(record) {
            delete this.storedData[record.id];
        }


        /**
         * Want to make an instance id and return if we need to.
         *
         * @param {Function} callback
         */
        getId(callback) {
            if (this.instanceId) {
                callback(this.instanceId);
            } else {
                crypto.randomBytes(16, (err, id) => {
                    if (err) {
                        callback();
                    }
                    this.instanceId = id.toString("hex");
                    callback(id);
                });
            }
        }


        /**
         * Gets a particular record from stored data.
         *
         * @param {string} recordId
         * @return {(Ddq~record|null)} not finding a record returns nothing
         */
        getRecord(recordId) {
            if (this.storedData[recordId]) {
                return this.storedData[recordId];
            }

            return null;
        }


        /**
         * Gets the stored data or a particular one beind searched for.
         *
         * @return {Object} could be all records or just one record
         */
        readData () {
            return this.storedData;
        }


        /**
         * Sends the message off to the file.
         *
         * @param {*} message
         * @param {Function} callback
         */
        sendMessage (message, callback) {
            var finalMessage;

            if (this.config.sendFail) {
                return callback(new Error("Could not send"));
            }

            finalMessage = {};
            finalMessage.id = crypto.createHash("sha256").update(message).digest("hex");
            finalMessage.message = message;
            finalMessage.owner = null;
            finalMessage.isProcessing = false;
            finalMessage.requeued = false;
            finalMessage.heartbeatTime = null;
            this.writeRecord(finalMessage);

            return callback();
        }



        /**
         * Writes a record.
         *
         * @param {Ddq~record} record
         */
        writeRecord(record) {
            this.storedData[record.id] = record;
        }


        /**
         * Hey Listen()!
         *
         * Sets up the listeners for the backend and initiates the polling.
         *
         * @return {EventEmitter}
         */
        listen () {
            if (!this.config.noPolling) {
                this.startPolling();
            }
        }


        /**
         * For times when polling needs to pause so no more messages are sent.
         */
        pausePolling () {
            timers.clearInterval(this.poller);
            this.poller = null;
        }

        resumePolling () {
            this.startPolling();
        }


        /**
         * Starts polling for data. If data isfound it emits "data" so DDQ knows
         * to take it's action for finding a piece of data.
         */
        startPolling () {
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
    }

    return new DdqBackendMock();
};
