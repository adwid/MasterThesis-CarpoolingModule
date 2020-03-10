const RideModel = require('../models/ride');

function createNew(noteObject) {
    const rideContent = noteObject.content;
    rideContent._id = noteObject.id;
    rideContent.driver = noteObject.attributedTo;
    const newRide = new RideModel(rideContent);
    return newRide.save();
}

function getRidesTo(destination) {
    return RideModel.find({
        "arrival.place": {$eq: destination},
        "departure.date": {$gt: new Date()}
    })
}

function addToWaitingList(noteObject) {
    const rideID = noteObject.content.rideID;
    const userID = noteObject.attributedTo;
    return RideModel.findOneAndUpdate({
        _id: {$eq: rideID},
        passengers: {$not: {$elemMatch: {$eq: userID}}}
    }, {
        $addToSet: {waitingList: userID}
    });
}

function removeFromRide(noteObject) {
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

function managePassengers(noteObject) {
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
    getRidesTo,
    managePassengers,
    removeFromRide,
};
