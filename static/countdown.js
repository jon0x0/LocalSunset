/* Keep countdown arithmetic separate from the simulated time and time zone. */
function sunsetCountdown(result, now, eventType) {
    eventType = eventType === 'sunrise' ? 'sunrise' : 'sunset';
    if (!result) return {value: '—:—:—', note: 'Trace a location to start the countdown.'};
    if (!result[eventType]) return {value: 'No ' + eventType, note: 'No predicted ' + eventType + ' on the selected local date.'};
    var remaining = Date.parse(result[eventType].utc) - now;
    if (!Number.isFinite(remaining)) return {value: '—:—:—', note: 'Event time is unavailable.'};
    var past = remaining <= 0;
    var seconds = past ? Math.floor(-remaining / 1000) : Math.ceil(remaining / 1000);
    var hours = Math.floor(seconds / 3600);
    function pad(value) { return value < 10 ? '0' + value : String(value); }
    return {
        value: pad(hours) + ':' + pad(Math.floor(seconds / 60) % 60) + ':' + pad(seconds % 60),
        past: past,
        note: past ? 'Time since the selected ' + eventType + '. Uses the real clock.' : 'Hours · minutes · seconds until ' + eventType + '. Uses the real clock.'
    };
}
if (typeof module !== 'undefined' && module.exports) module.exports = sunsetCountdown;
