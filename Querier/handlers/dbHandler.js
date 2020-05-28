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

/*
    This is used to filter the actors arrat
    It returns the intersection between actors and <the union of waitingList and passengers>
 */
function getActorsInRide(rideDocument, actors) {
    const result = [];
    if (!rideDocument) return result;
    if (!rideDocument.waitingList || !rideDocument.passengers) return result;
    for (const actor of actors)
        if (rideDocument.waitingList.includes(actor) || rideDocument.passengers.includes(actor))
            result.push(actor);
    return result;
}

function addToWaitingList(activity) {
    const noteObject = activity.object;
    const rideID = noteObject.content.rideID;
    const userID = noteObject.attributedTo;
    return RideModel.findOneAndUpdate({
        _id: {$eq: rideID},
        passengers: {$nin: [userID]},
        waitingList: {$nin: [userID]},
    }, {
        $addToSet: {waitingList: userID}
    }).then(result => {
        if (!result) return Promise.resolve();
        return Promise.resolve({
            rideID: result._id,
            driver: result.driver,
            user: userID
        })
    });
}

function removeFromRide(activity) {
    const noteObject = activity.object;
    const rideID = noteObject.content.rideID;
    let userID = noteObject.attributedTo;

    return RideModel.findOneAndUpdate({
        _id: {$eq: rideID},
        $or: [
            {waitingList: userID},
            {passengers: userID}
        ]
    }, {
        $pull: {
            waitingList: userID,
            passengers: userID
        },
    }).then(result => {
        if (!result) return Promise.resolve();
        return Promise.resolve({
            rideID: result._id,
            driver: result.driver,
            user: userID
        })
    });
}

function managePassengers(activity) {
    const noteObject = activity.object;
    const rideID = noteObject.content.rideID;
    const driverID = noteObject.attributedTo;
    const content = noteObject.content;

    return rejectPassengers(rideID, driverID, content.reject)
        .then(oldRideDocument => {
            return getActorsInRide(oldRideDocument, content.reject)
        }).then(rejectedActors => {
            return Promise.all([
                Promise.resolve(rejectedActors), // pass the rejected users to the next promise
                acceptPassengers(rideID, driverID, content.accept)
            ])
        }).then(promisesResult => {
            return Promise.resolve({
                rideID: rideID,
                driver: driverID,
                rejected: promisesResult[0],
                accepted: getActorsInRide(promisesResult[1], content.accept)
            })
        });
}

function rejectPassengers(rideID, driverID, usersID) {
    if (!usersID || usersID.length === 0) return Promise.resolve();
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

function searchRide(queryObject) {
    const query = {
        "departure.place": queryObject.departurePlace,
        "arrival.place": queryObject.arrivalPlace
    };
    query["$and"] = [];
    if (queryObject.hasOwnProperty("departureDate")) {
        const dateRange = searchRideHelper(queryObject.departureDate);
        query["$and"].push({"departure.date": {$gte: dateRange.dateBefore}});
        query["$and"].push({"departure.date": {$lte: dateRange.dateAfter}});
    }
    if (queryObject.hasOwnProperty("arrivalDate")) {
        const dateRange = searchRideHelper(queryObject.arrivalDate);
        query["$and"].push({"arrival.date": {$gte: dateRange.dateBefore}});
        query["$and"].push({"arrival.date": {$lte: dateRange.dateAfter}});
    }
    if (query["$and"].length === 0) delete query["$and"];
    return RideModel.find(query);
}

function searchRideHelper(date) {
    const dateBefore = new Date(date);
    const dateAfter = new Date(date);
    dateBefore.setDate(dateBefore.getDate() - 1);
    dateAfter.setDate(dateAfter.getDate() + 1);
    return {
        dateBefore: dateBefore,
        dateAfter: dateAfter,
    }
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
    return RideModel.findOne({
        _id: {$eq: rideID},
        driver: {$eq: driverID},
        waitingList: {$all: usersID}
    }).then(ride => {
        // we could use findOneAndUpdate but this tricks actually forces the validators (see ride model)
        ride.waitingList = ride.waitingList.filter(uid => !usersID.includes(uid));
        usersID.forEach(uid => {
            if (!ride.passengers.includes(uid))
                ride.passengers.push(uid)
        });
        return ride.save();
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
    searchRide,
    storeMessage,
};
