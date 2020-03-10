const createActivityFields = ["@context", "type", "actor", "object", "to"];
const objectFields = ["@context", "type", "to", "attributedTo", "content", "mediaType"];
const carpoolingFields = ["departure.date", "departure.place", "arrival.date", "arrival.place",
    "driver", "seats", "price", "car.make", "car.model"];

function generateCreateCarpoolingActivity(request) {
    const activity = generateCreateObjectActivity(request, objectFields, isValidCarpooling);
    if (!activity) return undefined;
    return activity;
}

function generateCreateJoinLeaveActivity(request) {
    const activity = generateCreateObjectActivity(request, objectFields, isValidJoinLeave)
    if (!activity) return undefined;
    return activity;
}

function generateCreateObjectActivity(request, objectFields, funIsValidContent) {
    let activity = undefined;
    if (!request) return undefined;
    if (request.type === 'Note' && isValidNote(request, objectFields, funIsValidContent)) {
        activity = carpoolingNoteToCreateActivity(request, funIsValidContent);
    }
    if (request.type === 'Create' && isValidCreateActivity(request, objectFields, funIsValidContent)) {
        activity = request;
    }
    if (!activity) return undefined;
    activity.published = (new Date()).toISOString();
    return activity;
}

function isValidCreateActivity(activity, objectFields, funIsValidContent) {
    if (!activity
        || !createActivityFields.every(field => activity.hasOwnProperty(field))
        || activity.type !== "Create"
        || !isValidNote(activity.object, objectFields, funIsValidContent)
    ) return false;
    return true;
}

function isValidNote(object, fields, funIsContentValid) {
    if (!object
        || !fields.every(field => object.hasOwnProperty(field))
        || object.type !== "Note"
        || object.mediaType !== "application/json"
        || (!!funIsContentValid && !funIsContentValid(object.content))
    ) return false;
    return true;
}

function isValidJoinLeave(content) {
    if (!content
        || !content.hasOwnProperty("rideID")
        || content.rideID === "") {
        return false;
    }
    return true;
}

function isValidCarpooling(content) {
    if (!content) return false;
    for (var field of carpoolingFields) {
        try {
            var value = field.split('.').reduce((a, b) => a[b], content);
            if (!value) return false;
        } catch (err) {
            return false;
        }
    }
    if (!isIsoDate(content.departure.date)
        || !isIsoDate(content.arrival.date)) {
        return false;
    }
    return true;
}

function isIsoDate(str) {
    if (!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(str)) return false;
    var d = new Date(str);
    return d.toISOString()===str;
}

function carpoolingNoteToCreateActivity(note) {
    return {
        "@context": "https://www.w3.org/ns/activitystreams",
        "type": "Create",
        "actor": note.attributedTo,
        "to": note.to,
        "object": note
    };
}

module.exports = {
    generateCreateCarpoolingActivity,
    generateCreateJoinLeaveActivity,
};
