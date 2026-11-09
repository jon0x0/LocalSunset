// Run with a modern Node runtime.
var fs=require('fs'),vm=require('vm'),assert=require('assert');
var source=fs.readFileSync('static/keystone.js','utf8'),nodes={},timers=new Map(),serial=0,writes=[],lastFov=75;
function node(id){return nodes[id]||(nodes[id]={value:id==='projectorFov'?'75':'0',checked:id==='keystoneEnabled',parentElement:{style:{},clientWidth:900,clientHeight:420},listeners:{},addEventListener:function(event,fn){this.listeners[event]=fn;}});}
var state={revision:0,enabled:true,grid:false,fov:75,corners:Object.fromEntries(['tl','tr','br','bl'].map(n=>[n,{x:0,y:0}]))};
var context={document:{getElementById:node,querySelector:()=>({style:{},append:()=>{}}),createElement:()=>({setAttribute:()=>{}}),body:{classList:{contains:()=>false}}},window:{innerWidth:1600,innerHeight:1200,addEventListener:()=>{}},controllerPage:true,MutationObserver:function(){this.observe=()=>{};},setFieldOfView:v=>lastFov=v,localStorage:{setItem:()=>{},getItem:()=>null},setInterval:()=>{},setTimeout:(fn,ms)=>{timers.set(++serial,{fn,ms});return serial;},clearTimeout:id=>timers.delete(id),fetch:async(url,opts)=>{if(opts){const value=JSON.parse(opts.body);writes.push(value);state={...value,revision:state.revision+1};}return {ok:true,json:async()=>state};}};
vm.createContext(context);vm.runInContext(source,context);
async function tick(){await new Promise(r=>setImmediate(r));}
function next(){const pair=[...timers].sort((a,b)=>a[1].ms-b[1].ms)[0];assert.ok(pair);timers.delete(pair[0]);pair[1].fn();}
(async()=>{
 await tick();
 for(let i=1;i<=9;i++){node('keystone_tl_x').value=String(i);node('keystone_tl_x').listeners.input();}
 assert.ok(node('view').parentElement.style.transform.indexOf('matrix3d(')===0);assert.equal(timers.size,2);next();await tick();assert.equal(writes.length,1);assert.equal(writes[0].preview,true);assert.equal(writes[0].corners.tl.x,9);
 node('projectorFov').value='100';node('projectorFov').listeners.input();assert.equal(lastFov,100);node('projectorFov').listeners.change();next();await tick();
 assert.equal(writes[writes.length-1].preview,false);assert.equal(writes[writes.length-1].fov,100);
 console.log('PASS: continuous drag coalesces latest preview without waiting for release; release persists final FOV and geometry.');
})().catch(e=>{console.error(e);process.exitCode=1;});
