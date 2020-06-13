const common = require("../common");
const chai = common.chai;
const activityHelper = require('../helpers/activityHelper');
const db = require('../helpers/dbHelper');
const clone = require('clone');

const actors = common.actorsIDs;
const carpooSecretary = common.carpooSecretary;

describe("[Carpooling] Validations", function () {
    let rideID;
    const dDeparture = new Date();
    dDeparture.setFullYear(dDeparture.getFullYear() + 1);
    const dArrival = new Date(dDeparture.getTime())
    dArrival.setHours(dArrival.getHours() + 1);
    const newRide = {
        "departure" : {
            "date": dDeparture.toISOString(),
            "place": "Mons"
        },
        "arrival" : {
            "date": dArrival.toISOString(),
            "place": "Bruxelles"
        },
        "car": {
            "make": "BMW",
            "model": "Serie 1"
        },
        "seats": 2,
        "price": 10
    };

    before(function (done) {
        db.cleanCarpoolingQuerierDB().then(_ => done())
            .catch(err => {
                throw err
            });
    })

    beforeEach(done => setTimeout(done, common.timeout));

    describe("an actor can not create the same carpooling twice", function () {
        activityHelper.shouldPostActivity(common.carpooOutbox, "/carpooling/create", actors[0], common.carpooSecretary, newRide);
        activityHelper.shouldPostActivity(common.carpooOutbox, "/carpooling/create", actors[0], common.carpooSecretary, newRide);
        activityHelper.shouldReceiveActivity("actor00", common.carpooQuerier, "/carpooling/news/new/" + encodeURIComponent(actors[0]), carpooSecretary);

        it('should be one creation and one error notification', function () {
            common.buffer.should.have.lengthOf(2);
            let msg = common.buffer.pop();
            msg.should.be.an("object");
            msg.should.not.have.property("url");
            msg.should.have.property("type", "error");
            msg.should.have.property("error");
            const error = msg.error;
            const div = error.split(":::");
            div.should.have.lengthOf(2);
            div[0].should.be.equal("create");
            msg = common.buffer.pop();
            msg.should.be.an("object");
            msg.should.have.property("url");
            msg.should.have.property("from", actors[0]);
            msg.should.have.property("type", "create");
        });
    })

    describe("Ride validation - each field", function () {
        let body = {}

        for (const key of Object.keys(newRide)) {
            it('(create the body message: ride creation with field \'' + key + '\' missing)', function () {
                body = clone(newRide);
                delete body[key];
            });

            activityHelper.shouldNotPostActivity(common.carpooOutbox, "/carpooling/create", actors[0], common.carpooQuerier, body);
        }
    });
});
