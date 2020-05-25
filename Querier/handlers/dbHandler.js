const RideModel = require('../models/ride');
const MessageModel = require('../models/message');
const { v1: uuid } = require('uuid');

function createNew(activity) {
    const noteObject = activity.object;
    const rideContent = noteObject.content;
    rideContent._id = process.env.PREFIX + process.env.HOST + ":" + process.env.CARPOOLING_QUERIER_PORT + "/carpooling/content/" + uuid();
    rideContent.driver = noteObject.attributedTo;
    const newRide = new RideModel(rideContent);
    return newRide.save();
}

function getNewMessages(uid) {
    return MessageModel.find({
        to: uid,
        seen: false
    }).then(messages => {
        const promises = [];
        for (const message of messages) {
            promises.push(message.update({
                $set: {seen: true}
            }).catch(err => {
                console.error("[ERR] db update : " + err)
            }));
        }
        promises.push(Promise.resolve(messages)); // keep messages for next step
        return Promise.all(promises);
    }).then(resolvedPromises => {
        const jsonMessages = [];
        if (resolvedPromises.length === 0) return Promise.resolve(jsonMessages);
        const messages = resolvedPromises[resolvedPromises.length - 1];
        for (const message of messages) jsonMessages.push(message.toJSON());
        return Promise.resolve(jsonMessages);
    });
}

function getOldMessages(uid) {
    return MessageModel.find({
        to: uid,
        seen: true
    });
}

function getRidesTo(destination) {
    return RideModel.find({
        "arrival.place": {$eq: destination},
        "departure.date": {$gt: new Date()}
    })
}

function getRideByID(id) {
    return RideModel.findById(id);
}

function addToWaitingList(activity) {
    const noteObject = activity.object;
    const rideID = noteObject.content.rideID;
    const userID = noteObject.attributedTo;
    return RideModel.findOneAndUpdate({
        _id: {$eq: rideID},
        passengers: {$not: {$elemMatch: {$eq: userID}}}
    }, {
        $addToSet: {waitingList: userID}
    });
}

function removeFromRide(activity) {
    const noteObject = activity.object;
    const rideID = noteObject.content.rideID;
    let usersID = noteObject.attributedTo;

    return RideModel.findOneAndUpdate({
        _id: {$eq: rideID}
    }, {
        $pull: {
            waitingList: usersID,
            passengers: usersID
        },
    });
}

function managePassengers(activity) {
    const noteObject = activity.object;
    const rideID = noteObject.content.rideID;
    const driverID = noteObject.attributedTo;
    const content = noteObject.content;
    const promise = Promise.resolve();

    if (!content) return Promise.reject("managePassengers not possible: No content in the note object.");
    if (content.reject !== undefined && content.reject.length > 0) {
        promise.then(_ => {
            return rejectPassengers(rideID, driverID, content.reject);
        });
    }
    if (content.accept !== undefined && content.accept.length > 0) {
        promise.then(_ => {
            return acceptPassengers(rideID, driverID, content.accept);
        });
    }

    return promise;
}

function rejectPassengers(rideID, driverID, usersID) {
    return RideModel.findOneAndUpdate({
        _id: {$eq: rideID},
        driver: {$eq: driverID}
    }, {
        $pull: {
            passengers: {$in: usersID},
            waitingList: {$in: usersID}
        }
    });
}

function storeMessage(activity) {
    const promises = [];
    const to = Array.isArray(activity.to) ? activity.to : [activity.to];
    for (const actor of to) {
        let url = new URL(actor);
        // only store message for users in the same domain than the current instance :
        if (url.hostname === process.env.HOST)
            promises.push(storeMessageAux(activity, actor));
    }
    return Promise.all(promises);
}

function storeMessageAux(activity, recipient) {
    const newMessage = new MessageModel({
        url: activity.id,
        to: recipient
    });
    return newMessage.save()
        .catch(err => {
            console.error("[ERR] not able to store a message in DB : " + err);
        });
}

function acceptPassengers(rideID, driverID, usersID) {
    // todo https://stackoverflow.com/questions/15627967/why-mongoose-doesnt-validate-on-update
    return RideModel.findOneAndUpdate({
        _id: {$eq: rideID},
        driver: {$eq: driverID},
        waitingList: {$all: usersID}
    }, {
        $addToSet: {
            passengers: {$each: usersID}
        },
        $pull: {
            waitingList: {$in: usersID}
        }
    });
}

module.exports = {
    addToWaitingList,
    createNew,
    getNewMessages,
    getOldMessages,
    getRideByID,
    getRidesTo,
    managePassengers,
    removeFromRide,
    storeMessage,
};
