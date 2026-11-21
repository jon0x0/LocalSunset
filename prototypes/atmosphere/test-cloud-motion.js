const assert=require('node:assert/strict'),M=require('./cloud-motion.js');
const p={lat:40,lon:-105,time:0,levels:[{z:1000,windSpeed:10,windDirection:270},{z:10000,windSpeed:10,windDirection:270}]};
const w=M.windAt(p,5000);assert.ok(Math.abs(w[0]-10)<1e-6);assert.ok(Math.abs(w[1])<1e-6);
const source=M.backtrace(p,5000,40,-105,0,5400000);assert.ok(source[1]<-105,'eastbound wind must sample westward source');assert.ok(Math.abs(source[0]-40)<1e-6);
assert.equal(M.backtrace(p,5000,40,-105,0,5400001),null);assert.equal(M.backtrace(p,5000,40,-105,0,-1),null);assert.equal(M.backtrace(null,5000,40,-105,0,1),null);assert.equal(M.windAt(p,20000),null);
const circular={...p,levels:[{z:1000,windSpeed:10,windDirection:350},{z:2000,windSpeed:10,windDirection:10}]};assert.ok(Math.abs(M.windAt(circular,1500)[0])<1e-6);assert.ok(M.windAt(circular,1500)[1]<0);
console.log('Wind interpolation, meteorological direction, backtracing and projection limits passed');
