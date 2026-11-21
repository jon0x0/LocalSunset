/* Opt-in snapshot experiment. All raw satellite preprocessing stays off the phone. */
const SatelliteClouds=(()=>{
 let data=null,revision=0,profile=null,profileRequest=0,satelliteRequest=0,loadedEvent='',pendingEvent='',failedEvent='',autoTimer=null,scheduledKey='',retryAt=0,activeController=null,profilePending=false,profileRetryAt=0,bundlePending=false;
 const panel=document.createElement('details');panel.className='satellite-experiment';panel.innerHTML='<summary>Experimental satellite clouds</summary><label class="check-label"><input id="satelliteEnabled" type="checkbox"> Auto-download satellite clouds</label><button id="satelliteLoad" type="button">Refresh imagery now</button> <label>Import snapshot <input id="satelliteFile" type="file" accept=".json,application/json"></label><label class="check-label"><input id="windProjection" type="checkbox" checked> Wind projection (off = still satellite image)</label><label>Assumed cloud thickness · km <input id="satelliteThickness" type="number" min="0.2" max="6" step="0.2" value="1"></label><label class="check-label"><input id="profileBases" type="checkbox" checked> Estimate bases from water/ice humidity profile</label><button id="profileLoad" type="button">Load cloud-base profile</button><p id="profileStatus" class="hint">Optional Open-Meteo profile: coordinates rounded to 0.01° are sent only when requested. Estimates apply within 50 km and ±90 min. Manual thickness is the fallback.</p><p id="satelliteStatus" role="status">Off. Enabling follows realtime and time scrolling automatically. Regional NOAA products are downloaded by the local server; coordinates are rounded to 0.01°.</p><p class="hint">Observed mask + retrieved tops; optional optical depth. Bases/thickness and lighting are approximations. One-column wind projection only; no measured cloud motion, growth/decay or hidden layers. Humidity-derived bases are uncertain, not observations. Wind projection is limited to 30 minutes. Clouds without wind coverage stay at their observed positions. With wind off, compare the still observation within 60 minutes. Outside these time limits the usual sky is used. Color graph retains the forecast model.</p>';
 document.querySelector('.atmosphere-panel').append(panel);
 const enabled=panel.querySelector('#satelliteEnabled'),status=panel.querySelector('#satelliteStatus'),thickness=panel.querySelector('#satelliteThickness');
 enabled.checked=true;
 const satellitePreference='localsunset.atmosphere.candidate.satelliteAuto';try{enabled.checked=localStorage.getItem(satellitePreference)!=='false';}catch(e){}
 const overlays=['.sky-time-group','.projector-hud'].map(selector=>{const parent=document.querySelector(selector);if(!parent)return null;const el=document.createElement('small');el.className='satellite-readout';parent.append(el);return el;}).filter(Boolean);
 function stamp(t){return new Date(t).toLocaleString([],{timeZone:result?.timezone||'UTC'})+' '+(result?.timezone||'UTC');}
 function eventContext(){
  if(!result||!renderedKey||typeof CandidateAtmosphere==='undefined')return null;
  const p=JSON.parse(renderedKey),time=realTimeView?Date.now():currentTime;
  if(!Number.isFinite(time))return null;
  const lat=Math.round(p.lat*100)/100,lon=Math.round(p.lon*100)/100,mode=document.getElementById('eventMode').value;
  return {time,lat,lon,mode,requestTime:Math.min(time,Date.now()),key:SatelliteRefresh.sourceKey(lat,lon,time,Date.now())};
 }
 async function loadEvent(){
  const event=eventContext();if(!event){status.textContent='Calculate an event first.';return;}
  if(pendingEvent)return;clearTimeout(autoTimer);scheduledKey='';
  if(activeController)activeController.abort();
  const id=++satelliteRequest;pendingEvent=event.key;failedEvent='';
  status.textContent='Retrieving '+event.mode+' imagery for '+stamp(event.time)+'…';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),180000);activeController=controller;
  try{
   let d;
   if(document.body.dataset.satelliteProvider==='browser'){
    d=await new Promise((resolve,reject)=>{
     const script=document.querySelector('script[src*="satellite-ui.js"]').src,worker=new Worker(new URL('satellite-data-worker.js',script));
     const abort=()=>{worker.terminate();reject(Error('Satellite request cancelled'));};controller.signal.addEventListener('abort',abort,{once:true});
     worker.onerror=()=>{controller.signal.removeEventListener('abort',abort);worker.terminate();reject(Error('Browser satellite worker unavailable'));};
     worker.onmessage=({data:r})=>{controller.signal.removeEventListener('abort',abort);worker.terminate();r.error?reject(Error(r.error)):resolve(r.data);};
     worker.postMessage({lat:event.lat,lon:event.lon,time:Math.floor(event.requestTime/300000)*300000});
    });
   }else{
    const u=new URL('/satellite-region',location.origin);u.search=new URLSearchParams({lat:event.lat,lon:event.lon,time:new Date(Math.floor(event.requestTime/300000)*300000).toISOString()});
    const r=await fetch(u.href,{signal:controller.signal});if(!r.ok){const error=await r.json().catch(()=>null);throw Error(error?.error||'Satellite service unavailable');}d=await r.json();
   }
   const current=eventContext();if(id!==satelliteRequest||!enabled.checked||!current||current.lat!==event.lat||current.lon!==event.lon)return;
   bundlePending=true;loadedEvent=event.key;profile=null;profileRequest++;profilePending=false;profileRetryAt=0;apply(d);panel.querySelector('#profileStatus').textContent='Profile cleared. Load a profile aligned to this observation.';
   if(event.time>Date.now())status.textContent+=' Future view uses latest observation and wind-only projection, limited to 30 min.';
   if((panel.querySelector('#profileBases').checked||panel.querySelector('#windProjection').checked)&&Math.abs(event.time-Date.parse(data.observedAt))<=1800000)await panel.querySelector('#profileLoad').onclick();
  }catch(e){if(id===satelliteRequest){failedEvent=event.key;retryAt=Date.now()+300000;status.textContent=e.message+' Existing imagery is not applied to a different event.';}}
  finally{clearTimeout(timer);if(id===satelliteRequest){pendingEvent='';bundlePending=false;changed();}}
 }
 function state(t,lat,lon){
  if(!enabled.checked)return 'off';if(!data)return 'loading imagery';
  
  if(!SatelliteCloudGeometry.cell(data,lat,lon))return 'outside region';
  const dt=t-Date.parse(data.observedAt);if(dt<0)return 'view predates observation — not applied';
  const moving=panel.querySelector('#windProjection').checked;if(dt>(moving?1800000:3600000))return moving?'beyond 30 min projection — not applied':'beyond 60 min snapshot — not applied';
  if(moving&&dt>0){if(!CloudMotion.backtrace(profile,8000,lat,lon,Date.parse(data.observedAt),t))return 'active — still observation; wind unavailable';return 'active — wind within 50 km; distant clouds held still';}
  return 'active — still observation (not a forecast)';
 }
 function describe(){if(!data)return 'No snapshot loaded.';const heights=data.cells.filter(c=>c[0]===1),valid=heights.filter(c=>c[1]!==null).length;return data.source+' · observed '+stamp(data.observedAt)+' · '+valid+'/'+heights.length+' cloudy cells have retrieved heights. Optical depth missing where retrieval unavailable; assumed τ=2 there.';}
 function acquisitionNeeded(e=eventContext()){
  return !!e&&SatelliteRefresh.needs({enabled:enabled.checked,visible:!document.hidden,target:e.time,now:Date.now(),lat:e.lat,lon:e.lon,pending:pendingEvent,failed:failedEvent,retryAt,loaded:loadedEvent,hasData:!!data,observed:data?Date.parse(data.observedAt):NaN,inRegion:!!data&&!!SatelliteCloudGeometry.cell(data,e.lat,e.lon),realtime:realTimeView});
 }
 function isUpdating(){return enabled.checked&&!!(pendingEvent||scheduledKey||bundlePending||profilePending||acquisitionNeeded());}
 function update(t,lat,lon){
  const e=eventContext();
  if(acquisitionNeeded(e)){
   if(scheduledKey!==e.key){clearTimeout(autoTimer);scheduledKey=e.key;autoTimer=setTimeout(()=>{scheduledKey='';if(enabled.checked)loadEvent();},800);}
  }
  if(enabled.checked&&!document.hidden&&data&&!profile&&!profilePending&&Date.now()>=profileRetryAt&&(panel.querySelector('#profileBases').checked||panel.querySelector('#windProjection').checked)){
   const dt=(realTimeView?Date.now():t)-Date.parse(data.observedAt);if(dt>=0&&dt<=3600000)queueMicrotask(()=>{if(!profilePending&&!profile)panel.querySelector('#profileLoad').onclick();});
  }

  const s=state(t,lat,lon);for(const el of overlays){el.hidden=!enabled.checked;el.textContent=enabled.checked?'Satellite: '+(isUpdating()?'updating data — previous sky retained':s)+(pendingEvent?' · downloading matching imagery':'')+(data?' · observed '+stamp(data.observedAt)+' · offset '+Math.round((t-Date.parse(data.observedAt))/60000)+' min':''):'';}return s;
 }
 function changed(){revision++;if(typeof CandidateAtmosphere!=='undefined'){CandidateAtmosphere.invalidate();draw();CandidateAtmosphere.refresh();}status.textContent=(enabled.checked?'Enabled. ':'Off. ')+describe();}
 function apply(d){data=SatelliteCloudGeometry.validate(d);enabled.checked=true;document.getElementById('atmosphereEnabled').checked=true;changed();}
 panel.querySelector('#profileBases').onchange=changed;panel.querySelector('#windProjection').onchange=()=>{changed();if(data&&!profile)panel.querySelector('#profileLoad').onclick();};
 panel.querySelector('#profileLoad').onclick=async()=>{
  const output=panel.querySelector('#profileStatus');if(profilePending)return;
  if(!data||!eventContext()||!SatelliteCloudGeometry.cell(data,eventContext().lat,eventContext().lon)){output.textContent='Load imagery matching the selected event first.';return;}
  if(!result||!renderedKey){output.textContent='Calculate a location first.';return;}
  const p=JSON.parse(renderedKey),lat=Math.round(p.lat*100)/100,lon=Math.round(p.lon*100)/100,target=Date.parse(data.observedAt),id=++profileRequest,snapshot=data,requestSite=eventContext();profilePending=true;
  const levels=Array.from({length:37},(_,i)=>1000-i*25);
  const fields=levels.flatMap(level=>['relative_humidity','temperature','geopotential_height','wind_speed','wind_direction'].map(name=>name+'_'+level+'hPa'));
  const u=new URL('https://api.open-meteo.com/v1/gfs');
  Object.entries({latitude:lat,longitude:lon,hourly:fields.join(','),timezone:'GMT',wind_speed_unit:'ms',start_hour:new Date(Math.round(target/3600000)*3600000).toISOString().slice(0,16),end_hour:new Date(Math.round(target/3600000)*3600000).toISOString().slice(0,16)}).forEach(([k,v])=>u.searchParams.set(k,v));
  output.textContent='Loading profile for rounded coordinates '+lat+', '+lon+'…';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
  try{
   const response=await fetch(u.href,{signal:controller.signal});if(!response.ok)throw Error('Profile provider returned '+response.status);
   const d=await response.json(),h=d.hourly;if(!h?.time?.length)throw Error('No profile data.');
   const times=h.time.map(t=>Date.parse(t+'Z'));let index=0;for(let i=1;i<times.length;i++)if(Math.abs(times[i]-target)<Math.abs(times[index]-target))index=i;
   if(Math.abs(times[index]-target)>5400000)throw Error('Snapshot is outside available profile times.');
   if(id!==profileRequest||data!==snapshot||requestSite.lat!==eventContext()?.lat||requestSite.lon!==eventContext()?.lon)return;
   profile={lat,lon,time:times[index],ground:d.elevation,levels:levels.map(level=>({z:h['geopotential_height_'+level+'hPa']?.[index],rh:h['relative_humidity_'+level+'hPa']?.[index],temperature:h['temperature_'+level+'hPa']?.[index],windSpeed:h['wind_speed_'+level+'hPa']?.[index],windDirection:h['wind_direction_'+level+'hPa']?.[index]}))};
   const diag=CloudBase.diagnostics(profile),layers=diag.layers;const pct=v=>v===null?'unavailable':Math.round(v)+'%';
   output.textContent='Profile '+stamp(profile.time)+': '+diag.count+' valid above-ground levels (25 hPa sampling). Peak RH over water '+pct(diag.maxWater)+'; over ice '+pct(diag.maxIce)+'. '+(layers.length?layers.map(l=>l.phase+' candidate base ≈'+Math.round(l.base)+' m MSL (sampling ±'+Math.round(l.uncertainty)+' m)'+(l.ambiguous?' — phase uncertain; not used':l.openBase||l.openTop?' — boundary unresolved; not used':'')).join('; '):'No supported near-saturated layers; cloud bases unknown.')+'. Assumes provider RH is water-referenced. One local column; no cloud liquid/ice content available through this endpoint. Unsupported bases remain unknown; displayed thickness is assumed.';changed();
  }catch(e){profileRetryAt=Date.now()+300000;output.textContent='Profile unavailable: '+e.message+' Manual thickness retained.';}finally{clearTimeout(timer);if(id===profileRequest){profilePending=false;if(!bundlePending)changed();}}
 };
 enabled.onchange=()=>{try{localStorage.setItem(satellitePreference,String(enabled.checked));}catch(e){}if(!enabled.checked){satelliteRequest++;profileRequest++;profilePending=false;bundlePending=false;pendingEvent='';clearTimeout(autoTimer);scheduledKey='';activeController?.abort();}else document.getElementById('atmosphereEnabled').checked=true;changed();};thickness.onchange=()=>{thickness.value=Math.max(.2,Math.min(6,Number(thickness.value)||1));changed();};
 panel.querySelector('#satelliteLoad').onclick=()=>{enabled.checked=true;try{localStorage.setItem(satellitePreference,'true');}catch(e){}loadEvent();};
 panel.querySelector('#satelliteFile').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>2000000)throw Error('Snapshot exceeds 2 MB.');const imported=SatelliteCloudGeometry.validate(JSON.parse(await file.text())),event=eventContext();if(!SatelliteCloudGeometry.matchesEvent(imported,event))throw Error('Imported snapshot does not match the selected event time/location.');satelliteRequest++;pendingEvent='';bundlePending=true;loadedEvent=event.key;profile=null;profileRequest++;profilePending=false;apply(imported);if(panel.querySelector('#profileBases').checked||panel.querySelector('#windProjection').checked)await panel.querySelector('#profileLoad').onclick();}catch(e){status.textContent=e.message;}finally{bundlePending=false;changed();}};
 function shade(rgb,alt,az,t,sunAlt,lat,lon,observer,aod=.12,options=null){
  if(!state(t,lat,lon).startsWith('active'))return null;
  const c=SatelliteCloudGeometry.lookup(data,lat,lon,observer,alt,az,Number(thickness.value),panel.querySelector('#profileBases').checked?(top,clat,clon)=>CloudBase.estimate(profile,top,clat,clon,t):null,panel.querySelector('#windProjection').checked?(height,clat,clon)=>(CloudMotion.backtrace(profile,height,clat,clon,Date.parse(data.observedAt),t)||[clat,clon]):null);if(!c)return null;if(!c.cover)return rgb;
  const tau=c.tau??2,slant=1/Math.max(.15,Math.sin(Math.max(.1,alt)*Math.PI/180)),mask=1-Math.exp(-tau*slant);
  const height=c.top/1000,dip=Math.acos(6371/(6371+height))*180/Math.PI,lit=Math.max(0,Math.min(1,(sunAlt+dip+1)/3)),warm=Math.exp(-Math.pow((sunAlt+1)/5,2));
  const lighting=options?.spectral?SpectralSky.cloudLight(sunAlt,c.top,aod,options):null;
  return rgb.map((v,i)=>v*(1-mask)+mask*(lighting?lighting[i]:(.004+lit*[.2,.15,.1][i]*(1+warm*[.8,-.1,-.6][i]))));
 }
 return {shade,update,get updating(){return isUpdating();},get revision(){return revision;}};
})();
