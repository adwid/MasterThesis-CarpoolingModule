var express = require('express');
var router = express.Router();
const db = require('../handlers/dbHandler');

router.get('/to', function(req, res, next) {
  if (!req.query.destination || req.query.destination === "")
    return res.status(400).end();
  db.getRidesTo(req.query.destination)
      .then(docs => {
        res.send(docs);
      })
  .catch(err => {
    console.error("" + err);
    res.status(500).end();
  });
});

module.exports = router;
