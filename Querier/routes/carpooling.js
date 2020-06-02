var express = require('express');
var router = express.Router();
const db = require('../handlers/dbHandler');

router.get('/with', function (req, res) {
    if (!req.query.hasOwnProperty("id"))
        return res.status(400).end();
    db.getRidesWith(req.query.id)
        .then(rides => {
            if (rides.length === 0) res.status(204).end();
            else res.json(rides);
        })
        .catch(err => {
            console.error("" + err);
            res.status(500).end();
        });
});

router.get('/search', function(req, res, next) {
    if (!req.query.hasOwnProperty("departurePlace") || !req.query.hasOwnProperty("arrivalPlace"))
        return res.status(400).end();
    db.searchRide(req.query)
        .then(rides => {
            if (rides.length === 0) res.status(204).end();
            else res.json(rides);
        })
        .catch(err => {
            console.error("" + err);
            res.status(500).end();
        });
});

router.get('/content/:id', function (req, res) {
    var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    db.getRideByID(fullUrl)
        .then(ride => {
            res.json(ride);
        })
        .catch(err => {
            console.error("" + err);
            res.status(500).end();
        });
});

router.get("/secretary", (req, res) => {
    res.json({
        "@context": "http://www.w3.org/ns/activitystreams",
        "id": process.env.PREFIX + process.env.HOST + ":" + process.env.CARPOOLING_QUERIER_PORT + "/carpooling/secretary",
        "type": "Application",
        "name": "Carpooling module secretariat",
        "summary": "In charge of processing all messages concerning the carpooling module (domain " +
            process.env.PREFIX + process.env.HOST + ")",
        "inbox": process.env.PREFIX + process.env.HOST + ":" + process.env.CARPOOLING_INBOX_PORT + "/carpooling/secretary",
    })
});

router.get("/message/:id", (req, res) => {
    var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    db.getActivity(fullUrl)
        .then(activity => {
            if (!activity) return res.status(204).end();
            res.json(activity);
        })
        .catch(err => {
            console.error("[ERR] get activity: " + err);
            res.status(500).json({error: "An internal occurred. Please try later or contact admins."})
        });
});

module.exports = router;
