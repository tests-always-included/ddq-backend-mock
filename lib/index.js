"use strict";

var crypto, EventEmitter, fs, timers;

crypto = require("crypto");
EventEmitter = require("events");
fs = require("fs");
timers = require("timers");
module.exports = require("./ddq-backend-mock")(crypto, EventEmitter, fs, timers);
