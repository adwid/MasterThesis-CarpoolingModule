const { v1: uuid } = require('uuid');
const axios = require('axios');
const actorHandler = require('./actorHandler');
const db = require('./dbHandler');

function forwardErrorMessage(actor, rideID, type, message) {
    send(actor, {
        "url": rideID,
        "type": "error",
        "error": type + ":::" + message,
    }).then(_ => {
        console.log("Event \'" + type + "\': user's error detected and handled");
    });
}

function forwardJoinOrLeaveMessage(type, from, dbResponse) {
    return Promise.all([
        send(dbResponse.driver, {"url": dbResponse.rideID, "from": from, "type": type}),
        send(dbResponse.user, {"url": dbResponse.rideID, "from": from, "type": type === "join" ? "joined" : "leaved"})
    ]);
}

function forwardManageMessage(type, from, updateResult) {
    return Promise.all([
        send(updateResult.driver, {"url": updateResult.rideID, "from": from, "type": "manage"}),
        sendMany(updateResult.rejected, {"url": updateResult.rideID, "from": from, "type": "reject"}),
        sendMany(updateResult.accepted, {"url": updateResult.rideID, "from": from, "type": "accept"}),
    ])
}

function forwardToDriver(type, from, dbObject) {
    return send(dbObject.driver, {"url": dbObject._id, "from":from, "type": type});
}

function send(actor, content) {
    const activity = objectToActivity(actor, content);
    return actorHandler.getInboxAddresses(actor)
        .then(addr => {
            if (addr.length === 0) return Promise.reject("(send) no inbox addr found.");
            return db.storeActivity(activity).then(_ => { return addr[0] });
        })
        .then(addr => {
            return axios.post(addr, activity)
        })
        .catch(err => {
            console.error("[ERR] unable to send message (" + actor + ") : " + err)
            return Promise.resolve();
        });
}

function sendMany(actors, content) {
    const promises = [];
    for (const actor of actors)
        promises.push(send(actor, content));
    return Promise.all(promises);
}

function objectToActivity(to, content) {
    const secretary = process.env.PREFIX + process.env.HOST + ":" + process.env.CARPOOLING_QUERIER_PORT + '/carpooling/secretary';
    return {
        "@context": "https://www.w3.org/ns/activitystreams",
        "id": process.env.PREFIX + process.env.HOST + ":" + process.env.CARPOOLING_QUERIER_PORT + "/carpooling/message/" + uuid(),
        "type": "Create",
        "to": to,
        "actor": secretary,
        "published": (new Date()).toISOString(),
        "object": {
            "@context": "https://www.w3.org/ns/activitystreams",
            "id": process.env.PREFIX + process.env.HOST + ":" + process.env.CARPOOLING_QUERIER_PORT + "/carpooling/message/" + uuid(),
            "type": "Note",
            "mediaType": "application/json",
            "attributedTo": secretary,
            "to": to,
            "content": content,
        }
    }
}

module.exports = {
    forwardErrorMessage,
    forwardJoinOrLeaveMessage,
    forwardManageMessage,
    forwardToDriver,
};
