const winston = require('winston');
const WinstonCloudWatch = require('winston-cloudwatch');
import * as AWS from "aws-sdk";
const config = require('config');
const MongoClient = require('mongodb').MongoClient;
const binance = require('node-binance-api')().options({
    APIKEY: '<key>',
    APISECRET: '<secret>',
    useServerTime: true
});

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

let mongodb = null;
const client = new MongoClient(config.get("mongo-uri"), { useNewUrlParser: true });
client.connect(function(err) {
    if (err){
        logger.error('unable to connect to mongo');
    }else{
        logger.info('successfully connected to mongo');
        mongodb = client.db(config.get("mongo-db-name"));
    }
    // client.close();
});

AWS.config.credentials = credentials;
AWS.config.update({
    region: "ap-southeast-1",
});
const dynamo = new AWS.DynamoDB.DocumentClient();

binance.websockets.depth(config.get("symbols"), async (depth) => {
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
            logger.error(`Update depth failed:${JSON.stringify(err, null, 2)}`);
        }
        // else {
        //     logger.info(`lob update ${JSON.stringify({'symbol':symbol, 'fromId': firstUpdateId, 'toId': finalUpdateId})}`);
        // }
    });
    let r = await mongodb.collection(symbol).insertOne({
        "firstUpdateId": firstUpdateId,
        "finalUpdateId": finalUpdateId
    });
});

async function takeSnapshot(symbol, lastSnapId) {
    binance.depth(symbol, async (error, depth, symbol) => {
        setTimeout(takeSnapshot.bind(null, symbol, depth.lastUpdateId), config.get("snapshots-periodicity-ms"));
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
                logger.error(`snapshot failed: ${JSON.stringify(err, null, 2)}`);
            }
        });
        validateConsistency(symbol, lastSnapId, depth.lastUpdateId);
    }, 1000);
}

async function validateConsistency(symbol, firstUpdateId, lastUpdateId) {
    let r = await mongodb.collection(symbol).find(
        {
            finalUpdateId: { $gte: firstUpdateId },
            firstUpdateId: { $lte: lastUpdateId }
        }
    ).sort({ firstUpdateId: 1 });
    let lastId = null;
    let firstId = null;
    await r.forEach((doc) => {
        if (lastId){
            if (!doc.firstUpdateId === lastId + 1){
                logger.info(`expect ${lastId + 1} but got ${doc.firstUpdateId}`);
            }
        }else{
            firstId = doc.firstUpdateId;
        }
        lastId = doc.finalUpdateId;
    });
    logger.info(`data is consistency. ${firstId} - ${lastId}`);
    mongodb.collection(symbol).remove(
        {
            finalUpdateId: { $gte: firstUpdateId },
            firstUpdateId: { $lte: lastUpdateId }
        }
    );
}

const symbols = config.get("symbols");
symbols.forEach(function(symbol) {
    setTimeout(takeSnapshot.bind(null, symbol, 0), 5000);
});