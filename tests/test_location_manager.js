const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),M=require('../static/location-manager.js');
const places=[{name:'One',lat:40,lon:-105,height:2,ground:2100,near:75,note:'retained metadata'},{name:'Two',lat:41,lon:-104,height:3}];
const reordered=M.normalize([places[1],{...places[0],name:'Renamed'}]);assert.equal(reordered[1].ground,2100);assert.equal(reordered[1].near,75);assert.equal(reordered[1].note,'retained metadata');assert.equal(places[0].name,'One','draft normalization never edits original records');
assert.deepEqual(M.normalize([]),[]);assert.equal(M.uniqueName('One',places),'One (2)');
assert.throws(()=>M.normalize([...places,places[0]]),/Duplicate/);assert.throws(()=>M.normalize([{name:'Bad',lat:'',lon:0,height:2}]),/lat/);assert.throws(()=>M.normalize([{...places[0],lat:91}]),/lat/);assert.throws(()=>M.normalize([{...places[0],near:1}]),/ground/);
// Exercise browser persistence independently of the UI and real saved locations.
const storage=new Map(),context={URL,Response,JSON,Number,Date,Math,Map,location:{origin:'http://localhost'},document:{baseURI:'http://localhost/'},navigator:{},tzlookup:()=> 'America/Denver',localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},window:{fetch:async()=>{throw Error('unexpected network request');},addEventListener(){}}};
vm.createContext(context);vm.runInContext(fs.readFileSync('web/browser-api.js','utf8'),context);
const request=(method,body)=>context.window.fetch('/api/locations',{method,body:JSON.stringify(body)});
(async()=>{
 for(const p of places)assert.equal((await request('POST',p)).status,200);
 let response=await request('PUT',{expected:places,locations:reordered});assert.equal(response.status,200);assert.deepEqual(await response.json(),reordered);
 response=await request('PUT',{expected:places,locations:[]});assert.equal(response.status,409,'stale edits cannot erase newer saved places');
 response=await context.window.fetch('/api/locations');assert.deepEqual(await response.json(),reordered);
 response=await request('PUT',{expected:reordered,locations:[{...places[0],height:-1}]});assert.equal(response.status,400);
 response=await context.window.fetch('/api/locations');assert.deepEqual(await response.json(),reordered,'invalid edits leave persisted locations intact');
 console.log('Saved places: drafts, rename/order, metadata, validation and browser conflict-safe persistence passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
