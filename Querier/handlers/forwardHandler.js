const { v1: uuid } = require('uuid');
const axios = require('axios');
const actorHandler = require('./actorHandler');

function forwardCreateMessage(activityReceived, objectCreated) {
    const activity = objectToActivity(activityReceived.actor, objectCreated._id, "create");
    return actorHandler.getInboxAddresses(activityReceived.actor)
        .then(addr => {
            if (addr.length === 0) return Promise.reject("No address found for the actor. " +
                "Unable to forward the carpooling created");
            return axios.post(addr[0], activity);
        });
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
    forwardCreateMessage,
};
