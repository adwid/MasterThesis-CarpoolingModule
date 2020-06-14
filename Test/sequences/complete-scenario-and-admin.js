const common = require("../common");
const chai = common.chai;
const activityHelper = require('../helpers/activityHelper');
const db = require('../helpers/dbHelper');

const actors = common.actorsIDs;
const carpooSecretary = common.carpooSecretary;

describe("[Carpooling] Basic scenario", function () {
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

    this.slow(common.slow);
    beforeEach(done => setTimeout(done, common.timeout));

    it("should get the secretary's profile", function (done) {
        chai.request(carpooSecretary)
            .get("/")
            .end(function (err, res) {
                chai.expect(err).to.be.null;
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property("inbox");
                res.body.should.have.property("id");
                res.body.should.have.property("type", "Application");
                done();
            });
    });

    describe("actor[0] creates a new ride", function () {
        activityHelper.shouldPostActivity(common.carpooOutbox, "/carpooling/create", actors[0], common.carpooSecretary, newRide);

        activityHelper.shouldReceiveActivity("actor00", common.carpooQuerier, "/carpooling/news/new/" + encodeURIComponent(actors[0]), carpooSecretary);

        it('should be a creation notification', function () {
            common.buffer.should.have.lengthOf(1);
            const msg = common.buffer.pop();
            msg.should.be.an("object");
            msg.should.have.property("url");
            rideID = msg.url;
            msg.should.have.property("from", actors[0]);
            msg.should.have.property("type", "create");
        });

        it('should correctly download the carpooling (using ID)', function (done) {
            chai.request(rideID)
                .get("")
                .end(function (err, res) {
                    chai.expect(err).to.be.null;
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    res.body.should.have.property("_id", rideID);
                    const ride = res.body;
                    ride.should.have.property("passengers");
                    ride.passengers.should.be.an("array").and.have.lengthOf(0);
                    ride.should.have.property("waitingList");
                    ride.waitingList.should.be.an("array").and.have.lengthOf(0);
                    ride.should.have.property("departure");
                    ride.departure.should.have.property("date", newRide.departure.date);
                    ride.departure.should.have.property("place", newRide.departure.place);
                    ride.should.have.property("arrival");
                    ride.arrival.should.have.property("date", newRide.arrival.date);
                    ride.arrival.should.have.property("place", newRide.arrival.place);
                    ride.should.have.property("car");
                    ride.car.should.have.property("make", newRide.car.make);
                    ride.car.should.have.property("model", newRide.car.model);
                    ride.should.have.property("seats", newRide.seats);
                    ride.should.have.property("price", newRide.price);
                    ride.should.have.property("driver", actors[0]);
                    ride.should.have.property("available", true);
                    done();
                });
        });
    });

    describe("actors 1..3 join the carpooling", function () {
        const body = {};

        it('(create message body)', function () {
            body.rideID = rideID;
        });

        for (var i = 1; i < 4; i++) {
            const index = i;
            activityHelper.shouldPostActivity(common.carpooOutbox, "/carpooling/join", actors[index], carpooSecretary, body);
            activityHelper.shouldReceiveActivity("actor0" + index, common.carpooQuerier, "/carpooling/news/new/" + encodeURIComponent(actors[index]), carpooSecretary);
        }

        it('each actor\'s message should be the same', function () {
            common.buffer.should.have.lengthOf(3); // actor1..3
            let msg;
            for (var i = 3; i > 0; i--) { // reverse order since buffer is a stack
                msg = common.buffer.pop();
                msg.should.be.an("object");
                msg.should.have.property("url", rideID);
                msg.should.have.property("from", actors[i]);
                msg.should.have.property("type", "join");
            }
        });

        activityHelper.shouldReceiveActivity("actor00", common.carpooQuerier, "/carpooling/news/new/" + encodeURIComponent(actors[0]), carpooSecretary);

        it('actor00\'s message should be the \'join\' notifications', function () {
            common.buffer.should.have.lengthOf(3);
            let msg;
            for (var i = 3; i > 0; i--) { // reverse order since buffer is a stack
                msg = common.buffer.pop();
                msg.should.be.an("object");
                msg.should.have.property("url", rideID);
                msg.should.have.property("from", actors[i]);
                msg.should.have.property("type", "join");
            }
        });

        it('carpooling should contain the actor in waiting list', function () {
            chai.request(rideID)
                .get("")
                .end(function (err,res) {
                    chai.expect(err).to.be.null;
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    const ride = res.body;
                    ride.should.have.property("waitingList");
                    ride.should.have.property("passengers");
                    ride.waitingList.should.be.an("array").and.have.lengthOf(3);
                    ride.passengers.should.be.an("array").and.have.lengthOf(0);
                    for (var i = 1; i < 4; i++) {
                        ride.waitingList[i - 1].should.be.equal(actors[i]);
                    }
                })
        });
    });

    describe("actor[1] leaves the waitingList", function () {
        const body = {};

        it('(create message body)', function () {
            body.rideID = rideID;
        });

        activityHelper.shouldPostActivity(common.carpooOutbox, "/carpooling/leave", actors[1], carpooSecretary, body);
        activityHelper.shouldReceiveActivity("actor00", common.carpooQuerier, "/carpooling/news/new/" + encodeURIComponent(actors[0]), carpooSecretary);
        activityHelper.shouldReceiveActivity("actor01", common.carpooQuerier, "/carpooling/news/new/" + encodeURIComponent(actors[1]), carpooSecretary);

        it('actor[0,1] should have received the same message', function () {
            common.buffer.should.have.lengthOf(2);
            let msg;
            while (msg = common.buffer.pop()) {
                msg.should.be.an("object");
                msg.should.have.property("url", rideID);
                msg.should.have.property("type", "leave");
                msg.should.have.property("from", actors[1]);
            }
        });

        it('waitingList should not contain actor[1]', function () {
            chai.request(rideID)
                .get("")
                .end(function (err,res) {
                    chai.expect(err).to.be.null;
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    const ride = res.body;
                    ride.should.have.property("waitingList");
                    ride.should.have.property("passengers");
                    ride.waitingList.should.be.an("array").and.have.lengthOf(2);
                    ride.passengers.should.be.an("array").and.have.lengthOf(0);
                    for (var i = 2; i < 4; i++) {
                        ride.waitingList[i - 2].should.be.equal(actors[i]);
                    }
                })
        });
    })

    describe("actor[0] accepts actor[2] and reject actor[3]", function () {
        const body = {};

        it('(create message body)', function () {
            body.rideID = rideID;
            body.accept = [actors[2]];
            body.reject = [actors[3]];
        });

        activityHelper.shouldPostActivity(common.carpooOutbox, "/carpooling/manage", actors[0], carpooSecretary, body);
        for(const index of [0,2,3])
            activityHelper.shouldReceiveActivity("actor0" + index, common.carpooQuerier, "/carpooling/news/new/" + encodeURIComponent(actors[index]), carpooSecretary);

        it('messages should inform the accept/reject', function () {
            common.buffer.should.have.lengthOf(3);
            const type = ["manage", "accept", "reject"];
            let msg;
            while (msg = common.buffer.pop()) {
                msg.should.be.an("object");
                msg.should.have.property("url", rideID);
                msg.should.have.property("type", type.pop());
                msg.should.have.property("from", actors[0]);
            }
        });

        it('carpooling should be updated', function () {
            chai.request(rideID)
                .get("")
                .end(function (err,res) {
                    chai.expect(err).to.be.null;
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    const ride = res.body;
                    ride.should.have.property("waitingList");
                    ride.should.have.property("passengers");
                    ride.waitingList.should.be.an("array").and.have.lengthOf(0);
                    ride.passengers.should.be.an("array").and.have.lengthOf(1);
                    ride.passengers[0].should.be.equal(actors[2]);
                })
        });
    })

    describe("actor[2] leaves the carpooling", function () {
        const body = {};

        it('(create message body)', function () {
            body.rideID = rideID;
        });

        activityHelper.shouldPostActivity(common.carpooOutbox, "/carpooling/leave", actors[2], carpooSecretary, body);
        activityHelper.shouldReceiveActivity("actor00", common.carpooQuerier, "/carpooling/news/new/" + encodeURIComponent(actors[0]), carpooSecretary);
        activityHelper.shouldReceiveActivity("actor01", common.carpooQuerier, "/carpooling/news/new/" + encodeURIComponent(actors[2]), carpooSecretary);

        it('actor[0,2] should have received the same message', function () {
            common.buffer.should.have.lengthOf(2);
            let msg;
            while (msg = common.buffer.pop()) {
                msg.should.be.an("object");
                msg.should.have.property("url", rideID);
                msg.should.have.property("type", "leave");
                msg.should.have.property("from", actors[2]);
            }
        });

        it('passengers should not contain actor[2]', function () {
            chai.request(rideID)
                .get("")
                .end(function (err,res) {
                    chai.expect(err).to.be.null;
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    const ride = res.body;
                    ride.should.have.property("waitingList");
                    ride.should.have.property("passengers");
                    ride.waitingList.should.be.an("array").and.have.lengthOf(0);
                    ride.passengers.should.be.an("array").and.have.lengthOf(0);
                })
        });
    })

    describe("actor[0] closes the carpooling", function () {
        const body = {};

        it('(create message body)', function () {
            body.rideID = rideID;
        });

        activityHelper.shouldPostActivity(common.carpooOutbox, "/carpooling/close", actors[0], carpooSecretary, body);
        activityHelper.shouldReceiveActivity("actor00", common.carpooQuerier, "/carpooling/news/new/" + encodeURIComponent(actors[0]), carpooSecretary);

        it('actor[0] should receive the close notification', function () {
            common.buffer.should.have.lengthOf(1);
            let msg = common.buffer.pop();
            msg.should.be.an("object");
            msg.should.have.property("url", rideID);
            msg.should.have.property("type", "close");
            msg.should.have.property("from", actors[0]);
        });

        it('carpooling should be closed', function () {
            chai.request(rideID)
                .get("")
                .end(function (err, res) {
                    chai.expect(err).to.be.null;
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    const ride = res.body;
                    ride.available.should.be.false;
                })
        });
    });

    describe("actor[0] opens the carpooling", function () {
        const body = {};

        it('(create message body)', function () {
            body.rideID = rideID;
        });

        activityHelper.shouldPostActivity(common.carpooOutbox, "/carpooling/open", actors[0], carpooSecretary, body);
        activityHelper.shouldReceiveActivity("actor00", common.carpooQuerier, "/carpooling/news/new/" + encodeURIComponent(actors[0]), carpooSecretary);

        it('actor[0] should receive the open notification', function () {
            common.buffer.should.have.lengthOf(1);
            let msg = common.buffer.pop();
            msg.should.be.an("object");
            msg.should.have.property("url", rideID);
            msg.should.have.property("type", "open");
            msg.should.have.property("from", actors[0]);
        });

        it('carpooling should be opened', function () {
            chai.request(rideID)
                .get("")
                .end(function (err, res) {
                    chai.expect(err).to.be.null;
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    const ride = res.body;
                    ride.available.should.be.true;
                })
        });
    });

});
