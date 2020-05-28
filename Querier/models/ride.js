const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
    date: {type: Date, required: true, min: (new Date()).toISOString()},
    place: {type: String, required: true}
}, {
    _id: false
});

const RideOptionsSchema = new mongoose.Schema({
    luggage: Boolean,
    animals: Boolean,
    smoking: Boolean
}, {
    _id: false
});

const CarSchema = new mongoose.Schema({
    make: {type: String, required: true},
    model: {type: String, required: true}
}, {
    _id: false
});

const RideSchema = new mongoose.Schema({
    _id: String,
    departure: {type: AppointmentSchema, required: true},
    arrival: {type: AppointmentSchema, required: true},
    driver: {type: String, required: true},
    seats: {type: Number, required: true, min: 1},
    options: {type: RideOptionsSchema, required: false},
    price: {type: Number, required: true, min: 0},
    car: {type: CarSchema, required: true},
    passengers: {
        type: [String],
        default: [],
        validate: {
            validator: function (array) {
                if (array.length > this.seats) return false;
                return !array.includes(this.driver);
            },
            message: "More passengers than seats AND/OR" +
                " the driver is one of the passengers"
        },
        required: true
    },
    waitingList: {type: [String], default: [], required: true}
});

RideSchema.index({
    "arrival.place": 1,
    "departure.plate": 1,
    "departure.date": 1,
    "arrival.date": 1,
    "driver": 1
}, {unique: true});

RideSchema.index({"driver": 1});
RideSchema.index({"passengers": 1});
RideSchema.index({"waitingList": 1});

module.exports = mongoose.model('Ride', RideSchema);
