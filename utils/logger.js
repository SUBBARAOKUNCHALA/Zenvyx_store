const winston = require("winston");
require("winston-daily-rotate-file");

const DailyRotateFile = require("winston-daily-rotate-file");

const errorTransport = new DailyRotateFile({
    filename: "logs/error/%DATE%-error.log",
    datePattern: "YYYY-MM-DD",
    level: "error",
    maxFiles: "30d"
});

const successTransport = new DailyRotateFile({
    filename: "logs/success/%DATE%-success.log",
    datePattern: "YYYY-MM-DD",
    level: "info",
    maxFiles: "30d"
});

const logger = winston.createLogger({
    transports: [
        errorTransport,
        successTransport,
        new winston.transports.Console()
    ]
});

module.exports = logger;