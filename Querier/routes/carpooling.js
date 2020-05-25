var express = require('express');
var router = express.Router();
const db = require('../handlers/dbHandler');
const es = require('../handlers/eventStoreHandler');

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

router.get("/:id", (req, res) => {
    var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    es.getSpecificObjects([fullUrl])
        .then(esResponse => {
            const list = esResponse.list;
            if (!list || list.length === 0) res.status(204).end();
            else if (list.length === 1) res.json(list[0]);
            else return Promise.reject("The projection counted more than one event for the ID : " + fullUrl);
        })
        .catch(err => {
            console.error("[ERR] ES projection : " + err);
            res.status(500).json({error: "Internal error. Please try later or contact admins"});
        });
});

module.exports = router;
