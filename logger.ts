import * as AWS from "aws-sdk";
const config = require('config');
import * as winston from 'winston';
import WinstonCloudWatch from 'winston-cloudwatch';
const credentials = new AWS.SharedIniFileCredentials({profile: 'alonit-account'});
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'user-service' },
    transports: [
        new winston.transports.Console()
    ]
});

logger.add(new WinstonCloudWatch({
    logGroupName: 'testing',
    logStreamName: 'first',
    awsAccessKeyId: credentials.accessKeyId,
    awsSecretKey: credentials.secretAccessKey,
    awsRegion: "ap-southeast-1"
}));

module.exports = logger;