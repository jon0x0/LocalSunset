'use strict';
const assert=require('assert'),M=require('./model.js');
for(const aod of [0,.12,1,3])for(const sun of [-18,-6,0,10])for(const alt of [0,6,60,90]){
 const rgb=M.radiance(alt,30,sun,aod,1600);
 assert(rgb.every(v=>Number.isFinite(v)&&v>=0),'finite nonnegative radiance');
 assert(M.display(rgb).every(v=>v>=0&&v<=255),'bounded display');
}
const day=M.metrics(M.radiance(45,90,10)),night=M.metrics(M.radiance(45,90,-18));
assert(day.luminance>night.luminance,'Earth shadow darkens sky');
const clear=M.radiance(6,0,0,0),ratio=clear[0]/clear[2];
assert(ratio>M.radiance(60,90,30,0)[0]/M.radiance(60,90,30,0)[2],'long sunset path warms spectrum');
assert.deepStrictEqual(M.windows([{t:0,potential:2},{t:1,potential:3}]),[]);
assert.deepStrictEqual(M.windows([0,40,50,0,50].map((potential,t)=>({t,potential}))),[[1,2],[4,4]]);
const data={hourly:{time:['2026-11-20T00:00','2026-11-20T01:00'],temperature_2m:[-10,10],cloud_cover:[20,80],cloud_cover_low:[0,100],cloud_cover_mid:[null,null]}};
assert.strictEqual(M.weatherAt(data,Date.parse('2026-11-20T00:30Z')).low,50);
assert.strictEqual(M.weatherAt(data,Date.parse('2026-11-20T00:30Z')).mid,null);
assert.strictEqual(M.weatherAt(data,0),null);
console.log('Atmosphere invariants, spectral trend, windows and weather interpolation passed.');

// Component metrics distinguish saturated blue from visible warm light.
const neutral=M.metrics([.1,.1,.1]),blue=M.metrics([.01,.02,.1]),red=M.metrics([.1,.04,.01]),dimRed=M.metrics([.001,.0004,.0001]);
assert.strictEqual(neutral.colorfulness,0);assert.strictEqual(neutral.warmStrength,0);
assert(blue.colorfulness>0);assert.strictEqual(blue.warmStrength,0);
assert(red.warmStrength>dimRed.warmStrength);assert(Math.abs(red.colorfulness-dimRed.colorfulness)<1e-10);
assert.strictEqual(red.potential,100*red.chroma*(1-Math.exp(-red.luminance*35)),'existing peak formula retained');
console.log('Colorfulness, warm-color discrimination, brightness weighting and peak compatibility passed.');

assert.strictEqual(M.weatherAt(data,Date.parse('2026-11-20T00:30Z')).total,50);

assert.strictEqual(M.weatherAt(data,Date.parse('2026-11-20T00:30Z')).temperature,0);
assert.strictEqual(M.weatherAt({hourly:{time:data.hourly.time}},Date.parse('2026-11-20T00:30Z')).temperature,null);

const windData={hourly:{time:data.hourly.time,wind_speed_10m:[10,20],wind_direction_10m:[350,10]}};
const wind=M.weatherAt(windData,Date.parse('2026-11-20T00:30Z'));
assert.strictEqual(wind.windSpeed,15);assert.strictEqual(wind.windDirection,0,'direction crosses north, not south');
windData.hourly.wind_direction_10m=[10,350];assert.strictEqual(M.weatherAt(windData,Date.parse('2026-11-20T00:30Z')).windDirection,0);
windData.hourly.wind_direction_10m=[null,10];assert.strictEqual(M.weatherAt(windData,Date.parse('2026-11-20T00:30Z')).windDirection,null);
console.log('Wind speed and circular direction interpolation passed.');
