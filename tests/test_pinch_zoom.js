const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('static/app.js','utf8'),handlers={},captures=new Set(),events=[];
const canvas={addEventListener:(name,fn)=>handlers[name]=fn,setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id),classList:{add(){},remove(){}},focus(){},getBoundingClientRect:()=>({width:600})};
const slider={value:75,dispatchEvent:e=>{events.push(e.type);context.VIEW_FOV=Number(slider.value);}};
const context=vm.createContext({canvas,result:{},VIEW_FOV:75,viewAzimuth:270,panDrag:null,Event:class{constructor(type){this.type=type;}},$:()=>slider,setViewAzimuth:value=>context.viewAzimuth=value});
vm.runInContext(source.slice(source.indexOf('const skyTouches='),source.indexOf("canvas.addEventListener('keydown'")),context);
function send(type,id,x,y=0,extra={}){let prevented=false;handlers[type]({pointerType:'touch',pointerId:id,clientX:x,clientY:y,isPrimary:id===1,button:0,preventDefault(){prevented=true;},...extra});return prevented;}
assert(send('pointerdown',1,100));send('pointermove',1,120);assert.equal(context.viewAzimuth,267.5);
send('pointerdown',2,220);send('pointermove',2,320);assert.equal(Number(slider.value),38);assert.equal(context.viewAzimuth,267.5);
send('pointermove',2,1120);assert.equal(Number(slider.value),30);
send('pointermove',2,130);assert.equal(Number(slider.value),120);
send('pointerup',2,130);assert(events.includes('change'));const az=context.viewAzimuth;send('pointermove',1,120);assert.equal(context.viewAzimuth,az);
send('pointercancel',1,120);assert.equal(captures.size,0);
send('pointerdown',3,100);send('lostpointercapture',3,100);assert.equal(captures.size,0);
// Mouse dragging remains available, and touches without a scene do nothing.
send('pointerdown',4,100,0,{pointerType:'mouse',isPrimary:true});send('pointermove',4,150,0,{pointerType:'mouse'});assert(context.viewAzimuth<az);send('pointerup',4,150,0,{pointerType:'mouse'});
context.result=null;assert.equal(send('pointerdown',5,100),false);assert.equal(captures.size,0);
console.log('PASS: phone pinch updates FOV live, clamps zoom, commits, resumes pan without jumping and handles cancellation.');
