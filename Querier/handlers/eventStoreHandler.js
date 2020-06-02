const esClient = require('../eventStore');
const db = require('./dbHandler');
const fw = require('./forwardHandler');

const streamName = "carpooling";
const esConnection = esClient.connection();

const eventCallback = {
    'create':   {dbCallback: db.createNew,          fwCallback: fw.forwardToDriver},
    'join'  :   {dbCallback: db.addToWaitingList,   fwCallback: fw.forwardJoinOrLeaveMessage},
    'leave' :   {dbCallback: db.removeFromRide,     fwCallback: fw.forwardJoinOrLeaveMessage},
    'manage':   {dbCallback: db.managePassengers,   fwCallback: fw.forwardManageMessage},
    'news':     {dbCallback: db.storeNews,          fwCallback: undefined},
};

esConnection.subscribeToStream(streamName, false, onNewEvent)
    .then(_ => {
        console.log("Subscription confirmed (stream %s)", streamName);
    })
    .catch(err => {
        console.error("[ERR] error with stream subscription (stream %s) : %s", streamName, err);
        process.exit(1);
    });

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
            else return forwardNewObject(eventType, activity.actor, dbRequestResult);
        })
        .then(_ => console.log("Event \'" + eventType + "\' correctly processed."))
        .catch(err => catcher(err, activity, eventType));
}

function catcher(err, activity, eventType) {
    if (err.name === "ValidationError") {
        const rideID = activity.object.content.rideID;
        const errField = Object.keys(err.errors)[0];
        fw.forwardErrorMessage(activity.actor, rideID, eventType, err.errors[errField].message);
        return;
    }
    if (err.name === "MongoError" && err.code === 11000) {
        const rideID = activity.object.content.rideID;
        fw.forwardErrorMessage(activity.actor, rideID, eventType, "Duplication:" + Object.keys(err.keyValue));
        return;
    }
    if (err.name === "MyNotFoundError") {
        const rideID = activity.object.content.rideID;
        fw.forwardErrorMessage(activity.actor, rideID, eventType, err.message);
        return;
    }
    console.log("[ERR] ES/onNewEvent : " + err);
}
