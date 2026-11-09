/* Run from the repository root with modern Node.js. */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context=vm.createContext({console,Intl,Date});
for(const path of ['static/vendor/astronomy.browser.min.js','web/solar-core.js','web/terrain-core.js'])vm.runInContext(fs.readFileSync(path,'utf8'),context,{filename:path});
const solar=vm.runInContext('BrowserSolar',context),terrain=vm.runInContext('BrowserTerrain',context);
for(const fixture of JSON.parse(fs.readFileSync('tests/browser-solar-fixtures.json','utf8'))){
 const result=solar.calculate(fixture.lat,fixture.lon,fixture.date,fixture.zone,fixture.terrain);
 assert.equal(result.status,fixture.expected.status);assert.equal(result.timeline.length,fixture.samples);
 for(const event of ['sunrise','sunset'])assert.equal(result[event]?Date.parse(result[event].utc):null,fixture.expected[event]?Date.parse(fixture.expected[event].utc):null);
}
assert.deepEqual(Array.from(terrain.pixels(0,0,10)),[131072,131072]);
assert(Math.abs(terrain.destination(0,0,90,1000)[1]-0.008993203637)<1e-10);
assert(terrain.destination(90,0,180,1000).every(Number.isFinite));
assert(terrain.angle(100,102,1000)<0);
console.log('Browser solar parity, DST, polar day and terrain geometry passed.');
