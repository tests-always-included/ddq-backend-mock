"use strict";

/**
 * @typedef {Object} DdqBackend~record
 * @property {(Date|null)} heartbeatTime
 * @property {string} id
 * @property {boolean} isProcessing
 * @property {string} message
 * @property {boolean} requeued
 */


/**
 * What the backend sets up and sends to the frontend.
 *
 * @typedef {Object} Ddq~wrappedMessage
 * @property {Function} heartbeat
 * @property {string} message
 * @property {Function} remove
 * @property {Function} requeue
 * @property {string} topic
 */

/**
 * This is a fake backend for DDQ for testing it out. There are a lot of
 * console.log statements in here to give the sense of what it is doing when
 * testing out the functionality of DDQ.
 */
const EMIT_DATA = "data";

module.exports = (crypto, EventEmitter, fs, timers) => {
    /**
     * @param {Object} ddqBackendInstance
     * @param {string} recordId
     * @param {Function} callback
     */
    function heartbeat(ddqBackendInstance, recordId, callback) {
        var err, record;

        record = ddqBackendInstance.getRecord(recordId);

        if (record) {
            record.heartbeatDate = new Date().toISOString();
        } else {
            err = new Error("Could not find a record.");
        }

        callback(err);
    }


    /**
     * Removes the message from stored data.
     *
     * @param {Object} ddqBackendInstance
     * @param {string} recordId
     * @param {Function} callback
     */
    function remove(ddqBackendInstance, recordId, callback) {
        // Note, this is not what we want.
        // it does not handle the times when the
        // isProcessing flag is true.
        ddqBackendInstance.deleteData(recordId);
        ddqBackendInstance.checkAndEmitData();
        callback();
    }


    /**
     * Sets the record to be requeued so another listener can pick it up
     * and try to process the message again.
     *
     * @param {Object} ddqBackendInstance
     * @param {string} recordId
     * @param {Function} callback
     */
    function requeue(ddqBackendInstance, recordId, callback) {
        var record;

        record = ddqBackendInstance.getRecord(recordId);
        record.isProcessing = false;
        record.requeued = true;
        callback();
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
            this.closeFail = backendConfig.closeFail;
            this.connection = false;
            this.isPaused = false;
            this.noPolling = backendConfig.noPolling;
            this.poller = null;
            this.pollingDelayMs = backendConfig.pollingDelayMs;
            this.sendFail = backendConfig.sendFail;
            this.storedData = {};
            this.topics = backendConfig.topics;
        }


        /**
         * @param {Function} callback
         */
        disconnect(callback) {
            if (this.closeFail) {
                callback(new Error("Could not close connection."));
            } else {
                callback();
            }
        }


        /**
         * Sets the connection flag.
         *
         * @param {Function} callback
         */
        connect(callback) {
            this.connection = true;
            callback();
        }


        /**
         * @param {Object} record
         */
        deleteData(record) {
            delete this.storedData[record.id];
        }


        /**
         * Checks for data and tell the listener there is data.
         *
         * @return {boolean}
         */
        checkAndEmitData() {
            var wrappedMessage;

            wrappedMessage = this.getWrappedMessage();

            if (wrappedMessage) {
                this.emit(EMIT_DATA, wrappedMessage);

                return true;
            }

            return false;
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
            var keys, notProcessing, record, records;

            records = this.readData();
            keys = Object.keys(records);
            notProcessing = [];

            if (keys.length) {
                keys.map((key) => {
                    if (!records[key].isProcessing) {
                        notProcessing.push(records[key]);
                    }

                    return true;
                });

                if (notProcessing.length) {
                    notProcessing.sort(() => {
                        return 0.5 - Math.random();
                    });
                    record = notProcessing[0];
                    record.isProcessing = true;

                    return {
                        heartbeat: heartbeat.bind(null, this, record.id),
                        message: record.message,
                        remove: remove.bind(null, this, record.id),
                        requeue: requeue.bind(null, this, record.id),
                        topic: record.topic
                    };
                }
            }

            return null;
        }


        /**
         * For times when polling needs to pause so no more messages are sent.
         *
         * @param {Function} callback
         */
        stopListening(callback) {
            this.isPaused = true;
            timers.clearTimeout(this.poller);
            this.poller = null;

            if (callback) {
                callback();
            }
        }


        /**
         * Gets the stored data.
         *
         * @return {Object} all records
         */
        readData() {
            return this.storedData;
        }


        /**
         * Sends a record off to storage.
         *
         * @param {Function} callback
         * @param {*} message
         * @param {string} topic
         */
        sendMessage(callback, message, topic) {
            var finalMessage;

            if (this.sendFail) {
                callback(new Error("Could not send"));
            } else {
                finalMessage = {};
                finalMessage.heartbeatTime = null;
                finalMessage.id = crypto.createHash("sha256").update(message).digest("hex");
                finalMessage.isProcessing = false;
                finalMessage.message = message;
                finalMessage.requeued = false;
                finalMessage.topic = topic;
                this.storedData[finalMessage.id] = finalMessage;

                callback();
            }
        }


        /**
         * Starts listening for data. If data is found it emits "data" so DDQ
         * knows to take it's action for finding a piece of data.
         *
         * @param {Function} callback
         */
        startListening(callback) {
            var that;

            this.isPaused = false;
            that = this;

            /**
             * Finds data for the polling until polling is either paused or
             * the there is no more data to emit.
             */
            function findData() {
                while (!that.isPaused) {
                    // If there wasn't data to emit, then we want to break
                    // out of the while loop.
                    if (!that.checkAndEmitData()) {
                        break;
                    }
                }

                that.poller = setTimeout(findData, that.pollingDelayMs);
            }
            this.poller = setTimeout(findData, this.pollingDelayMs);

            if (callback) {
                callback();
            }
        }
    }

    return DdqBackendMock;
};
