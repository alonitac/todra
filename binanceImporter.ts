const winston = require('winston');
const WinstonCloudWatch = require('winston-cloudwatch');
import * as AWS from "aws-sdk";
const config = require('config');

const credentials = new AWS.SharedIniFileCredentials({profile: 'alonit-account'});
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console(),
        new WinstonCloudWatch({
            logGroupName: 'data-collection',
            logStreamName: 'binance-lob',
            awsAccessKeyId: credentials.accessKeyId,
            awsSecretKey: credentials.secretAccessKey,
            awsRegion: "ap-southeast-1"
        })
    ]
});

const binance = require('node-binance-api')().options({
    APIKEY: '<key>',
    APISECRET: '<secret>',
    useServerTime: true
});

AWS.config.credentials = credentials;
AWS.config.update({
    region: "ap-southeast-1",
});
const dynamo = new AWS.DynamoDB.DocumentClient();

binance.websockets.depth(config.get("symbols"), (depth) => {
    let {e:eventType, E:eventTime, s:symbol, u:finalUpdateId, U:firstUpdateId, b:bidDepth, a:askDepth} = depth;
    const params = {
        TableName: config.get("binance-lob-updates-table-name"),
        Item: {
            "firstUpdateId": firstUpdateId,
            "finalUpdateId": finalUpdateId,
            "symbol": symbol,
            "eventTime":  eventTime,
            "bidDepth": bidDepth,
            "askDepth":  askDepth
        }
    };

    dynamo.put(params, function(err, data) {
        if (err) {
            logger.error(`Failed. Error JSON:${JSON.stringify(err, null, 2)}`);
        } else {
            logger.info(`lob update ${JSON.stringify({'symbol':symbol, 'fromId': firstUpdateId, 'toId': finalUpdateId})}`);
        }
    });
});

function takeSnapshot() {
    const symbols = config.get("symbols");
    symbols.forEach(function(element) {
        binance.depth(element, (error, depth, symbol) => {
            const params = {
                TableName: config.get("binance-lob-snapshots-table-name"),
                Item: {
                    "lastUpdateId": depth.lastUpdateId,
                    "symbol": symbol,
                    "bids": depth.bids,
                    "asks": depth.asks
                }
            };
            dynamo.put(params, function(err, data) {
                if (err) {
                    logger.error(`Failed. Error JSON: ${JSON.stringify(err, null, 2)}`);
                } else {
                    logger.info(`lob snapshot: ${JSON.stringify({'symbol': symbol, 'lastUpdateId': depth.lastUpdateId})}`);
                }
            });
        }, 1000);
    });
    setTimeout(takeSnapshot, config.get("snapshots-periodicity-ms"));
}

setTimeout(takeSnapshot, 5000);
