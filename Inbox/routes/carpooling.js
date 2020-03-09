var express = require('express');
var router = express.Router();
var esHandler = require('../handlers/eventStoreHandler');
const { v1: uuid } = require('uuid');

const routes = [
  "create",
];

/* Post data to event store */
router.post('/secretary/:route', function(req, res, next) {
  if (!routes.includes(req.params.route)) {
    next();
    return;
  }
  let eventType = req.params.route;
  let activity = req.body;
  activity.object.id = "http://10.42.0.1:" + process.env.CARPOOLING_QUERIER_PORT + "/carpooling/" + uuid();
  activity.id = "http://10.42.0.1:" + process.env.CARPOOLING_QUERIER_PORT + "/carpooling/" + uuid();
  postEvent(activity, eventType, res);
});

function postEvent(activity, eventType, res) {
  esHandler.postEvent(activity, eventType)
      .then(() => {
        res.status(201).end()
      })
      .catch(() => {
        res.status(500).json({
          error: "Internal error. Please try later or contact admins."
        });
      });
}


module.exports = router;
