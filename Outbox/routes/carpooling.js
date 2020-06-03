var express = require('express');
var router = express.Router();
const requestHandler = require('../handlers/requestHandler');
const axios = require('axios');
const db = require("../handlers/dbHandler");
const { v1: uuid } = require('uuid');
const actorHandler = require('../handlers/actorHandler');

const routes = {
    'close':    {inboxRoute: '/close',   activityGenerator: requestHandler.generateCreateJoinLeaveActivity},
    'create':   {inboxRoute: '/create', activityGenerator: requestHandler.generateCreateCarpoolingActivity},
    'join':     {inboxRoute: '/join',   activityGenerator: requestHandler.generateCreateJoinLeaveActivity},
    'leave':    {inboxRoute: '/leave',  activityGenerator: requestHandler.generateCreateJoinLeaveActivity},
    'manage':   {inboxRoute: '/manage', activityGenerator: requestHandler.generateCreateManageActivity},
    'open':     {inboxRoute: '/open',   activityGenerator: requestHandler.generateCreateJoinLeaveActivity},
};

router.post('/:route', function(req, res, next) {
    if (!routes.hasOwnProperty(req.params.route)) {
        next();
        return;
    }
    const currentRoute = routes[req.params.route];
    const activity = currentRoute.activityGenerator(req.body);
    if (!activity) {
        res.status(400).end();
        return;
    }

    activity.object.id = process.env.PREFIX + process.env.HOST + ":" + process.env.CARPOOLING_OUTBOX_PORT + "/carpooling/" + uuid();
    activity.id = process.env.PREFIX + process.env.HOST + ":" + process.env.CARPOOLING_OUTBOX_PORT + "/carpooling/" + uuid();

    // Forward the activity to the secretary's inbox (of the carpooling module)
    // The secretary is in charge of processing and forwarding all messages
    db.storeActivity(activity)
        .then(_ => {
            return actorHandler.getInboxAddresses(activity.to)
        })
        .then(addrs => {
            let url = addrs[0] + '/carpooling/secretary' + currentRoute.inboxRoute;
            return axios.post(url, activity)
        })
        .then(_ => res.status(201).json(activity))
        .catch(err => {
            if (err.code === 'ECONNREFUSED') return res.status(502).end();
            console.error("Error(s) while forwarding to secretary : " + err);
            res.status(500).json({error: "An internal occurred. Please try later or contact admins."})
        });
});

router.get("/:id", (req, res) => {
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
