const assert=require('node:assert/strict'),N=require('./event-navigation.js'),fs=require('node:fs'),vm=require('node:vm');
const hour=3600000,day=86400000,start=Date.parse('2026-11-21T07:00Z');
function prediction(date){const t=Date.parse(date+'T07:00Z');return {date,terrain:{},timeline:[{t},{t:t+day-1}],sunrise:{t:t+7*hour},sunset:{t:t+17*hour}};}
const events=p=>['sunrise','sunset'].map(mode=>({key:'astro',mode,prediction:p,t:p[mode].t}));
(async()=>{
 const search=(anchor,direction)=>N.find({date:'2026-11-21',anchor,direction,eventsForDay:date=>events(prediction(date))});
 assert.equal((await search(start+9*hour,1)).mode,'sunset');
 let e=await search(start+20*hour,1);assert.equal(e.date,'2026-11-22');assert.equal(e.mode,'sunrise');
 e=await search(start+6*hour,-1);assert.equal(e.date,'2026-11-20');assert.equal(e.mode,'sunset');
 assert.equal(N.shiftDate('2026-12-31',1),'2027-01-01');assert.equal(N.shiftDate('2026-03-08',-1),'2026-03-07');
 assert.equal(await N.find({date:'2026-11-21',anchor:start,direction:1,eventsForDay:()=>[],limit:3}),null);
 let calls=0;assert.equal(await N.find({date:'2026-11-21',anchor:start,direction:1,cancelled:()=>calls>0,eventsForDay:()=>{calls++;return events(prediction('2026-11-21'));}}),null);
 // Exercise the actual UI navigation functions with deterministic solar predictions.
 const source=fs.readFileSync(__dirname+'/candidate-ui.js','utf8');
 const fields={eventMode:{value:'sunrise'},date:{value:'2026-11-21'}};
 const c={EventNavigation:N,Date:class extends Date{static now(){return start+9*hour;}},result:prediction('2026-11-21'),realTimeView:true,currentTime:start+9*hour,locationGeneration:0,renderedKey:JSON.stringify({date:'2026-11-21'}),countdownSelection:null,eventRowsKey:'',playing:false,realtimeRequested:false,viewAzimuth:270,$:id=>fields[id],site:()=>JSON.parse(c.renderedKey),padding:()=>10,PeakAnalysis:{windowAround:()=>null},analyzePrediction:(p,mode)=>({samples:[],astro:p[mode].t,peak:null}),tableEvents:a=>[{key:'astro',t:a.astro}],syncSkyMode(){},syncEventControls(){},invalidate(){},refresh(){},persistView(){},persistScene(){},updatePlay(){},updateCountdown(){},updatePlaceTitle(){},showResult(){},status:message=>{throw Error(message);},enableLiveSky(){c.realTimeView=true;},setTime(t,fromClock=false){if(!fromClock)c.realTimeView=false;c.currentTime=t;}};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf(' // Countdown focus'),source.indexOf(' let countdownSelection')),c);
 c.predictionForDay=async date=>prediction(date);
 await c.jumpMilestone(1);assert.equal(fields.eventMode.value,'sunset');assert.equal(c.realTimeView,false);assert.equal(c.currentTime,start+17*hour,'Next from realtime previews the next sunset event');
 await c.jumpMilestone(-1);assert.equal(c.realTimeView,true,'Prev from sunset enters realtime between sunrise and sunset');assert.equal(c.currentTime,start+9*hour);
 await c.jumpMilestone(-1);assert.equal(fields.eventMode.value,'sunrise');assert.equal(c.realTimeView,false);assert.equal(c.currentTime,start+7*hour);
 await c.jumpMilestone(1);assert.equal(c.realTimeView,true,'Next from last sunrise enters realtime');
 await c.jumpMilestone(1);assert.equal(fields.eventMode.value,'sunset');assert.equal(c.realTimeView,false);
 await c.jumpMilestone(1);assert.equal(c.result.date,'2026-11-22');assert.equal(fields.date.value,'2026-11-22');assert.equal(c.currentTime,start+day+7*hour);assert.equal(c.viewAzimuth,270);
 await c.jumpMilestone(-1);assert.equal(c.result.date,'2026-11-21');assert.equal(fields.eventMode.value,'sunset');assert.equal(c.realTimeView,false);
 // Realtime is also reachable while browsing a previous date.
 c.currentTime=start-hour;c.result=prediction('2026-11-20');c.renderedKey=JSON.stringify({date:'2026-11-20'});
 await c.jumpMilestone(1);assert.equal(c.realTimeView,false);assert.equal(fields.eventMode.value,'sunrise');
 await c.jumpMilestone(1);assert.equal(c.realTimeView,true);assert.equal(fields.date.value,'2026-11-21');
 // Run the real day worker's imports and astronomical solver (no network or DEM fetch).
 const path=require('node:path'),root=path.resolve(__dirname,'../..'),worker={Intl,Date,Math};worker.self=worker;
 vm.createContext(worker);worker.importScripts=(...names)=>names.forEach(name=>vm.runInContext(fs.readFileSync(path.join(root,name.startsWith('vendor/')?'static':'web',name),'utf8'),worker));
 let solved;worker.postMessage=data=>{assert.equal(data.error,undefined);solved=data.result;};
 vm.runInContext(fs.readFileSync(path.join(root,'web/solar-day-worker.js'),'utf8'),worker);
 worker.onmessage({data:{lat:39.68,lon:-105.15,date:'2026-11-22',zone:'America/Denver',terrain:{observer_m:1800,horizon:Array(360).fill(0)}}});
 assert.ok(Date.parse(solved.sunrise.utc)<Date.parse(solved.sunset.utc));
 assert.equal(solved.timeline[0].t,Date.parse('2026-11-22T07:00Z'));
 assert.ok(Date.parse(solved.sunrise.utc)>solved.timeline[0].t);
 const buttons={skyRealtime:{setAttribute(){},classList:{toggle(){}}},skyPrevEvent:{},skyNextMilestone:{}};c.$=id=>buttons[id]||fields[id];
 vm.runInContext(source.slice(source.indexOf(' function syncSkyMode'),source.indexOf(' function precipitationText')),c);
 c.currentTime=start+23*hour;c.syncSkyMode();assert.equal(buttons.skyNextMilestone.disabled,false,'Next remains enabled after all sunrise milestones');
 console.log('Chronological sunrise/sunset navigation, adjacent dates, cancellation, realtime stop and preview integration passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
