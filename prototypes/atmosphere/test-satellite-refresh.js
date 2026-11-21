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

assert.equal(S.needs({...loaded,target:loaded.target+300000,realtime:false}),false,'historical view reuses an observation within ten minutes');
assert.equal(S.needs({...loaded,target:loaded.observed-1,realtime:false}),true,'rewinding before an observation acquires earlier imagery');

// The acquisition heartbeat works without drawing a new sky frame.
const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(__dirname+'/satellite-ui.js','utf8');
let ticks=0,interval,visibility,online;
const context={enabled:{checked:true},document:{hidden:false,addEventListener(type,fn){assert.equal(type,'visibilitychange');visibility=fn;}},window:{addEventListener(type,fn){assert.equal(type,'online');online=fn;}},setInterval(fn,ms){assert.equal(ms,15000);interval=fn;},eventContext:()=>({time:123,lat:40,lon:-105}),update(t,lat,lon){assert.equal(t,123);ticks++;},failedEvent:'failed',retryAt:999};
vm.createContext(context);vm.runInContext(source.slice(source.indexOf(' function maintainClouds'),source.indexOf(' function shade')),context);
interval();assert.equal(ticks,1);context.document.hidden=true;interval();assert.equal(ticks,1);
context.document.hidden=false;visibility();assert.equal(ticks,2);online();assert.equal(ticks,3);assert.equal(context.retryAt,0);assert.equal(context.failedEvent,'');
context.enabled.checked=false;interval();assert.equal(ticks,3);
console.log('Independent acquisition heartbeat, tab resume, reconnect retry and opt-out passed');
