const dotenv = require('dotenv').config({path: process.env.ENV_FILE_PATH});
if (dotenv.error) {
    throw dotenv.error;
}

const common = require('./common');
const actorHelper = require('./helpers/actorHelper');

const actorsName = ["actor00", "actor01", "actor02", "actor03",];

describe("[CARPOOLING MODULE]", function () {
    this.slow(common.slow);
    it('should create each user', function (done) {
        actorHelper.init(actorsName)
            .then(actorsID => {
                common.actorsIDs.push(...actorsID);
                done();
            })
            .catch(function (err) {
                console.error("Error while creating some actors: " + err);
                throw err;
            });
    });

    it('should test several sequences', function () {
        require('./sequences/complete-scenario-and-admin');
        require('./sequences/no-permission');
        require('./sequences/validations');
    });

});
