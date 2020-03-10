var express = require('express');
var router = express.Router();
const requestHandler = require('../handlers/requestHandler');
const axios = require('axios');

const routes = {
    'create':   {inboxRoute:    '/create',  activityGenerator: requestHandler.generateCreateCarpoolingActivity},
    'join':     {inboxRoute:    '/join',    activityGenerator: requestHandler.generateCreateJoinLeaveActivity},
    'leave':    {inboxRoute:    '/leave',   activityGenerator: requestHandler.generateCreateJoinLeaveActivity},
    'manage':   {inboxRoute:    '/manage',  activityGenerator: requestHandler.generateCreateManageActivity}
};

router.post('/:route', function(req, res) {
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
  axios.post('http://10.42.0.1:' + process.env.CARPOOLING_INBOX_PORT + '/carpooling/secretary' + currentRoute.inboxRoute, activity)
      .then(_ => res.status(201).end())
      .catch(err => {
        console.error("Error(s) while forwarding to secretary : " + err);
        res.status(500).json({error: "An internal occurred. Please try later or contact admins."})
      });
});

module.exports = router;
