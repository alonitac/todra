import * as AWS from "aws-sdk";
const config = require('config');
const binance = require('node-binance-api')().options({
    APIKEY: '<key>',
    APISECRET: '<secret>',
    useServerTime: true
});

const credentials = new AWS.SharedIniFileCredentials({profile: 'alonit-account'});
AWS.config.credentials = credentials;
AWS.config.update({
    region: "ap-southeast-1",
});
const dynamo = new AWS.DynamoDB.DocumentClient();

binance.websockets.depth(config.get("symbols"), (depth) => {
    let {e:eventType, E:eventTime, s:symbol, u:finalUpdateId, U:firstUpdateId, b:bidDepth, a:askDepth} = depth;
    const params = {
        TableName: config.get("binanceTableName"),
        Item: {
            "eventId": 1234567,
            "symbol": symbol,
            "eventTime":  eventTime,
            "bidDepth": bidDepth,
            "askDepth":  askDepth
        }
    };

    dynamo.put(params, function(err, data) {
        if (err) {
            console.error("Failed. Error JSON:", JSON.stringify(err, null, 2));
        } else {
            console.log("PutItem succeeded:", firstUpdateId, " to ", finalUpdateId);
        }
    });
});
