"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var AWS = require("aws-sdk");
var config = require('config');
var winston = require("winston");
var winston_cloudwatch_1 = require("winston-cloudwatch");
var credentials = new AWS.SharedIniFileCredentials({ profile: 'alonit-account' });
var logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'user-service' },
    transports: [
        new winston.transports.Console()
    ]
});
logger.add(new winston_cloudwatch_1.default({
    logGroupName: 'testing',
    logStreamName: 'first',
    awsAccessKeyId: credentials.accessKeyId,
    awsSecretKey: credentials.secretAccessKey,
    awsRegion: "ap-southeast-1"
}));
module.exports = logger;
//# sourceMappingURL=logger.js.map