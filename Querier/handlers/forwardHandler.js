const { v1: uuid } = require('uuid');
const axios = require('axios');
const actorHandler = require('./actorHandler');

function forwardJoinOrLeaveMessage(type, dbResponse) {
    return Promise.all([
        send(dbResponse.driver, {"url": dbResponse.rideID, "type": type}),
        send(dbResponse.user, {"url": dbResponse.rideID, "type": type === "join" ? "joined" : "leaved"})
    ]);
}

function forwardManageMessage(type, updateResult) {
    return Promise.all([
        send(updateResult.driver, {"url": updateResult.rideID, "type": "manage"}),
        sendMany(updateResult.rejected, {"url": updateResult.rideID, "type": "reject"}),
        sendMany(updateResult.accepted, {"url": updateResult.rideID, "type": "accept"}),
    ])
}

function forwardToDriver(type, dbObject) {
    return send(dbObject.driver, {"url": dbObject._id, "type": type});
}

function send(actor, content) {
    const activity = objectToActivity(actor, content);
    return actorHandler.getInboxAddresses(actor)
        .then(addr => {
            if (addr.length === 0) return Promise.reject("(send) no inbox addr found.");
            return axios.post(addr[0], activity)
        })
        .catch(err => {
            console.error("[ERR] unable to send message (" + addr +") ; " + err )
            return Promise.resolve();
        });
}

function sendMany(actors, content) {
    const promises = [];
    for (const actor of actors)
        promises.push(send(actor, content));
    return Promise.all(promises);
}

// todo NEEDS ADAPTIONS (COMES FROM AGENDA MODULE) (id set here but received on other domains + use outbox to send the message ?)
function objectToActivity(to, content) {
    const secretary = process.env.PREFIX + process.env.HOST + ":" + process.env.CARPOOLING_QUERIER_PORT + '/carpooling/secretary';
    return {
        "@context": "https://www.w3.org/ns/activitystreams",
        "id": process.env.PREFIX + process.env.HOST + ":" + process.env.CARPOOLING_QUERIER_PORT + "/carpooling/" + uuid(),
        "type": "Create",
        "to": to,
        "actor": secretary,
        "published": (new Date()).toISOString(),
        "object": {
            "@context": "https://www.w3.org/ns/activitystreams",
            "id": process.env.PREFIX + process.env.HOST + ":" + process.env.CARPOOLING_QUERIER_PORT + "/carpooling/" + uuid(),
            "type": "Note",
            "mediaType": "application/json",
            "attributedTo": secretary,
            "to": to,
            "content": content,
        }
    }
}

module.exports = {
    forwardJoinOrLeaveMessage,
    forwardManageMessage,
    forwardToDriver,
};
