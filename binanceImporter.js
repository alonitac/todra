"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var winston = require('winston');
var WinstonCloudWatch = require('winston-cloudwatch');
var AWS = require("aws-sdk");
var config = require('config');
var credentials = new AWS.SharedIniFileCredentials({ profile: 'alonit-account' });
var logger = winston.createLogger({
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
var binance = require('node-binance-api')().options({
    APIKEY: '<key>',
    APISECRET: '<secret>',
    useServerTime: true
});
AWS.config.credentials = credentials;
AWS.config.update({
    region: "ap-southeast-1",
});
var dynamo = new AWS.DynamoDB.DocumentClient();
binance.websockets.depth(config.get("symbols"), function (depth) {
    var eventType = depth.e, eventTime = depth.E, symbol = depth.s, finalUpdateId = depth.u, firstUpdateId = depth.U, bidDepth = depth.b, askDepth = depth.a;
    var params = {
        TableName: config.get("binance-lob-updates-table-name"),
        Item: {
            "firstUpdateId": firstUpdateId,
            "finalUpdateId": finalUpdateId,
            "symbol": symbol,
            "eventTime": eventTime,
            "bidDepth": bidDepth,
            "askDepth": askDepth
        }
    };
    dynamo.put(params, function (err, data) {
        if (err) {
            logger.error("Failed. Error JSON:" + JSON.stringify(err, null, 2));
        }
        else {
            logger.info("lob update " + JSON.stringify({ 'symbol': symbol, 'fromId': firstUpdateId, 'toId': finalUpdateId }));
        }
    });
});
function takeSnapshot() {
    var symbols = config.get("symbols");
    symbols.forEach(function (element) {
        binance.depth(element, function (error, depth, symbol) {
            var params = {
                TableName: config.get("binance-lob-snapshots-table-name"),
                Item: {
                    "lastUpdateId": depth.lastUpdateId,
                    "symbol": symbol,
                    "bids": depth.bids,
                    "asks": depth.asks
                }
            };
            dynamo.put(params, function (err, data) {
                if (err) {
                    logger.error("Failed. Error JSON: " + JSON.stringify(err, null, 2));
                }
                else {
                    logger.info("lob snapshot: " + JSON.stringify({ 'symbol': symbol, 'lastUpdateId': depth.lastUpdateId }));
                }
            });
        }, 1000);
    });
    setTimeout(takeSnapshot, config.get("snapshots-periodicity-ms"));
}
setTimeout(takeSnapshot, 5000);
//# sourceMappingURL=binanceImporter.js.map