const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const records=new Map(['tile:x','polar:x','horizon:x','result:x','lighting-mesh:v3:x','weather:x','satellite:x'].map((key,i)=>[key,{key,value:{},bytes:(i+1)*1024}]));
// Transaction/cursor harness executes the production IndexedDB selection code.
const db={transaction(){const tx={objectStore:()=>({openCursor(){const request={},keys=[...records.keys()];let index=0;const next=()=>queueMicrotask(()=>{const key=keys[index++];request.result=key?{key,value:records.get(key),delete(){records.delete(key);},continue:next}:null;request.onsuccess();if(!key)queueMicrotask(()=>tx.oncomplete?.());});next();return request;}})};return tx;}};
const context={indexedDB:{open(){const r={result:db};queueMicrotask(()=>r.onsuccess());return r;}},queueMicrotask};vm.createContext(context);vm.runInContext(fs.readFileSync('web/cache-db.js','utf8')+';globalThis.cache=WebCache;',context);
(async()=>{
 const before=await context.cache.terrainStats();assert.equal(before.files,5);assert.equal(before.bytes,15*1024);
 const removed=await context.cache.clearTerrain();assert.equal(removed.bytes,before.bytes);assert.equal(removed.files,5);
 assert.deepEqual([...records.keys()],['weather:x','satellite:x'],'terrain clear retains unrelated records');assert.equal((await context.cache.terrainStats()).files,0);
 const input={lat:40,lon:-105,height:2,date:'2026-11-21',radius:60,zoom:10,source:'global'},key=JSON.stringify(input),storage={'localsunset.lastScene.v1':JSON.stringify({version:1,key,name:'Selected place',time:1,azimuth:90,event:'sunset',live:false,result:{terrain:{horizon:[1,2]},timeline:[1]}}),'localsunset.lastView.v1':'view preferences','localsunset.web.locations':'saved places','localsunset.style':'projector defaults','localsunset.weatherCache':'weather','localsunset.ground.v1.40,-105':'terrain ground estimate'};
 Object.defineProperties(storage,{getItem:{value:k=>storage[k]??null},setItem:{value:(k,v)=>storage[k]=v},removeItem:{value:k=>delete storage[k]}});
 const nodes={};const sceneContext={TextEncoder,localStorage:storage,cacheWritesEnabled:true,renderedKey:key,currentTime:123,viewAzimuth:270,realTimeView:false,$:id=>nodes[id]||(nodes[id]={value:id==='eventMode'?'sunrise':''})};vm.createContext(sceneContext);
 const source=fs.readFileSync('static/app.js','utf8');vm.runInContext(source.slice(source.indexOf('function terrainSceneCache('),source.indexOf('\nlet resultDirty')),sceneContext);
 assert.ok(sceneContext.terrainSceneCache().bytes>0);assert.ok(JSON.parse(storage['localsunset.lastScene.v1']).result,'measuring is read-only');sceneContext.terrainSceneCache(true);
 const metadata=JSON.parse(storage['localsunset.lastScene.v1']);assert.equal(metadata.result,undefined);assert.equal(metadata.key,key);assert.equal(metadata.time,123);assert.equal(storage['localsunset.ground.v1.40,-105'],undefined);
 assert.equal(storage['localsunset.web.locations'],'saved places');assert.equal(storage['localsunset.style'],'projector defaults');assert.equal(storage['localsunset.weatherCache'],'weather');assert.equal(storage['localsunset.lastView.v1'],'view preferences');assert.equal(sceneContext.cacheWritesEnabled,false);
 vm.runInContext(source.slice(source.indexOf('function restoreScene()'),source.indexOf('\nrestoreScene();')),sceneContext);assert.equal(sceneContext.restoreScene(),false);assert.equal(nodes.lat.value,40);assert.equal(nodes.lon.value,-105);assert.equal(sceneContext.terrainSelectionRestored,true,'reload retains selected coordinates without retained terrain');
 console.log('Terrain-only size/clear, unrelated records, preset/settings protection and location metadata restoration passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
