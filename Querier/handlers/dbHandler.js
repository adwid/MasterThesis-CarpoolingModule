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

module.exports = {
    addToWaitingList,
    createNew,
    getRidesTo,
};
