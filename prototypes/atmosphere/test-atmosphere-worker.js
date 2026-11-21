const assert=require('node:assert/strict'),{Worker}=require('node:worker_threads'),path=require('node:path');
const root=__dirname;
const worker=new Worker(`const {parentPort}=require('node:worker_threads');global.self=global;global.SpectralSky=require(${JSON.stringify(path.join(root,'spectral-sky.js'))});global.importScripts=()=>{global.GlowModel=require(${JSON.stringify(path.join(root,'model.js'))})};global.postMessage=(data,transfer)=>parentPort.postMessage(data,transfer);require(${JSON.stringify(path.join(root,'atmosphere-worker.js'))});parentPort.on('message',data=>self.onmessage({data}));`,{eval:true});
let uiTicked=false;setTimeout(()=>{uiTicked=true;},0);
worker.on('message',data=>{try{assert.equal(data.key,'test');assert.equal(data.pixels.length,64*28*3);assert.ok(Array.from(data.pixels).every(Number.isFinite));assert.ok(uiTicked,'main event loop must remain available during integration');console.log('Full sky integration runs in worker with a responsive main event loop');}finally{worker.terminate();}});
worker.on('error',error=>{console.error(error);process.exitCode=1;});
worker.postMessage({options:{spectral:true,ozoneDU:300},key:'test',width:64,height:28,focus:240,fov:75,base:300,h:500,scale:10,sunAz:240,sunAlt:-1,aod:.12,observer:2000});
