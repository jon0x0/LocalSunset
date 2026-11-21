const fs=require('fs'),vm=require('vm'),assert=require('assert');
(async()=>{
 const records=new Map(),messages=[];let traces=0,solves=0;
 const terrain={observer_m:10},result={timezone:'UTC',terrain};
 const context=vm.createContext({console,URLSearchParams,AbortController,setTimeout,clearTimeout,
  importScripts:()=>{},self:{postMessage:m=>messages.push(m)},fetch:()=>{throw Error('Network must not be used');},
  WebCache:{get:async k=>records.get(k),put:async(k,v)=>records.set(k,v)},tzlookup:()=> 'UTC',
  BrowserTerrain:{trace:async()=>{traces++;return terrain;},pixels:(lat,lon)=>[lon,lat]},
  BrowserSolar:{calculate:()=>{solves++;return result;}}});
 vm.runInContext(fs.readFileSync('web/terrain-worker.js','utf8'),context);
 const input={lat:0,lon:0,height:2,radius:5,zoom:10,source:'auto',date:'2026-01-01'};
 await context.self.onmessage({data:{id:'1',input}});assert.equal(messages.at(-1).status,'done');
 await context.self.onmessage({data:{id:'2',input}});assert.equal(traces,1);assert.equal(solves,1);
 await context.self.onmessage({data:{id:'3',input:{...input,date:'2026-01-02'}}});assert.equal(traces,1);assert.equal(solves,2);
 await context.self.onmessage({data:{id:'4',input:{...input,ground:0}}});assert.equal(traces,2);assert.equal(messages.at(-1).signature.at(-2),0);assert.equal(messages.at(-1).signature.at(-1),100);
 await context.self.onmessage({data:{id:'5',input:{...input,ground:0,near:100}}});assert.equal(traces,2);
 await context.self.onmessage({data:{id:'6',input:{...input,ground:0,near:50}}});assert.equal(traces,3);
 await context.self.onmessage({data:{id:'7',input:{...input,ground:0,near:0}}});assert.equal(messages.at(-1).status,'error');assert.equal(traces,3);
 // Bilinear interpolation must cross tile edges, including longitude wrapping.
 const tiles=vm.runInContext('new Tiles(0,0,1,"global")',context);
 tiles.tile=async key=>{if(!tiles.tiles.has(key)){const [x,y]=key.split(',').map(Number),data=new Float32Array(65536);for(let j=0;j<256;j++)for(let i=0;i<256;i++)data[j*256+i]=x*256+i+y*512+j*2;tiles.tiles.set(key,data);}return tiles.tiles.get(key);};
 const values=await tiles.sampleMany([[256,256],[100,512]]);
 assert.equal(values[0],766.5);assert.equal(values[1],454.5);
 // Lighting meshes are independent of sunrise/sunset results and reuse their cache.
 context.meshSamples=0;context.BrowserTerrain.destination=(lat,lon,az,d)=>[lat+d*Math.cos(az*Math.PI/180)/111200,lon+d*Math.sin(az*Math.PI/180)/111200];
 vm.runInContext('Tiles.prototype.sampleMany=async function(points){meshSamples++;this.used.add("test elevation");return Float64Array.from(points,(_,i)=>1000+i%65);}',context);
 const lightingInput={lat:0,lon:0,zoom:10,source:'global'};
 await context.self.onmessage({data:{id:'mesh1',kind:'mesh',input:lightingInput}});
 assert.equal(messages.at(-1).status,'mesh');assert.equal(messages.at(-1).mesh.heights.length,193*193);assert.equal(context.meshSamples,1);
 await context.self.onmessage({data:{id:'mesh2',kind:'mesh',input:lightingInput}});assert.equal(context.meshSamples,1,'mesh cache prevents another terrain download');
 await context.self.onmessage({data:{id:'mesh3',kind:'mesh',input:{...lightingInput,lat:85}}});assert.equal(messages.at(-1).status,'error');
 console.log('Browser worker cached results, cross-date horizon reuse and tile seam sampling passed.');
})().catch(error=>{console.error(error);throw error;});
