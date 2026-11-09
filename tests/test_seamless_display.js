// Run with a modern Node.js runtime: node tests/test_seamless_display.js
var fs=require('fs'),vm=require('vm'),assert=require('assert');
var source=fs.readFileSync('static/app.js','utf8');
var nodes={},old={timeline:[{t:1},{t:2}]},next={timeline:[{t:3},{t:4}]};
['lat','lon','height','radius','zoom','source','date','search','syncStatus','placeTitle','syncHDMI','sceneUpdate'].forEach(id=>nodes[id]={value:'1',checked:false});
var fail=false,resolveJob;
var context={result:old,resultDirty:false,calculationPending:false,renderedKey:'',displayedName:'OLD POINT',currentName:'NEW POINT',locationGeneration:0,controllerPage:false,realTimeView:false,realtimeRequested:false,viewAzimuth:270,remoteApplying:false,activeDisplaySettings:null,
 $:id=>nodes[id],coordinates:()=>({lat:1,lon:2,height:3}),document:{querySelectorAll:()=>[]},setTimeout:fn=>fn(),status:()=>{},jsonOptions:x=>x,queueHDMI:()=>{},persistScene:()=>{},showResult:()=>{},enableLiveSky:()=>{},displayParams:{get:()=>null},
 api:async url=>{if(url==='/api/calculate')return {id:1};if(fail)throw Error('offline');return await new Promise(r=>resolveJob=r);}};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function calculationInput()'),source.indexOf('for(const id')),context);
vm.runInContext(source.slice(source.indexOf('async function calculateCurrent()'),source.indexOf("$('calculateForm')")),context);
(async()=>{
 context.invalidateResult();assert.strictEqual(context.result,old);context.updatePlaceTitle();assert.equal(nodes.placeTitle.textContent,'OLD POINT');
 var pending=context.calculateCurrent();await new Promise(r=>setImmediate(r));assert.strictEqual(context.result,old);assert.equal(context.calculationPending,true);
 resolveJob({status:'done',signature:[1,2,3,1,1,'1','1'],result:next});assert.equal(await pending,true);assert.strictEqual(context.result,next);assert.equal(nodes.placeTitle.textContent,'NEW POINT');assert.equal(context.resultDirty,false);
 pending=context.calculateCurrent();await new Promise(r=>setImmediate(r));resolveJob({status:'done',signature:[99,2,3,1,1,'1','1'],result:old});assert.equal(await pending,false);assert.strictEqual(context.result,next);
 fail=true;assert.equal(await context.calculateCurrent(),false);assert.strictEqual(context.result,next);assert.equal(context.calculationPending,false);
 fail=false;pending=context.calculateCurrent();await new Promise(r=>setImmediate(r));context.invalidateResult();resolveJob({status:'done',result:old});assert.equal(await pending,false);assert.strictEqual(context.result,next);
 console.log('PASS: old scene and label retained during loading and failure; successful commit is atomic; obsolete completion discarded.');
})().catch(e=>{console.error(e);process.exitCode=1;});
