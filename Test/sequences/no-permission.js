const common = require("../common");
const chai = common.chai;
const activityHelper = require('../helpers/activityHelper');
const db = require('../helpers/dbHelper');

const actors = common.actorsIDs;
const carpooSecretary = common.carpooSecretary;

describe("[Carpooling] No permission", function () {
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
    });

    describe("actor[1] can not close actor[0]'s ride", function () {
        const body = {};

        it('(create message body)', function () {
            body.rideID = rideID;
        });

        activityHelper.shouldPostActivity(common.carpooOutbox, "/carpooling/close", actors[1], carpooSecretary, body);
        activityHelper.shouldReceiveActivity("actor01", common.carpooQuerier, "/carpooling/news/new/" + encodeURIComponent(actors[1]), carpooSecretary);

        it("should be an error message", function () {
            common.buffer.should.have.lengthOf(1);
            let msg = common.buffer.pop();
            msg.should.be.an("object");
            msg.should.have.property("url", rideID);
            msg.should.have.property("type", "error");
            msg.should.have.property("error");
            const error = msg.error;
            const div = error.split(":::");
            div.should.have.lengthOf(2);
            div[0].should.be.equal("close");
        });

        it("carpooling should be available", function (done) {
            chai.request(rideID)
                .get("")
                .end(function (err, res) {
                    chai.expect(err).to.be.null;
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    res.body.should.have.property("available", true);
                    done();
                });
        })
    })

    describe("actor[2] can not join a closed carpooling", function () {
        const body = {};

        it('(create message body)', function () {
            body.rideID = rideID;
        });

        activityHelper.shouldPostActivity(common.carpooOutbox, "/carpooling/close", actors[0], carpooSecretary, body);
        activityHelper.shouldPostActivity(common.carpooOutbox, "/carpooling/join", actors[2], carpooSecretary, body);
        activityHelper.shouldReceiveActivity("actor02", common.carpooQuerier, "/carpooling/news/new/" + encodeURIComponent(actors[2]), carpooSecretary);

        it("should be an error message", function () {
            common.buffer.should.have.lengthOf(1);
            let msg = common.buffer.pop();
            msg.should.be.an("object");
            msg.should.have.property("url", rideID);
            msg.should.have.property("type", "error");
            msg.should.have.property("error");
            const error = msg.error;
            const div = error.split(":::");
            div.should.have.lengthOf(2);
            div[0].should.be.equal("join");
        });
    });

    describe("actor[3] can not manage actor[0]'s carpooling", function () {
        const body = {};

        it('(create message body)', function () {
            body.rideID = rideID;
            body.accept = [];
            body.reject = [];
        });

        activityHelper.shouldPostActivity(common.carpooOutbox, "/carpooling/manage", actors[3], carpooSecretary, body);
        activityHelper.shouldReceiveActivity("actor03", common.carpooQuerier, "/carpooling/news/new/" + encodeURIComponent(actors[3]), carpooSecretary);

        it("should be an error message", function () {
            common.buffer.should.have.lengthOf(1);
            let msg = common.buffer.pop();
            msg.should.be.an("object");
            msg.should.have.property("url", rideID);
            msg.should.have.property("type", "error");
            msg.should.have.property("error");
            const error = msg.error;
            const div = error.split(":::");
            div.should.have.lengthOf(2);
            div[0].should.be.equal("manage");
        });
    });
});
