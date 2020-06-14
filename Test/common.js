const chai = require('chai');
const chaiHTTP = require('chai-http');

chai.use(chaiHTTP);
chai.should();

const carpooOutbox = chai.request(process.env.PREFIX + process.env.HOST + ":" + process.env.CARPOOLING_OUTBOX_PORT).keepOpen();
const carpooQuerier = chai.request(process.env.PREFIX + process.env.HOST + ":" + process.env.CARPOOLING_QUERIER_PORT).keepOpen();
const carpooSecretary = process.env.PREFIX + process.env.HOST + ":" + process.env.CARPOOLING_QUERIER_PORT + "/carpooling/secretary";

const actorsIDs = [];
const buffer = [];
const timeout = 100;
const slow = 1000;


module.exports = {
    actorsIDs,
    buffer,
    carpooOutbox,
    carpooQuerier,
    carpooSecretary,
    chai,
    slow,
    timeout,
}
