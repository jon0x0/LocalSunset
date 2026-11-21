const assert=require('node:assert/strict'),G=require('./satellite-clouds.js');
const d={schema:'localsunset-satellite-v1',observedAt:'2026-11-20T23:36:18Z',source:'NOAA',bounds:[-110,35,-100,45],width:2,height:2,cells:[[0,null,null],[1,8000,1],[1,9000,null],[1,null,null]]};
assert.equal(G.validate(d),d);
assert.deepEqual(G.cell(d,36,-109),[0,null,null]);
assert.equal(G.cell(d,20,-109),null);
assert.deepEqual(G.lookup(d,36,-109,2000,90,0,1),{cover:0});
assert.deepEqual(G.lookup(d,36,-101,2000,90,0,1),{cover:1,top:8000,tau:1});
assert.equal(G.lookup(d,44,-101,2000,90,0,1),null);
assert.equal(G.intersection(40,-105,3000,30,270,2000),null);
const zenith=G.intersection(40,-105,2000,90,270,8000);assert.ok(Math.abs(zenith[0]-40)<1e-6&&Math.abs(zenith[1]+105)<1e-6);
const west=G.intersection(40,-105,2000,5,270,8000);assert.ok(west[1]<-105);
assert.throws(()=>G.validate({...d,cells:[]}));assert.throws(()=>G.validate({...d,observedAt:'invalid'}));
console.log('Satellite geometry, unknown-data fallback and validation passed');

const evening={lat:40,lon:-105,time:Date.parse(d.observedAt)};
assert.equal(G.matchesEvent(d,evening),true);
assert.equal(G.matchesEvent(d,{...evening,time:evening.time-12*3600000}),false,'sunrise cannot reuse sunset imagery');
assert.equal(G.matchesEvent(d,{...evening,time:evening.time+24*3600000}),false,'next date cannot reuse old imagery');
assert.equal(G.matchesEvent(d,{...evening,lat:20}),false,'wrong region rejected');
assert.equal(G.matchesEvent(d,{...evening,time:evening.time+3600001}),false,'future event outside observation coverage rejected');
console.log('Event/date/location alignment and future observation limits passed');
// Lack of wind coverage must retain the observed cloud, not erase it.
const C=require('./cloud-motion.js');
const observed=G.lookup(d,36,-101,2000,90,0,1,null,(height,lat,lon)=>C.backtrace(null,height,lat,lon,0,600000)||[lat,lon]);
assert.equal(observed.cover,1);assert.equal(observed.top,8000);
console.log('Observed clouds retained when wind coverage is missing');

assert.equal(G.matchesEvent(d,{...evening,time:evening.time+5400000},5400000),true);
assert.equal(G.matchesEvent(d,{...evening,time:evening.time+5400001},5400000),false);

// Nearby overcast must occlude a distant observed clearing, including low rays.
const edge={bounds:[-106,39,-102,41],width:81,height:2,cells:Array.from({length:162},(_,i)=>i%81<25?[1,4500,8]:[0,null,null])};
assert.equal(G.lookup(edge,40,-105.5,2200,1,90,1).cover,1);
assert.equal(G.lookup(edge,40,-105.5,2200,90,90,.2).cover,1,'thin overhead layer is not skipped');
const clear={...edge,cells:edge.cells.map(()=>[0,null,null])};
assert.equal(G.lookup(clear,40,-105.5,2200,1,90,1),null,'outside downloaded region is unknown, not clear');
assert.equal(G.lookup(clear,40,-105.5,2200,90,90,1).cover,0,'known clear overhead stays clear');
console.log('Near-cloud occlusion, thin overhead layers and unknown distant coverage passed');
