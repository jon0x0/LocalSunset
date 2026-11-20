const assert=require('assert'),P=require('./peak-analysis.js');
const samples=Array.from({length:121},(_,i)=>({t:i*60000,potential:50-Math.abs(i-60)}));
const peak=P.peak(samples);assert.strictEqual(peak.t,3600000);
assert.deepStrictEqual(P.windowAround(samples,peak,10),[3000000,4200000]);
assert.deepStrictEqual(P.windowAround(samples,peak,20),[2400000,4800000]);
assert.deepStrictEqual(P.windowAround(samples,samples[1],10),[0,660000]);
assert.strictEqual(P.peak([]),null);assert.strictEqual(P.peak([{t:0,potential:2}]),null);
assert.strictEqual(P.windowAround(samples,null,10),null);
console.log('Peak timing, configurable windows, range clipping and weak-event handling passed.');
