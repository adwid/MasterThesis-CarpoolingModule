const { v1: uuid } = require('uuid');
const axios = require('axios');
const actorHandler = require('./actorHandler');

function forwardManageMessage(type, updateResult) {
    return Promise.all([
        send(updateResult.driver, updateResult.rideID, "manage"),
        sendMany(updateResult.rejected, updateResult.rideID, "reject"),
        sendMany(updateResult.accepted, updateResult.rideID, "accept"),
    ])
}

function forwardToDriver(type, dbObject) {
    return send(dbObject.driver, dbObject._id, type);
}

function send(actor, id, type) {
    const activity = objectToActivity(actor, id, type);
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

function sendMany(actors, id, type) {
    const promises = [];
    for (const actor of actors)
        promises.push(send(actor, id, type));
    return Promise.all(promises);
}

// todo NEEDS ADAPTIONS (COMES FROM AGENDA MODULE) (id set here but received on other domains + use outbox to send the message ?)
function objectToActivity(to, id, type) {
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
            "content": {
                "url": id,
                "type": type
            }
        }
    }
}

module.exports = {
    forwardToDriver,
    forwardManageMessage,
};
