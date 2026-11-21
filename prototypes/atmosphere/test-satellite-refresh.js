const assert=require('node:assert/strict'),S=require('./satellite-refresh.js');
const p={enabled:true,visible:true,now:3600000,target:3000000,lat:40,lon:-105,pending:'',failed:'',retryAt:0,loaded:'',hasData:false,observed:NaN,inRegion:false,realtime:false};
assert.equal(S.needs(p),true,'initial enable loads');
const loaded={...p,hasData:true,inRegion:true,observed:p.target-300000,loaded:S.sourceKey(40,-105,p.target,p.now)};
assert.equal(S.needs(loaded),false,'covered slot does not repeat');
assert.equal(S.needs({...loaded,target:p.target+1800000}),true,'swipe outside coverage loads');
assert.equal(S.needs({...loaded,target:p.target+1800000,pending:'earlier slot'}),false,'playback waits for in-flight download rather than starving it');
assert.equal(S.needs({...loaded,now:3900000,target:3900000,realtime:true}),true,'realtime advances source slot');
assert.equal(S.needs({...p,enabled:false}),false);assert.equal(S.needs({...p,visible:false}),false);
const key=S.sourceKey(p.lat,p.lon,p.target,p.now);assert.equal(S.needs({...p,failed:key,retryAt:p.now+1000}),false);assert.equal(S.needs({...p,failed:key,retryAt:p.now-1}),true);
assert.equal(S.sourceKey(40,-105,7200000,3600000),S.sourceKey(40,-105,10800000,3600000),'future views reuse latest available source');
assert.notEqual(S.sourceKey(40,-105,7200000,3600000),S.sourceKey(40,-105,7200000,3900000),'future source refreshes as wall clock advances');
console.log('Satellite refresh: scrubbing, playback catch-up, realtime/future clocks, retry and opt-out passed');

assert.equal(S.needs({...loaded,lat:40.1}),true,'new location refreshes even within old regional bounds');

// A response for an earlier scrub position must trigger catch-up, not count as ready.
const later={...loaded,target:loaded.target+3600000};
assert.equal(S.needs(later),true);
assert.equal(S.needs({...later,pending:'earlier request'}),false);
assert.equal(S.needs({...later,pending:'',loaded:S.sourceKey(40,-105,loaded.target,loaded.now)}),true);
assert.equal(S.needs({...later,pending:'',loaded:S.sourceKey(40,-105,later.target,later.now),observed:later.target-300000}),false);
console.log('Outdated scrub response catches up before the latest source is considered ready');
