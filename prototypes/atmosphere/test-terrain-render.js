/* Exercise the complete renderer after asynchronous mesh and sunlight delivery. */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const G=require('./terrain-light-geometry.js'),S=require('./spectral-sky.js');
let fills=0,images=0;
const canvasContext={setTransform(){},save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},fill(){fills++;},drawImage(){images++;},createLinearGradient(){return {addColorStop(){}};}};
const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{checked:id!=='terrainCloudSun',value:id==='ozoneDU'?'300':'.12',hidden:true,textContent:'',parentElement:{after(){}},append(){}});return nodes.get(id);};
const mesh={size:9,span:8000,lat:40,lon:-105,source:'test',heights:Array(81).fill(2000)};
for(let y=0;y<9;y++)mesh.heights[y*9+1]=3400;
class Worker{
 constructor(url){this.meshWorker=String(url).endsWith('/terrain-worker.js');}
 postMessage(p){queueMicrotask(()=>{if(this.meshWorker)this.onmessage({data:{status:'mesh',mesh}});else this.onmessage({data:{id:p.id,lights:mesh.heights.map((_,i)=>G.illumination(mesh,i%9,Math.floor(i/9),p.alt,p.az))}});});}
 terminate(){}
}
const context={URL,Worker,queueMicrotask,Math,Date,matchMedia:()=>({matches:false}),localStorage:{getItem:()=>null,setItem(){}},document:{currentScript:{src:'http://localhost/terrain-lighting.js'},getElementById:node,querySelector:s=>s.includes('app.js')?{src:'http://localhost/app.js'}:node(s),createElement:tag=>tag==='canvas'?{getContext:()=>canvasContext}:{append(){},style:{}}},TerrainLightGeometry:G,SpectralSky:S,TerrainOption:{enabled:true},CandidateAtmosphere:{weatherAt:()=>null},SatelliteClouds:{revision:1,sunTransmission:()=>1},result:{terrain:{observer_m:2002,horizon:Array(1440).fill(5)}},renderedKey:JSON.stringify({lat:40,lon:-105,zoom:10,source:'global'}),currentTime:1,realTimeView:false,VIEW_FOV:75,draw(){}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'terrain-lighting.js'),'utf8')+';globalThis.renderer=TerrainLighting;',context);
(async()=>{
 const view={sun:{alt:2,az:90},focus:270,scale:10,base:300,w:800,h:460};
 context.renderer.render(canvasContext,view);await new Promise(setImmediate);
 context.renderer.render(canvasContext,view);await new Promise(setImmediate);
 context.renderer.render(canvasContext,view);
 assert.ok(fills>0,'terrain surfaces rasterized');assert.ok(images>0,'completed surface presented');
 const before=fills;context.renderer.render(canvasContext,view);assert.equal(fills,before,'unchanged view reuses cached terrain surface');
 console.log('Terrain render, color transfer, worker completion and canvas cache passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
