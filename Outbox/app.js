var express = require('express');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const database = require('./database');

var carpoolingRouter = require('./routes/carpooling');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

database.open()
    .catch(() => {
        console.error('Please check that the MongoDB server is running.');
        process.exit(1);
    });

app.use('/carpooling', carpoolingRouter);

module.exports = app;
