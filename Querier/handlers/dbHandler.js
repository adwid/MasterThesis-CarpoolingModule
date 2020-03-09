const RideModel = require('../models/ride');

function createNew(noteObject) {
    const rideContent = noteObject.content;
    rideContent._id = noteObject.id;
    rideContent.driver = noteObject.attributedTo;
    const newRide = new RideModel(rideContent);
    return newRide.save();
}

module.exports = {
    createNew,
};
