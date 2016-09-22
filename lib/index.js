"use strict";

var crypto, ddqBackendMock, EventEmitter, fs, timers;

crypto = require("crypto");
ddqBackendMock = require("./ddq-backend-mock");
EventEmitter = require("events");
fs = require("fs");
timers = require("timers");
module.exports = (config) => {
    return ddqBackendMock(config, crypto, EventEmitter, fs, timers);
};
