const esClient = require('../eventStore');
const axios = require("axios");
const db = require('./dbHandler');
const fw = require('./forwardHandler');
const projHandler = require('./projectionHandler');

let isProjectionInitialized = false;
const streamName = "carpooling";
const projectionName = "projectionUsedByCarpoolingQuerier";
const esConnection = esClient.connection();
const esCredentials = esClient.getCredentials();

const eventCallback = {
    'create':   {dbCallback: db.createNew,          fwCallback: fw.forwardToDriver},
    'join'  :   {dbCallback: db.addToWaitingList,   fwCallback: fw.forwardJoinOrLeaveMessage},
    'leave' :   {dbCallback: db.removeFromRide,     fwCallback: fw.forwardJoinOrLeaveMessage},
    'manage':   {dbCallback: db.managePassengers,   fwCallback: fw.forwardManageMessage},
    'message':  {dbCallback: db.storeMessage,       fwCallback: undefined},
};

esConnection.subscribeToStream(streamName, false, onNewEvent)
    .then(_ => {
        console.log("Subscription confirmed (stream %s)", streamName);
    })
    .catch(err => {
        console.error("[ERR] error with stream subscription (stream %s) : %s", streamName, err);
        process.exit(1);
    });

initProjection()
    .catch(err => console.error("[ERR] ES : can not initialize the projection : " + err));

function onNewEvent(sub, event) {
    const eventType = event.originalEvent.eventType;
    const activity = JSON.parse(event.originalEvent.data);
    if (!eventCallback.hasOwnProperty(eventType)) {
        console.error("[ERR] ES : unkown event's type : " + eventType);
        return;
    }
    var updateDB = eventCallback[eventType].dbCallback;
    var forwardNewObject = eventCallback[eventType].fwCallback;
    updateDB(activity) // Pass the note object of the activity and store it to DB
        .then(dbRequestResult => {
            if (!dbRequestResult) return Promise.resolve();
            console.log("Event \'" + eventType + "\': DB updated");
            if (!forwardNewObject) return Promise.resolve();
            else return forwardNewObject(eventType, dbRequestResult);
        })
        .then(_ => console.log("Event \'" + eventType + "\' correctly processed."))
        .catch(err => console.log("" + err));
}

function initProjection() {
    if (isProjectionInitialized) return Promise.then();
    const body = "options({})\n" +
        "\n" +
        "fromStream('doesNotExist" + Date.now() + "')";
    return axios.post("http://eventstore:2113/projections/onetime?name="
        + projectionName + "&type=JS&enabled=true&checkpoints=false&emit=false&trackemittedstreams=false",
        body, {auth: esCredentials})
        .then(_ => {
            // Wait until tje projection is executing
            return axios.get("http://eventStore:2113/projection/" + projectionName + "/result", {auth: esCredentials});
        })
        .then(setProjectionInitialized)
        .catch(err => {
            // If the projection already exists (409 -> conflict), it's ok
            // Here, we just want to ensure the projection is initialized
            if (err.response !== undefined && err.response.status === 409) return setProjectionInitialized();
            console.error("[ERR] ES projection init : " + err);
            console.error("[ERR] ES projection init : retrying...");
            return setTimeout(initProjection, 1000);
        })
}

function setProjectionInitialized() {
    console.log("EventStore : projection initialized");
    isProjectionInitialized = true;
    return Promise.resolve();
}

function getSpecificObjects(ids) {
    const projection = projHandler.generateGetObjectsQuery(ids);
    return runProjection(projection);
}

function runProjection(projection) {
    let initializeProjection = Promise.resolve();
    if (!isProjectionInitialized) initializeProjection = initProjection();
    return initializeProjection
        .catch(err => {
            return Promise.reject("can not initialize the projection : " + err);
        })
        .then(_ => {
            return axios.put("http://eventStore:2113/projection/" + projectionName + "/query?type=JS&emit=false",
                projection, {auth: esCredentials});
        })
        .then(_ => {
            return axios.get("http://eventStore:2113/projection/" + projectionName + "/result", {auth: esCredentials});
        })
        .then(response => {
            return Promise.resolve(response.data);
        });
}

module.exports = {
    getSpecificObjects,
};
