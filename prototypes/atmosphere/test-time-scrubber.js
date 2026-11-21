const assert=require('node:assert/strict'),S=require('./time-scrubber.js');
let t=Date.parse('2026-11-21T14:00Z');
for(let i=0;i<7;i++)t=S.move(t,-300,300,2);
assert.equal(t,Date.parse('2026-11-22T04:00Z'),'repeated swipes extend well beyond the event window');
assert.equal(S.move(t,300,300,12),t-12*3600000,'reverse/coarse swipe has no thumb endpoint');
assert.equal(S.day(Date.parse('2026-11-22T06:59Z'),'America/Denver'),'2026-11-21');
assert.equal(S.day(Date.parse('2026-11-22T07:00Z'),'America/Denver'),'2026-11-22');
const fallDay={timeline:[{t:Date.parse('2026-11-01T06:00Z')},{t:Date.parse('2026-11-02T07:00Z')}]};
assert.equal(S.covers(fallDay,Date.parse('2026-11-02T06:30Z')),true,'25-hour local day is not clamped at 24 hours');
assert.equal(S.covers(fallDay,Date.parse('2026-11-02T07:00Z')),false,'exact next midnight loads the next date');
assert.equal(S.day(Date.parse('2026-11-01T07:30Z'),'America/Denver'),S.day(Date.parse('2026-11-01T08:30Z'),'America/Denver'),'repeated daylight-saving hour retains local date');
console.log('Unbounded relative time, coarse/reverse swipes, midnight and DST day coverage passed');

const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),nodes=[];
function element(){const n={style:{},handlers:{},append(){},setAttribute(k,v){this[k]=v;},addEventListener(k,v){this.handlers[k]=v;},getBoundingClientRect(){return {width:300};}};nodes.push(n);return n;}
const date={value:'2026-11-21'},start=Date.parse('2026-11-21T07:00Z');let calculations=0;
const context={Intl,Date,Math,Number,setTimeout,clearTimeout,setInterval(){},document:{hidden:false,createElement:element,querySelector:()=>({after(){}})},result:{timezone:'America/Denver',timeline:[{t:start},{t:start+86400000}]},currentTime:Date.parse('2026-11-21T14:00Z'),realTimeView:true,realtimeRequested:true,playing:true,calculationPending:false,locationGeneration:0,viewAzimuth:270,$:()=>date,updatePlay(){},formatClock:t=>String(t),localDate:t=>String(t),status(){},persistView(){},CandidateAtmosphere:{refresh(){}},setTime(t){assert.ok(S.covers(context.result,t),'selected time belongs to completed date');context.currentTime=t;},calculateCurrent(){context.locationGeneration++;calculations++;return new Promise(resolve=>setImmediate(()=>{const begin=Date.parse(date.value+'T07:00Z');context.result={timezone:'America/Denver',timeline:[{t:begin},{t:begin+86400000}]};context.viewAzimuth=115;context.realTimeView=true;resolve(true);}));}};
// Freeze the realtime anchor for a deterministic starting point.
context.realTimeView=false;
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'time-scrubber.js'),'utf8'),context);
const track=nodes.find(n=>n.role==='spinbutton');
for(let i=0;i<20;i++)track.handlers.keydown({key:'PageUp',preventDefault(){}});
(async()=>{
 for(let i=0;i<10;i++)await new Promise(setImmediate);
 assert.equal(context.currentTime,Date.parse('2026-11-26T14:00Z'),'latest requested time survives in-flight day calculations');
 assert.equal(date.value,'2026-11-26');assert.equal(context.viewAzimuth,270,'date transition retains viewing direction');assert.equal(context.realTimeView,false,'day calculation cannot force preview back to realtime');
 assert.equal(calculations,2,'in-flight request finishes, then jumps to latest required date');
 const anchor=context.currentTime;nodes.find(n=>n['aria-label']==='Time swipe scale').value='2';
 track.setPointerCapture=()=>{};track.hasPointerCapture=()=>false;
 track.handlers.pointerdown({isPrimary:true,button:0,pointerId:1,clientX:300,clientY:10});
 track.handlers.pointermove({pointerId:1,clientX:0,clientY:10,preventDefault(){}});
 track.handlers.pointermove({pointerId:1,clientX:-300,clientY:10,preventDefault(){}});
 assert.equal(context.currentTime,anchor,'rapid drag does not render every pointer movement');
 track.handlers.pointerup({pointerId:1});
 assert.equal(context.currentTime,anchor+4*3600000,'release presents the latest accumulated relative drag');
 console.log('Pointer drag coalescing and release-to-latest-time passed');
 console.log('Date-transition integration: generation changes, rapid input catch-up, heading and preview mode passed');
})();
