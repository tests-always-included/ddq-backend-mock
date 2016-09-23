"use strict";

/**
 * @typeDef {Object} DdqBackend~record
 * @property {(string|null)} heartbeatTime
 * @property {string} id
 * @property {boolean} isProcessing
 * @property {string} message
 * @property {(string|null)} owner
 * @property {boolean} requeued
 */


/**
 * What the backend sets up and sends to the frontend.
 *
 * @typeDef {Object} Ddq~wrappedMessage
 * @property {Ddq~config} config
 * @property {Function} heartbeat
 * @property {string} message
 * @property {Function} remove
 * @property {Function} requeue
 */

/**
 * This is a fake backend for DDQ for testing it out. There are a lot of
 * console.log statements in here to give the sense of what it is doing when
 * testing out the functionality of DDQ.
 */
const EMIT_DATA = "data";

module.exports = function (config, crypto, EventEmitter, fs, timers) {
    /**
     * @param {Object} ddqBackendInstance
     * @param {string} recordId
     * @param {Function} callback
     */
    function heartbeat(ddqBackendInstance, recordId, callback) {
        // Need to get the ID asynchronously.  :-(
        ddqBackendInstance.getId((instanceId) => {
            var record;

            if (!instanceId) {
                ddqBackendInstance.emit(new Error("Could not make instance id"));
            }

            record = ddqBackendInstance.getRecord(recordId);
            record.owner = instanceId;
            record.heartbeatDate = new Date().toISOString();
            ddqBackendInstance.writeRecord(record);
            callback();
        });
    }


    /**
     * @param {Object} ddqBackendInstance
     * @param {string} recordId
     */
    function remove(ddqBackendInstance, recordId) {
        // Note, this is not what we want.
        // it does not handle the times when the
        // isProcessing flag is true.
        ddqBackendInstance.deleteData(recordId);
    }


    /**
     * @param {Object} ddqBackendInstance
     * @param {string} recordId
     */
    function requeue(ddqBackendInstance, recordId) {
        var record;

        record = ddqBackendInstance.getRecord(recordId);
        record.recordId.owner = null;
        record.recordId.isProcessing = false;
        record.recordId.requeued = true;
    }


    /**
     *
     */
    class DdqBackendMock extends EventEmitter {
        /**
         * @param {Object} backendConfig
         */
        constructor(backendConfig) {
            super();
            this.config = backendConfig;
            this.instanceId = null;
            this.storedData = {};
            this.poller = null;
        }


        /**
         * @param {Function} callback
         */
        close(callback) {
            if (this.config.closeFail) {
                callback(new Error("Could not close connection."));
            } else {
                callback();
            }
        }


        /**
         *
         */
        connect() {
            console.log("Connecting to database...");
        }


        /**
         * @param {Object} record
         */
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
         * Looks to see if there are any messages in the storeData and creates
         * the wrapped message.
         *
         * @return {(Ddq~wrappedMessage|null)}
         */
        getWrappedMessage() {
            var file, files, keys;

            files = this.readData();
            keys = Object.keys(files);

            if (keys.length) {
                // eslint-disable-next-line no-bitwise
                file = files[keys[keys.length * Math.random() << 0]];

                if (file && !file.isProcessing) {
                    files[file.id].isProcessing = true;
                    this.writeRecord(file);

                    return {
                        heartbeat: heartbeat.bind(null, this, file.id),
                        message: file.message,
                        remove: remove.bind(null, this, file.id),
                        requeue: requeue.bind(null, this, file.id)
                    };
                }
            }

            return null;
        }


        /**
         * Hey Listen!
         * Initiates the polling.
         */
        listen() {
            if (!this.config.noPolling) {
                this.startPolling();
            }
        }


        /**
         * For times when polling needs to pause so no more messages are sent.
         */
        pausePolling() {
            timers.clearInterval(this.poller);
            this.poller = null;
        }


        /**
         * Gets the stored data or a particular one beind searched for.
         *
         * @return {Object} all records
         */
        readData() {
            return this.storedData;
        }


        /**
         * Resumes, starts polling.
         */
        resumePolling() {
            this.startPolling();
        }


        /**
         * Sends a record off to storage.
         *
         * @param {*} message
         * @param {Function} callback
         */
        sendMessage(message, callback) {
            var finalMessage;

            if (this.config.sendFail) {
                callback(new Error("Could not send"));
            } else {
                finalMessage = {};
                finalMessage.heartbeatTime = null;
                finalMessage.id = crypto.createHash("sha256").update(message).digest("hex");
                finalMessage.isProcessing = false;
                finalMessage.message = message;
                finalMessage.owner = null;
                finalMessage.requeued = false;
                this.writeRecord(finalMessage);

                callback();
            }
        }


        /**
         * Starts polling for data. If data isfound it emits "data" so DDQ knows
         * to take it's action for finding a piece of data.
         */
        startPolling() {
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


        /**
         * Writes a record.
         *
         * @param {DdqBackend~record} record
         */
        writeRecord(record) {
            this.storedData[record.id] = record;
        }
    }

    return new DdqBackendMock(config);
};
