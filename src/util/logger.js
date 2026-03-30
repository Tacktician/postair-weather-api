/**
 * Configurations of loggers.
 */
const winston = require('winston');
const winstonRotator = require('winston-daily-rotate-file');
const path = require('path');

let colorizedFormat = winston.format.combine(
    winston.format.colorize({
        all:true
    }),
    winston.format.timestamp({
        format:"YY-MM-DD HH:mm:ss"
    }),
    winston.format.printf(
        info => `${info.timestamp}  [${info.level}] - [${info.label}]: ${info.message}`
    )
);

let defaultFormat = winston.format.combine(
    winston.format.timestamp({
        format:"YY-MM-DD HH:mm:ss"
    }),
    winston.format.printf(
        info => `${info.timestamp}  [${info.level}] - [${info.label}]: ${info.message}`
    )
)
// Return the last folder name in the path and the calling
// module's filename.
const getLabel = function(callingModule) {
    const parts = callingModule.filename.split(path.sep);
    return path.join(parts[parts.length - 2], parts.pop());
};

const cLogger = function (callingModule) {
    return winston.createLogger({
        transports: [
            new winston.transports.Console({
                format: winston.format.combine(winston.format.colorize(), winston.format.label({label: getLabel(callingModule)}), colorizedFormat)
            }),
            new winstonRotator({
                label: getLabel(callingModule),
                format: winston.format.combine(winston.format.label({label: getLabel(callingModule)}), defaultFormat),
                filename: './logs/challenge-%DATE%.log',
                datePattern: 'YYYY-MM-DD',
            })
        ]
    });
};

const sLogger = function (callingModule) {
    return winston.createLogger({
        transports: [
            new winston.transports.Console({
                format: winston.format.combine(winston.format.colorize(), winston.format.label({label: getLabel(callingModule)}), colorizedFormat)
            }),
            new winstonRotator({
                label: getLabel(callingModule),
                format: winston.format.combine(winston.format.label({label: getLabel(callingModule)}), defaultFormat),
                filename: './logs/simulation-%DATE%.log',
                datePattern: 'YYYY-MM-DD',
            })
        ]
    });
};

const dLogger = function (callingModule) {
    return winston.createLogger({
        transports: [
            new winston.transports.Console({
                format: winston.format.combine(winston.format.colorize(), winston.format.label({label: getLabel(callingModule)}), colorizedFormat)
            }),
            new winstonRotator({
                label: getLabel(callingModule),
                format: winston.format.combine(winston.format.label({label: getLabel(callingModule)}), defaultFormat),
                filename: './logs/demo-%DATE%.log',
                datePattern: 'YYYY-MM-DD',
            })
        ]
    });
};

const connectorLogger = function (callingModule) {
    return winston.createLogger({
        transports: [
            new winston.transports.Console({
                format: winston.format.combine(winston.format.colorize(), winston.format.label({label: getLabel(callingModule)}), colorizedFormat)
            }),
            new winstonRotator({
                label: getLabel(callingModule),
                format: winston.format.combine(winston.format.label({label: getLabel(callingModule)}), defaultFormat),
                filename: './logs/connector-%DATE%.log',
                datePattern: 'YYYY-MM-DD',
            })
        ]
    });
};

const securityLogger = function (callingModule) {
    return winston.createLogger({
        transports: [
            new winston.transports.Console({
                format: winston.format.combine(winston.format.colorize(), winston.format.label({label: getLabel(callingModule)}), colorizedFormat)
            }),
            new winstonRotator({
                label: getLabel(callingModule),
                format: winston.format.combine(winston.format.label({label: getLabel(callingModule)}), defaultFormat),
                filename: './logs/security-%DATE%.log',
                datePattern: 'YYYY-MM-DD',
            })
        ]
    });
};

module.exports = {
    'challengeLogger': cLogger,
    'demoLogger': dLogger,
    'connectorLogger': connectorLogger,
    'securityLogger': securityLogger,
    'simulationLogger' : sLogger
};