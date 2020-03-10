const esConnection = require('../eventStore').connection();
const db = require('./dbHandler');

const streamName = "carpooling";

const eventCallback = {
    'create':   {dbCallback: db.createNew},
    'join'  :   {dbCallback: db.addToWaitingList},
    'leave' :   {dbCallback: db.removeFromRide},
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
    updateDB(activity.object) // Pass the note object of the activity and store it to DB
        .then(objectSaved => {
            if (!objectSaved) return Promise.resolve();
            console.log("Event " + eventType + ": DB updated");
            return Promise.resolve();
        })
        .catch(err => console.log("" + err));
}
