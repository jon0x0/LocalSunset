const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('static/idle-mode.js','utf8');
const base=vm.createContext({Intl,Date});vm.runInContext(source,base);const idle=vm.runInContext('IdleMode',base);
assert.equal(idle.TIMEOUT,7200000);
assert.equal(idle.localDay(Date.parse('2026-03-09T03:59:59Z'),'America/New_York'),'2026-03-08');
assert.equal(idle.localDay(Date.parse('2026-03-09T04:00:00Z'),'America/New_York'),'2026-03-09');
assert.equal(idle.nextDay('2026-12-31'),'2027-01-01');
assert.equal(idle.nextEvent({sunrise:{utc:'2026-11-12T11:00:00Z'},sunset:{utc:'2026-11-12T23:00:00Z'}},Date.parse('2026-11-12T12:00:00Z')).mode,'sunset');
function harness(instant,age,receiver=false){
 let now=Date.parse(instant),lastInput=now-age,revision=1;
 const listeners={},timers=[],calls={calculate:[],lookahead:[],config:[],live:0},jobs=new Map();
 const nodes={lat:{value:'10'},lon:{value:'20'},height:{value:'2'},date:{value:'2026-11-10'},radius:{value:'30'},zoom:{value:'10'},source:{value:'auto'},eventMode:{value:'sunset'},remoteEvent:{value:'sunset'},syncHDMI:{checked:false},remoteToday:{checked:false},remoteLive:{checked:false},calculate:{disabled:false}};
 const coordinates=()=>({lat:10,lon:20,height:2,ground:100,near:75});
 const input=()=>({...coordinates(),date:nodes.date.value,radius:30,zoom:10,source:'auto'});
 const day=date=>({timezone:'America/New_York',sunrise:date<(calls.hiddenUntil||'')?null:{utc:date+'T11:00:00Z',azimuth:100},sunset:date<(calls.hiddenUntil||'')?null:{utc:date+'T23:00:00Z',azimuth:260},timeline:[{t:Date.parse(date+'T05:00:00Z')},{t:Date.parse(idle.nextDay(date)+'T05:00:00Z')}]});
 let config={...input(),name:'Synthetic',today:false,live:false,event:'sunset',projector:true};
 class Clock extends Date{static now(){return now;}}
 const context=vm.createContext({console,Intl,Date:Clock,localStorage:{getItem:()=>String(lastInput),setItem(){}},document:{body:{dataset:{browserEdition:receiver?'false':'true'}},addEventListener:(name,fn)=>listeners[name]=fn},setInterval:fn=>timers.push(fn),setTimeout:fn=>Promise.resolve().then(fn),$:id=>nodes[id],controllerPage:!receiver,calculationPending:false,remoteApplying:false,resultDirty:false,result:day('2026-11-10'),renderedKey:JSON.stringify(input()),realTimeView:false,realtimeRequested:false,playing:true,viewAzimuth:150,coordinates,calculationInput:input,jsonOptions:value=>({method:'POST',body:JSON.stringify(value)}),stableSettings:JSON.stringify,lastDisplayRevision:1,activeDisplaySettings:config,hdmiViewRevision:0,
  api:async(url,options={})=>{
   if(url==='/api/activity'){if(options.method==='POST')lastInput=now;return {idle_ms:now-lastInput};}
   if(url.startsWith('/api/today'))return {date:idle.localDay(now,'America/New_York')};
   if(url==='/api/calculate'){const value=JSON.parse(options.body),id=String(jobs.size);calls.lookahead.push(value);jobs.set(id,value);return {id};}
   if(url.startsWith('/api/jobs/')){if(calls.inputDuringLookahead)lastInput=now;const value=jobs.get(url.split('/').at(-1));return {status:'done',signature:[value.lat,value.lon,value.height,value.radius,value.zoom,value.source,value.date,value.ground,value.near],result:day(value.date)};}
   if(url==='/api/display-config'){if(calls.failOnce){calls.failOnce=false;throw Error('temporary failure');}if(options.method==='PUT'){assert.equal(options.headers['If-Match'],String(revision));config=JSON.parse(options.body);calls.config.push(config);revision++;}return {revision,config};}
   if(url==='/api/display-view')return {};
   throw Error(url);
  },calculateCurrent:async()=>{calls.calculate.push(input());context.result=day(nodes.date.value);context.renderedKey=JSON.stringify(input());context.resultDirty=false;return true;},enableLiveSky:()=>{calls.live++;context.realTimeView=true;context.playing=false;},draw(){},syncEventControls(){},updateCountdown(){},persistScene(){},persistView(){},status(){},localDate:ms=>idle.localDay(ms,'America/New_York')});
 vm.runInContext(source,context);
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 return {context,nodes,calls,listeners,flush,advance:ms=>{now+=ms;},remoteInput:()=>{lastInput=now;},tick:async()=>{await timers[0]();await flush();}};
}
(async()=>{
 const before=harness('2026-11-12T20:00:00Z',idle.TIMEOUT-1);await before.flush();assert.equal(before.calls.calculate.length,0);
 before.advance(2);await before.tick();assert.equal(before.nodes.date.value,'2026-11-12');assert.equal(before.context.realTimeView,true);assert.equal(before.context.playing,false);assert.equal(before.nodes.eventMode.value,'sunset');assert.equal(before.context.viewAzimuth,260);assert.equal(before.calls.calculate[0].ground,100);assert.equal(before.calls.calculate[0].near,75);
 before.listeners.keydown({isTrusted:true});assert.equal(before.context.idleUpcoming,null);const count=before.calls.calculate.length;before.advance(10000);await before.tick();assert.equal(before.calls.calculate.length,count);
 const night=harness('2026-11-13T01:00:00Z',idle.TIMEOUT+1,true);await night.flush();
 assert.equal(night.nodes.date.value,'2026-11-12');assert.equal(night.nodes.eventMode.value,'sunrise');assert.equal(night.context.idleUpcoming.event.utc,'2026-11-13T11:00:00Z');assert.equal(night.calls.lookahead[0].date,'2026-11-13');assert.equal(night.calls.config.at(-1).live,true);assert.equal(night.calls.config.at(-1).today,true);assert.equal(night.calls.config.at(-1).ground,100);
 night.advance(4*3600000+1);await night.tick();assert.equal(night.nodes.date.value,'2026-11-13');assert.equal(night.context.realTimeView,true);assert.equal(night.context.idleUpcoming.mode,'sunrise');
 night.advance(6*3600000);await night.tick();assert.equal(night.nodes.eventMode.value,'sunset');assert.equal(night.context.viewAzimuth,260);
 night.remoteInput();night.advance(5001);await night.tick();assert.equal(night.context.idleUpcoming,null);
 const interrupted=harness('2026-11-13T01:00:00Z',idle.TIMEOUT+1,true);interrupted.calls.inputDuringLookahead=true;await interrupted.flush();assert.equal(interrupted.calls.config.length,0);assert.equal(interrupted.context.idleUpcoming,null);
 const retry=harness('2026-11-13T04:59:59Z',idle.TIMEOUT+1,true);retry.calls.failOnce=true;await retry.flush();retry.advance(2000);await retry.tick();assert.equal(retry.nodes.date.value,'2026-11-13');
 const polar=harness('2026-11-13T01:00:00Z',idle.TIMEOUT+1);polar.calls.hiddenUntil='2026-11-20';await polar.flush();assert.equal(polar.context.idleUpcoming.event.utc,'2026-11-20T11:00:00Z');const searches=polar.calls.lookahead.length;polar.advance(4*3600000+1);await polar.tick();assert.equal(polar.nodes.date.value,'2026-11-13');assert.equal(polar.calls.lookahead.length,searches);
 console.log('PASS: two-hour idle threshold, real input cancellation, next-day sunrise without changing today, local midnight rollover, event handoff, retained overrides and shared Pi configuration.');
})().catch(error=>{console.error(error);process.exitCode=1;});
