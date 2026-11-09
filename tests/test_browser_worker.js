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
 // Bilinear interpolation must cross tile edges, including longitude wrapping.
 const tiles=vm.runInContext('new Tiles(0,0,1,"global")',context);
 tiles.tile=async key=>{if(!tiles.tiles.has(key)){const [x,y]=key.split(',').map(Number),data=new Float32Array(65536);for(let j=0;j<256;j++)for(let i=0;i<256;i++)data[j*256+i]=x*256+i+y*512+j*2;tiles.tiles.set(key,data);}return tiles.tiles.get(key);};
 const values=await tiles.sampleMany([[256,256],[100,512]]);
 assert.equal(values[0],766.5);assert.equal(values[1],454.5);
 console.log('Browser worker cached results, cross-date horizon reuse and tile seam sampling passed.');
})().catch(error=>{console.error(error);throw error;});
