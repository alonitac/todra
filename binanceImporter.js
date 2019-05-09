"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
var winston = require('winston');
var WinstonCloudWatch = require('winston-cloudwatch');
var AWS = require("aws-sdk");
var config = require('config');
var MongoClient = require('mongodb').MongoClient;
var binance = require('node-binance-api')().options({
    APIKEY: '<key>',
    APISECRET: '<secret>',
    useServerTime: true
});
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
var mongodb = null;
var client = new MongoClient(config.get("mongo-uri"), { useNewUrlParser: true });
client.connect(function (err) {
    if (err) {
        logger.error('unable to connect to mongo');
    }
    else {
        logger.info('successfully connected to mongo');
        mongodb = client.db(config.get("mongo-db-name"));
    }
    // client.close();
});
AWS.config.credentials = credentials;
AWS.config.update({
    region: "ap-southeast-1",
});
var dynamo = new AWS.DynamoDB.DocumentClient();
binance.websockets.depth(config.get("symbols"), function (depth) { return __awaiter(_this, void 0, void 0, function () {
    var eventType, eventTime, symbol, finalUpdateId, firstUpdateId, bidDepth, askDepth, params, r;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                eventType = depth.e, eventTime = depth.E, symbol = depth.s, finalUpdateId = depth.u, firstUpdateId = depth.U, bidDepth = depth.b, askDepth = depth.a;
                params = {
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
                        logger.error("Update depth failed:" + JSON.stringify(err, null, 2));
                    }
                    // else {
                    //     logger.info(`lob update ${JSON.stringify({'symbol':symbol, 'fromId': firstUpdateId, 'toId': finalUpdateId})}`);
                    // }
                });
                return [4 /*yield*/, mongodb.collection(symbol).insertOne({
                        "firstUpdateId": firstUpdateId,
                        "finalUpdateId": finalUpdateId
                    })];
            case 1:
                r = _a.sent();
                return [2 /*return*/];
        }
    });
}); });
function takeSnapshot(symbol, lastSnapId) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            binance.depth(symbol, function (error, depth, symbol) { return __awaiter(_this, void 0, void 0, function () {
                var params;
                return __generator(this, function (_a) {
                    setTimeout(takeSnapshot.bind(null, symbol, depth.lastUpdateId), config.get("snapshots-periodicity-ms"));
                    params = {
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
                            logger.error("snapshot failed: " + JSON.stringify(err, null, 2));
                        }
                    });
                    validateConsistency(symbol, lastSnapId, depth.lastUpdateId);
                    return [2 /*return*/];
                });
            }); }, 1000);
            return [2 /*return*/];
        });
    });
}
function validateConsistency(symbol, firstUpdateId, lastUpdateId) {
    return __awaiter(this, void 0, void 0, function () {
        var r, lastId, firstId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, mongodb.collection(symbol).find({
                        finalUpdateId: { $gte: firstUpdateId },
                        firstUpdateId: { $lte: lastUpdateId }
                    }).sort({ firstUpdateId: 1 })];
                case 1:
                    r = _a.sent();
                    lastId = null;
                    firstId = null;
                    return [4 /*yield*/, r.forEach(function (doc) {
                            if (lastId) {
                                if (!doc.firstUpdateId === lastId + 1) {
                                    logger.info("expect " + (lastId + 1) + " but got " + doc.firstUpdateId);
                                }
                            }
                            else {
                                firstId = doc.firstUpdateId;
                            }
                            lastId = doc.finalUpdateId;
                        })];
                case 2:
                    _a.sent();
                    logger.info("data is consistency. " + firstId + " - " + lastId);
                    mongodb.collection(symbol).remove({
                        finalUpdateId: { $gte: firstUpdateId },
                        firstUpdateId: { $lte: lastUpdateId }
                    });
                    return [2 /*return*/];
            }
        });
    });
}
var symbols = config.get("symbols");
symbols.forEach(function (symbol) {
    setTimeout(takeSnapshot.bind(null, symbol, 0), 5000);
});
//# sourceMappingURL=binanceImporter.js.map