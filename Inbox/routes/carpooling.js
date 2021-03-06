var express = require('express');
var router = express.Router();
var esHandler = require('../handlers/eventStoreHandler');

const secretaryRoutes = [
    "close",
    "create",
    "join",
    "leave",
    "manage",
    "open",
];

/* Post data to event store */
router.post('/secretary/:route', function(req, res, next) {
  if (!secretaryRoutes.includes(req.params.route)) {
    next();
    return;
  }
  let eventType = req.params.route;
  let activity = req.body;
  postEvent(activity, eventType, res);
});

router.post('/news', function (req, res) {
    let activity = req.body;
    postEvent(activity, "news", res);
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
