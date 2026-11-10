const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context=vm.createContext({console});vm.runInContext(fs.readFileSync('web/terrain-core.js','utf8'),context);
const terrain=vm.runInContext('BrowserTerrain',context);
(async()=>{
 const provider={spacing:150,used:new Set(['synthetic']),sampleMany:async points=>points.map(([lat,lon])=>terrain.R*Math.hypot(lat*Math.PI/180,lon*Math.PI/180)<95?500:0)};
 const clear=await terrain.trace(provider,0,0,2,5,()=>{},400);
 const blocked=await terrain.trace(provider,0,0,2,5,()=>{},400,50);
 assert.equal(clear.dem_ground_m,500);assert.equal(clear.ground_m,400);assert.equal(clear.observer_m,402);assert.equal(clear.near_m,100);
 assert(Math.max(...clear.horizon)<0);assert(Math.min(...blocked.horizon)>45);
 console.log('PASS: browser ground override lowers observer while excluding the nearby DEM wall; configurable exclusion preserves distant terrain.');
})().catch(error=>{console.error(error);process.exitCode=1;});
