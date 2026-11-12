/* Shared inactivity tracking and unattended, local-date solar-event following. */
var idleUpcoming=null,idleApplying=false;
const IdleMode=(()=>{
 const TIMEOUT=2*60*60*1000,KEY='localsunset.idle.activity.v1';
 function localDay(ms,zone){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));return p.year+'-'+p.month+'-'+p.day;}
 function nextDay(day){return new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10);}
 function nextEvent(day,now){return ['sunrise','sunset'].filter(mode=>day[mode]&&Date.parse(day[mode].utc)>now).map(mode=>({mode,event:day[mode]})).sort((a,b)=>Date.parse(a.event.utc)-Date.parse(b.event.utc))[0]||null;}
 function start(){
  const storedInput=Number(localStorage.getItem(KEY));let initialRead=true;
  let lastInput=storedInput||Date.now(),lastPost=0,lastRead=0,busy=false,generation=0,active=false,lookahead=null,retryAt=0;
  const remember=()=>{try{localStorage.setItem(KEY,String(lastInput));}catch(error){}};
  const cancel=()=>{generation++;active=false;idleUpcoming=null;lookahead=null;retryAt=0;};
  function activity(event){if(!event.isTrusted)return;lastInput=Date.now();remember();cancel();if(Date.now()-lastPost>=1000){lastPost=Date.now();api('/api/activity',jsonOptions({})).catch(()=>{});}}
  for(const name of ['pointerdown','pointermove','wheel','keydown','input','change'])document.addEventListener(name,activity,{capture:true,passive:true});
  async function sharedActivity(force=false){if(!force&&Date.now()-lastRead<5000)return;lastRead=Date.now();try{const state=await api('/api/activity'),remote=Date.now()-state.idle_ms;if(initialRead&&!storedInput||remote>lastInput+100){lastInput=remote;remember();cancel();}initialRead=false;}catch(error){/* Local browser use can continue through an interrupted connection. */}}
  async function run(){
   if(busy)return;busy=true;
   try{
    await sharedActivity();
    const dayChanged=result&&localDay(Date.now(),result.timezone)!==$('date').value;
    if(Date.now()-lastInput<TIMEOUT||calculationPending||remoteApplying||(!dayChanged&&Date.now()<retryAt))return;
    if($('lat').value===''||$('lon').value==='')return;
    let workingDay=null,selection=null;
    const selectionKey=()=>JSON.stringify({...calculationInput(),date:null});
    const token=generation,valid=()=>token===generation&&Date.now()-lastInput>=TIMEOUT&&(!selection||selectionKey()===selection)&&(!workingDay||!result||localDay(Date.now(),result.timezone)===workingDay);
    const mirror=controllerPage&&$('syncHDMI').checked&&document.body.dataset.browserEdition!=='true';
    if(mirror){const state=await api('/api/display-config');if(!valid())return;if(state.config&&(state.revision!==lastDisplayRevision||!active)){lastDisplayRevision=-1;await applyRemoteDisplay(state);if(!valid())return;hdmiConfigRevision=state.revision;hdmiBaseKey=stableSettings(state.config);hdmiBlocked=false;}}
    idleApplying=true;
    const position=coordinates(),day=result&&!resultDirty?localDay(Date.now(),result.timezone):(await api('/api/today?lat='+position.lat+'&lon='+position.lon)).date;
    workingDay=day;selection=selectionKey();
    if(!valid())return;
    const key=JSON.stringify({...calculationInput(),date:day});
    if(!result||renderedKey!==key||resultDirty){$('date').value=day;realtimeRequested=true;if(!await calculateCurrent())throw Error('Could not update the unattended sky.');if(!valid())return;}
    const entering=!active;active=true;$('remoteToday').checked=true;$('remoteLive').checked=true;if(!realTimeView||playing||entering)enableLiveSky();
    let next=nextEvent(result,Date.now());
    const identity=selectionKey();
    if(!next&&lookahead&&lookahead.key===identity&&Date.parse(lookahead.next.event.utc)>Date.now())next=lookahead.next;
    if(!next){
     // Keep today's sky/date visible while looking ahead, even in polar seasons.
     idleUpcoming=null;let searchDay=nextDay(day);
     for(let count=0;count<370&&!next;count++,searchDay=nextDay(searchDay)){
      await sharedActivity();
      if(!valid())return;
      const job=await api('/api/calculate',jsonOptions({...calculationInput(),date:searchDay}));let state=await api('/api/jobs/'+job.id);
      while(state.status==='queued'||state.status==='running'){await new Promise(resolve=>setTimeout(resolve,500));if(!valid())return;state=await api('/api/jobs/'+job.id);}
      if(state.status==='error')throw Error(state.error);
      const input=calculationInput(),expected=[input.lat,input.lon,input.height,input.radius,input.zoom,input.source,searchDay];if(input.ground!=null)expected.push(input.ground,input.near??100);
      if(JSON.stringify(state.signature)!==JSON.stringify(expected))throw Error('Lookahead calculation did not match this location.');
      if(!valid())return;next=nextEvent(state.result,Date.now());
     }
     if(next)lookahead={key:identity,next};else retryAt=Date.now()+3600000;
    }
    if(!valid())return;
    const previous=idleUpcoming;idleUpcoming=next;
    if(next){const changed=entering||!previous||previous.mode!==next.mode||previous.event.utc!==next.event.utc;$('eventMode').value=next.mode;$('remoteEvent').value=next.mode;if(changed){viewAzimuth=next.event.azimuth;draw();status('Unattended realtime: next '+next.mode+' on '+localDate(Date.parse(next.event.utc))+'.');}syncEventControls();}
    updateCountdown();persistScene();persistView();
    if(!controllerPage){
     // The kiosk owns unattended shared settings; idle controller tabs follow it.
     const state=await api('/api/display-config');await sharedActivity(true);if(!valid())return;
     if(state.config){const config={...state.config,date:day,today:true,live:true,event:next?next.mode:$('eventMode').value};
      if(stableSettings(config)!==stableSettings(state.config)){const saved=await api('/api/display-config',{...jsonOptions(config),method:'PUT',headers:{'Content-Type':'application/json','If-Match':String(state.revision)}});if(!valid())return;lastDisplayRevision=saved.revision;activeDisplaySettings=saved.config;hdmiViewRevision=0;await api('/api/display-view',{...jsonOptions({config_revision:saved.revision,time_ms:Date.now(),azimuth:viewAzimuth,event:config.event,playing:false,live:true}),method:'PUT'});}
     }
    }
   }catch(error){retryAt=Date.now()+30000;status('Unattended tracking will retry. Current scene retained.');}
   finally{idleApplying=false;busy=false;}
  }
  document.addEventListener('visibilitychange',run);setInterval(run,1000);run();
 }
 return {TIMEOUT,localDay,nextDay,nextEvent,start};
})();
if(typeof document!=='undefined')IdleMode.start();
