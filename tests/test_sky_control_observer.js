const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('prototypes/atmosphere/candidate-layout.js','utf8');
const start=source.indexOf(' new MutationObserver('),end=source.indexOf('\n',start);
const classes=new Set(['projector']);let callback,queued=0,writes=0;
const c={document:{body:{classList:{contains:x=>classes.has(x),remove(x){classes.delete(x);writes++;queued++;}}}},recoverSky:{dataset:{}},clearTimeout(){},recoveryTimer:null,rememberSkyButton(){},revealSkyRecovery(){},MutationObserver:class{constructor(fn){callback=fn;}observe(){}}};
vm.runInNewContext(source.slice(start,end),c);
function flush(){callback();for(let i=0;queued;i++){assert.ok(i<5,'visibility observer must not schedule itself indefinitely');queued--;callback();}}
flush();assert.equal(writes,0,'already-hidden recovery controls do not rewrite body classes');
classes.add('sky-controls-awake');flush();assert.equal(writes,1,'recovery controls hide once, then observer becomes idle');
classes.add('sky-only');flush();assert.equal(c.recoverSky.dataset.active,'true');
console.log('Sky control visibility observer settles instead of looping on unchanged classes');
