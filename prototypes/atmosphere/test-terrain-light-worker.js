const assert=require('node:assert/strict'),path=require('node:path'),{Worker}=require('node:worker_threads');
const file=path.join(__dirname,'terrain-light-worker.js');
const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');global.self=global;global.importScripts=name=>vm.runInThisContext(fs.readFileSync(path.join(path.dirname(workerData),name),'utf8'));self.postMessage=data=>parentPort.postMessage(data);vm.runInThisContext(fs.readFileSync(workerData,'utf8'));parentPort.on('message',data=>self.onmessage({data}));`,{eval:true,workerData:file});
const mesh={size:9,span:8000,heights:Array(81).fill(2000)};
for(let y=0;y<9;y++){mesh.heights[y*9+1]=3400;mesh.heights[y*9+6]=2600;}
const timer=setTimeout(()=>{worker.terminate();throw Error('Terrain sunlight worker timed out');},10000);
worker.on('message',r=>{
 if(r.id===1){assert.equal(r.lights.length,81);assert.ok(Number.isFinite(r.lights[40].obstruction),'worker returns reusable shadow horizon');assert.ok(r.lights[4*9+1].visibility>.99);assert.equal(r.lights[4*9+4].visibility,0);worker.postMessage({id:2,alt:35,az:90,shadows:true});}
 else {assert.equal(r.id,2);assert.ok(r.lights[4*9+4].visibility>.99);clearTimeout(timer);worker.terminate();console.log('Terrain worker advances sunrise with cached mesh and horizons off the UI thread');}
});
worker.postMessage({id:1,mesh,alt:1,az:90,shadows:true});
