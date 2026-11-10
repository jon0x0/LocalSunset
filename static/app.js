// Only auto/kiosk pages follow shared configuration. Projector is a layout.
const controllerPage=new URLSearchParams(window.location.search).get('auto')!=='1';
let hdmiTimer=null, hdmiSending=false, hdmiDirty=false, hdmiBaseKey='', hdmiConfigRevision=0, hdmiViewRevision=0, hdmiBlocked=false;
let playbackAnchorTime=0, playbackAnchorWall=0, lastHDMIAck=0, locationGeneration=0;
const displayParams=new URLSearchParams(window.location.search);
const lowPower=document.body.dataset.lowPower==='true'||displayParams.get('pi')==='1';
let realTimeView=false, realtimeRequested=false, autoLocationReady=false;
let followsRemoteDisplay=false, lastDisplayRevision=0, remoteApplying=false, remoteRetryAfter=0, activeDisplaySettings=null;
const $ = id => document.getElementById(id);
let viewAzimuth=270, panDrag=null;
let VIEW_FOV=75;
function setFieldOfView(value){const next=Number(value);if(Number.isFinite(next)&&next>=30&&next<=120&&next!==VIEW_FOV){VIEW_FOV=next;draw();}}
let result=null, currentTime=0, playing=false, lastFrame=0, saved=[], currentName='Choose a location';
let cacheWritesEnabled=true;
function forgetBrowserCache(){cacheWritesEnabled=false;for(const key of Object.keys(localStorage))if(key.startsWith('localsunset.'))localStorage.removeItem(key);}
let resultDirty=true, calculationPending=false, renderedKey='', displayedName='';
function calculationInput(){return {...coordinates(),date:$('date').value,radius:Number($('radius').value),zoom:Number($('zoom').value),source:$('source').value};}
function updateGroundLookup(){
 const output=$('groundLookup');if(!output)return;
 if(!result||!result.terrain||resultDirty){output.textContent='Trace this location to look up ground elevation.';return;}
 const terrain=result.terrain,format=value=>Number(value).toFixed(1)+' m ('+Math.round(Number(value)*3.280839895)+' ft)';
 output.textContent='Looked-up ground: '+format(terrain.dem_ground_m??terrain.ground_m)+'. '+(terrain.ground_override_m!=null?'Your ground: '+format(terrain.ground_m)+'. ':'')+'Observer elevation: '+format(terrain.observer_m)+'.'+(terrain.ground_override_m!=null?' Nearby DEM ignored within '+terrain.near_m+' m.':'');
}
function updatePlaceTitle(){
 updateGroundLookup();
 $('placeTitle').textContent=(result?displayedName:currentName).toUpperCase();
 let notice=$('sceneUpdate');
 if(!notice){notice=document.createElement('div');notice.id='sceneUpdate';notice.setAttribute('role','status');$('view').parentElement.append(notice);}
 notice.hidden=!resultDirty||!result;
 notice.textContent=resultDirty&&result?'Selected: '+currentName+' - '+(calculationPending?'calculating':'awaiting trace')+'. Still showing: '+displayedName+'.':'';
}
function invalidateResult(){locationGeneration++;resultDirty=true;updateGroundLookup();if(controllerPage)$('syncStatus').textContent='Selected location needs a new calculation. Current scene retained.';}
for(const id of ['lat','lon','height','groundOverride','groundClearance','date','radius','zoom','source'])$(id).addEventListener('input',()=>{invalidateResult();if(id==='lat'||id==='lon'){if($('groundOverride'))$('groundOverride').value='';$('saved').value='';$('search').value='';currentName=`${Number($('lat').value).toFixed(4)}°, ${Number($('lon').value).toFixed(4)}°`;updatePlaceTitle();}status('Settings changed. Trace sunrise and sunset to update the view.');});
const initialDate=new Date(); $('date').value=[initialDate.getFullYear(),String(initialDate.getMonth()+1).padStart(2,'0'),String(initialDate.getDate()).padStart(2,'0')].join('-');
async function api(url, options={}) {const r=await fetch(url,options);const data=await r.json();if(!r.ok){const error=Error(data.error||`Request failed (${r.status})`);error.status=r.status;throw error;}return data;}
const jsonOptions = data => ({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
function status(s){$('status').textContent=s;$('projectionStatus').textContent=calculationPending&&result?'Updating terrain in background · current scene retained':s;const progress=$('terrainProgress');if(progress){progress.hidden=!calculationPending;progress.textContent=calculationPending?s:'';}}
function coordinates(){if($('lat').value===''||$('lon').value==='')throw Error('Choose a location or enter latitude and longitude first.');return {lat:Number($('lat').value),lon:Number($('lon').value),height:Number($('height').value),...($('groundOverride')&&$('groundOverride').value!==''?{ground:Number($('groundOverride').value),near:Number($('groundClearance').value)}:{})};}
function formatClock(ms,zone,seconds=true){
 const twelve=document.body.dataset.clock12==='true';
 const options={timeZone:zone,hour:'2-digit',minute:'2-digit',hour12:twelve};
 if(seconds)options.second='2-digit';
 return new Intl.DateTimeFormat(twelve?'en-US':'en-GB',options).format(new Date(ms));
}
function renderClock(id,text){
 const node=$(id),match=text.match(/^(\d{2}:\d{2}:\d{2})(?:\s+(AM|PM))?$/);
 if(!match){node.textContent=text;return;}
 node.classList.add('fixed-clock');
 let digits=node.querySelector('.clock-digits'),period=node.querySelector('.clock-period');
 if(!digits){digits=document.createElement('span');digits.className='clock-digits';period=document.createElement('span');period.className='clock-period';node.replaceChildren(digits,document.createTextNode(' '),period);}
 digits.textContent=match[1];period.textContent=match[2]||'';period.hidden=!match[2];
}
function formatTime(ms){return formatClock(ms,result.timezone);}
function refreshTimeLabels(){
 updateCountdown();if(!result)return;
 $('simTime').textContent=formatTime(currentTime);
 for(const key of ['sunrise','sunset'])$(key).textContent=result[key]?formatTime(Date.parse(result[key].utc)):'No '+key;
 $('rangeStart').textContent=formatClock(result.timeline[0].t,result.timezone,false);
 $('rangeEnd').textContent=formatClock(result.timeline.at(-1).t,result.timezone,false);
 $('events').replaceChildren(...result.events.map(e=>Object.assign(document.createElement('span'),{textContent:`${e.kind==='appearance'?'Visible':'Hidden'} · ${formatTime(Date.parse(e.utc))}`})));
}
function localDate(ms){return new Intl.DateTimeFormat('en-US',{timeZone:result.timezone,dateStyle:'long'}).format(new Date(ms));}
function setTime(t,fromClock=false,fromPlayback=false){if(!result)return;if(!fromClock){realTimeView=false;realtimeRequested=false;}currentTime=Math.max(result.timeline[0].t,Math.min(result.timeline.at(-1).t,t));$('time').value=(currentTime-result.timeline[0].t)/1000;$('simTime').textContent=formatTime(currentTime);draw();if(!fromClock&&!fromPlayback){if(playing){playbackAnchorTime=currentTime;playbackAnchorWall=Date.now();}queueHDMI();}}
function atTime(){const a=result.timeline;let index=Math.min(a.length-2,Math.max(0,Math.floor((currentTime-a[0].t)/30000)));const v=a[index],w=a[index+1],f=(currentTime-v.t)/(w.t-v.t);return {az:(v.az+(((w.az-v.az+540)%360)-180)*f+360)%360,alt:v.alt+(w.alt-v.alt)*f,radius:v.radius+(w.radius-v.radius)*f};}
let zipTimer, zipRequest=0, searchRequest=0, zipFromMatch=false;
function trailingZip(query){const match=query.match(/(?:^|[\s,])(\d{5}(?:-\d{4})?)(?:\s*,?\s*(?:USA|US|United States))?\s*$/i);return match?match[1]:'';}
async function fillZipCity(){
 const zip=$('zip').value.trim(), serial=++zipRequest;
 $('zipCity').value='';
 if(!/^\d{5}(?:-\d{4})?$/.test(zip)){$('zipHint').textContent='Street + ZIP is enough for US addresses; no city required.';return;}
 $('zipHint').textContent='Looking up city and state…';
 try{
  const data=await api('/api/zip/'+encodeURIComponent(zip));
  if(serial!==zipRequest)return;
  $('zipCity').value=data.places.map(p=>p.city+', '+p.state).join(' / ');
  $('zipHint').textContent=data.places.length>1?'This ZIP serves multiple places. The street lookup will resolve the address.':'City/state filled from ZIP. Select a street address result for precise terrain placement.';
 }catch(err){if(serial===zipRequest)$('zipHint').textContent=err.message;}
}
$('search').addEventListener('input',()=>{searchRequest++;$('results').replaceChildren();if(zipFromMatch){zipFromMatch=false;zipRequest++;clearTimeout(zipTimer);$('zip').value='';$('zipCity').value='';$('zipHint').textContent='Street + ZIP is enough for US addresses; no city required.';}});
$('zip').addEventListener('input',()=>{zipFromMatch=false;clearTimeout(zipTimer);zipRequest++;$('zipCity').value='';zipTimer=setTimeout(fillZipCity,500);});
$('searchForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const results=$('results'), query=$('search').value.trim(), serial=++searchRequest;
 results.replaceChildren();
 const zip=$('zip').value.trim();
 status('Looking up this address…');
 try{
  const rows=await api('/api/search?q='+encodeURIComponent(query)+(zip?'&zip='+encodeURIComponent(zip):''));
  if(serial!==searchRequest)return;
  if(!rows.length){status('No matching street address found. Check the street number and ZIP, or enter coordinates.');return;}
  for(const row of rows){
   const b=document.createElement('button');b.className='result';b.type='button';
   b.append(Object.assign(document.createElement('span'),{textContent:row.name}));
   if(row.source)b.append(Object.assign(document.createElement('small'),{textContent:row.source}));
   b.onclick=()=>{
    invalidateResult();$('saved').value='';zipRequest++;clearTimeout(zipTimer);
    $('lat').value=row.lat;$('lon').value=row.lon;if($('groundOverride'))$('groundOverride').value='';
    currentName=row.name;$('search').value=row.name;
    $('zip').value=row.postcode&&/^\d{5}(?:-\d{4})?$/.test(row.postcode)?row.postcode:'';
    zipFromMatch=Boolean($('zip').value);
    $('zipCity').value=[row.city,row.state].filter(Boolean).join(', ');
    $('zipHint').textContent=row.source||'Address selected.';
    updatePlaceTitle();results.replaceChildren();
    status('Location selected. Trace sunrise and sunset to load its terrain.');
   };
   results.append(b);
  }
  status('Select the matching address. City and state are included automatically.');
 }catch(err){if(serial===searchRequest)status(err.message);}
});
async function calculateCurrent(){
 if(calculationPending)return false;
 invalidateResult();calculationPending=true;
 const generation=locationGeneration,input=calculationInput(),key=JSON.stringify(input);
 const preserve=result&&renderedKey===key,keepRealtime=realTimeView||realtimeRequested,previousAzimuth=viewAzimuth;
 for(const el of document.querySelectorAll('aside input,aside select,aside button'))el.disabled=true;
 try{
  if(!$('search').value)currentName=`${input.lat.toFixed(4)}\u00b0, ${input.lon.toFixed(4)}\u00b0`;
  const nextName=currentName;updatePlaceTitle();
  status('Starting terrain analysis…');
  if(controllerPage&&$('syncHDMI').checked&&!remoteApplying)await publishLocationSelection();
  const job=await api('/api/calculate',jsonOptions(input));let state;
  do{await new Promise(r=>setTimeout(r,1400));state=await api('/api/jobs/'+job.id);status(state.message);}while(state.status==='queued'||state.status==='running');
  if(state.status==='error')throw Error(state.error);
  if(generation!==locationGeneration)return false;
  if(remoteApplying){const latest=await api('/api/display-config');if(stableSettings(latest.config)!==stableSettings(activeDisplaySettings))return false;}
  const expected=[input.lat,input.lon,input.height,input.radius,input.zoom,input.source,input.date];if(input.ground!=null)expected.push(input.ground,input.near??100);
  if(!state.signature||JSON.stringify(state.signature)!==JSON.stringify(expected))throw Error('Calculation location does not match the selection; result rejected.');
  cacheWritesEnabled=true;result=state.result;renderedKey=key;displayedName=nextName;resultDirty=false;
  updatePlaceTitle();showResult(preserve);persistScene();
  if(keepRealtime){viewAzimuth=previousAzimuth;enableLiveSky();}
  else if(activeDisplaySettings?activeDisplaySettings.live:displayParams.get('auto')==='1')enableLiveSky();
  calculationPending=false;status('Terrain loaded and cached. Drag the view to look around; scroll to change time.');return true;
 }catch(err){calculationPending=false;status((result?'Update failed; keeping the current scene. ':'')+err.message);return false;}
 finally{calculationPending=false;const progress=$('terrainProgress');if(progress){progress.hidden=true;progress.textContent='';}updatePlaceTitle();for(const el of document.querySelectorAll('aside input,aside select,aside button'))el.disabled=false;queueHDMI();}
}
$('calculateForm').addEventListener('submit',e=>{e.preventDefault();calculateCurrent();});
function showResult(preserveView=false){syncEventControls();updateCountdown();const terrain=result.terrain;$('placeholder').style.display='none';$('time').disabled=false;$('time').max=(result.timeline.at(-1).t-result.timeline[0].t)/1000;$('zone').textContent=result.timezone;$('ground').replaceChildren(document.createTextNode(terrain.ground_m.toFixed(1)+' '),Object.assign(document.createElement('em'),{textContent:'m'}));$('resolution').replaceChildren(document.createTextNode(terrain.pixel_m+' '),Object.assign(document.createElement('em'),{textContent:'m'}));$('sources').textContent=terrain.sources.map(s=>s==='usgs'?'USGS 3DEP':s==='global'?'AWS Terrarium':s).join(' + ')+` · ${terrain.radius_km} km`;$('sunrise').textContent=result.sunrise?formatTime(Date.parse(result.sunrise.utc)):'No sunrise';$('sunriseDate').textContent=result.sunrise?localDate(Date.parse(result.sunrise.utc)):result.status.replaceAll('_',' ');$('sunset').textContent=result.sunset?formatTime(Date.parse(result.sunset.utc)):'No sunset';$('sunsetDate').textContent=result.sunset?localDate(Date.parse(result.sunset.utc)):result.status.replaceAll('_',' ');$('rangeStart').textContent=formatClock(result.timeline[0].t,result.timezone,false);$('rangeEnd').textContent=formatClock(result.timeline.at(-1).t,result.timezone,false);$('assumptions').replaceChildren(...result.assumptions.map(s=>Object.assign(document.createElement('li'),{textContent:s})));$('events').replaceChildren(...result.events.map(e=>Object.assign(document.createElement('span'),{textContent:`${e.kind==='appearance'?'Visible':'Hidden'} · ${formatTime(Date.parse(e.utc))}`})));if(preserveView){setTime(currentTime,true);updatePlay();}else selectEventView();}
$('time').addEventListener('input',()=>{playing=false;updatePlay();setTime(result.timeline[0].t+Number($('time').value)*1000);});
$('back').onclick=()=>setTime(simulationNow()-60000);$('forward').onclick=()=>setTime(simulationNow()+60000);$('jump').onclick=()=>{const event=selectedEvent();if(event)setTime(Date.parse(event.utc));};
function updatePlay(){$('play').textContent=playing?'Ⅱ':'▶';if(playing){playbackAnchorTime=currentTime;playbackAnchorWall=Date.now();}queueHDMI();}
$('play').onclick=()=>{if(result){realTimeView=false;realtimeRequested=false;updateCountdown();if(playing)setTime(simulationNow(),false,true);playing=!playing;updatePlay();}};
$('view').addEventListener('wheel',e=>{if(result){e.preventDefault();setTime(simulationNow()+Math.sign(e.deltaY)*15000);}},{passive:false});
async function loadSaved(){
 try{
  const selected=$('saved').value;
  saved=await api('/api/locations');
  $('saved').replaceChildren(new Option('Select a saved location',''),...saved.map(p=>new Option(p.name,p.name)));
  if(saved.some(p=>p.name===selected))$('saved').value=selected;
  else if(saved.some(p=>p.name===currentName))$('saved').value=currentName;
  if(displayParams.get('auto')==='1')await startAutoLocation();
 }catch(error){status(error.message);}
}
$('save').onclick=async()=>{const name=prompt('Name this location',currentName);if(!name)return;try{await api('/api/locations',jsonOptions({name,...coordinates()}));await loadSaved();status('Location saved on this machine.');}catch(err){status(err.message);}};
$('saved').onchange=event=>{
 const point=saved.find(p=>p.name===$('saved').value);
 if(!point)return;
 invalidateResult();
 zipRequest++;clearTimeout(zipTimer);zipFromMatch=false;$('zip').value='';$('zipCity').value='';
 for(const key of ['lat','lon','height'])$(key).value=point[key];if($('groundOverride'))$('groundOverride').value=point.ground??'';if($('groundClearance'))$('groundClearance').value=point.near??100;
 currentName=point.name;$('search').value=point.name;updatePlaceTitle();
 if(event&&controllerPage&&$('syncHDMI').checked){
  status('Switching the projector to '+point.name+'…');calculateCurrent();
 }else status('Selected '+point.name+'. Use Project selected location to show it on HDMI.');
};
$('projectLocation').onclick=()=>{
 $('syncHDMI').checked=true;$('remoteProjector').checked=true;hdmiBlocked=false;if(controllerPage)calculateCurrent();else publishLocationSelection().then(()=>calculateCurrent()).catch(error=>status(error.message));
};
$('remove').onclick=async()=>{if($('saved').value==='')return;try{await api('/api/locations/'+encodeURIComponent($('saved').value),{method:'DELETE'});await loadSaved();status('Location removed.');}catch(err){status(err.message);}};
const canvas=$('view'),ctx=canvas.getContext('2d');
function setViewAzimuth(azimuth){viewAzimuth=((azimuth%360)+360)%360;draw();queueHDMI();}
function centerSunset(){if(result)setViewAzimuth(selectedEvent()?selectedEvent().azimuth:($('eventMode').value==='sunrise'?90:270));}
$('centerSunset').onclick=centerSunset;
const skyTouches=new Map();let skyPinch=null;
function rebaseSkyGesture(){
 const points=[...skyTouches.values()];skyPinch=null;panDrag=null;
 if(points.length>=2)skyPinch={distance:Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y),fov:VIEW_FOV};
 else if(points.length===1)panDrag={id:points[0].id,x:points[0].x,azimuth:viewAzimuth};
}
canvas.addEventListener('pointerdown',event=>{
 if(event.pointerType==='touch'){
  if(!result)return;event.preventDefault();skyTouches.set(event.pointerId,{id:event.pointerId,x:event.clientX,y:event.clientY});rebaseSkyGesture();
  canvas.setPointerCapture(event.pointerId);canvas.classList.add('panning');return;
 }
 if(!result || !event.isPrimary || event.button!==0)return;
 panDrag={id:event.pointerId,x:event.clientX,azimuth:viewAzimuth};
 canvas.setPointerCapture(event.pointerId);
 canvas.classList.add('panning');
 canvas.focus({preventScroll:true});
});
canvas.addEventListener('pointermove',event=>{
 if(skyTouches.has(event.pointerId)){
  event.preventDefault();skyTouches.set(event.pointerId,{id:event.pointerId,x:event.clientX,y:event.clientY});
  if(skyPinch){const points=[...skyTouches.values()],distance=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y);
   if(distance>0&&skyPinch.distance>0){const slider=$('projectorFov'),fov=Math.round(Math.max(30,Math.min(120,skyPinch.fov*skyPinch.distance/distance)));if(Number(slider.value)!==fov){slider.value=fov;slider.dispatchEvent(new Event('input',{bubbles:true}));}}return;
  }
 }
 if(!panDrag || event.pointerId!==panDrag.id)return;
 const width=canvas.getBoundingClientRect().width;
 if(width>0)setViewAzimuth(panDrag.azimuth-(event.clientX-panDrag.x)*VIEW_FOV/width);
});
function endPan(event){
 if(skyTouches.delete(event.pointerId)){
  const pinching=!!skyPinch;rebaseSkyGesture();if(!skyTouches.size)canvas.classList.remove('panning');
  if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
  if(pinching)$('projectorFov').dispatchEvent(new Event('change',{bubbles:true}));return;
 }
 if(!panDrag || event.pointerId!==panDrag.id)return;
 panDrag=null;
 canvas.classList.remove('panning');
 if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
}
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,endPan);
canvas.addEventListener('keydown',event=>{
 if(!result)return;
 if(event.key==='ArrowLeft' || event.key==='ArrowRight'){
  event.preventDefault();setViewAzimuth(viewAzimuth+(event.key==='ArrowLeft'?-1:1)*(event.shiftKey?15:5));
 }else if(event.key==='Home'){event.preventDefault();centerSunset();}
});

function skyDaylight(altitude){const t=Math.max(0,Math.min(1,(altitude+18)/24));return t*t*(3-2*t);}
function mix(a,b,t){return a.map((v,i)=>Math.round(v+(b[i]-v)*Math.max(0,Math.min(1,t))));}
function rgb(v){return `rgb(${v.join(',')})`;}
function draw(){const box=canvas.getBoundingClientRect(),dpr=lowPower?Math.min(1,1280/Math.max(1,box.width)):Math.min(window.devicePixelRatio||1,2),w=box.width,h=box.height;if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);if(!result){const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#263c49');g.addColorStop(.6,'#ad8975');g.addColorStop(1,'#303e30');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);return;}
 const sun=atTime(),focus=viewAzimuth,fov=VIEW_FOV,scale=w/fov,base=h*.64;
 const xFor=az=>w/2+(((az-focus+540)%360)-180)*scale;
 const yFor=alt=>base-alt*scale;
 const daylight=skyDaylight(sun.alt),warm=Math.max(0,1-Math.abs(sun.alt-1)/10);
 const top=mix([7,12,28],[105,159,207],daylight),horizon=mix([24,30,55],mix([179,198,210],[244,224,180],warm),daylight);
 const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,rgb(top));sky.addColorStop(.65,rgb(horizon));sky.addColorStop(1,rgb(mix(horizon,[81,72,68],.5)));ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 const sx=xFor(sun.az),sy=yFor(sun.alt),sr=sun.radius*scale;
 // Render solar disk on a separate layer and clip it against every terrain column.
 const layers=result.terrain.layers;
 function trace(profile){ctx.beginPath();ctx.moveTo(0,h);for(let x=0;x<=w;x+=1){const az=(focus+(x-w/2)/scale+360)%360,idx=az/360*profile.length,j=Math.floor(idx),v=profile[j]+(profile[(j+1)%profile.length]-profile[j])*(idx-j);ctx.lineTo(x,yFor(v));}ctx.lineTo(w,h);ctx.closePath();}
 // The far-to-near envelopes retain the actual sightline, not invented mountains.
 for(let i=layers.length-1;i>=0;i--){trace(layers[i]);const c=mix([8+i*4,16+i*4,18+i*6],[35+i*12,47+i*12,48+i*15],daylight);const g=ctx.createLinearGradient(0,h*.4,0,h);g.addColorStop(0,rgb(c));g.addColorStop(1,rgb(mix(c,[9,20,15],.65)));ctx.fillStyle=g;ctx.fill();}
 // Clip to sky above the exact horizon used by the numerical solver.
 ctx.save();ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(w,0);for(let x=w;x>=0;x--){const az=(focus+(x-w/2)/scale+360)%360,idx=az/360*result.terrain.horizon.length,j=Math.floor(idx),a=result.terrain.horizon[j],b=result.terrain.horizon[(j+1)%result.terrain.horizon.length];ctx.lineTo(x,yFor(a+(b-a)*(idx-j)));}ctx.closePath();ctx.clip();if(typeof CelestialSky!=='undefined'&&renderedKey){const site=JSON.parse(renderedKey);CelestialSky.draw(ctx,currentTime,site,result.terrain.observer_m,sun.alt,focus,scale,base,w,h,result.terrain.horizon);}if(sun.alt>-20){const disk=ctx.createLinearGradient(0,sy-sr,0,sy+sr);disk.addColorStop(0,'#fffbe2');disk.addColorStop(1,warm>.2?'#ffb951':'#fff2ca');ctx.fillStyle=disk;ctx.shadowColor='#ffd39b';ctx.shadowBlur=8;ctx.beginPath();ctx.arc(sx,sy,sr,0,Math.PI*2);ctx.fill();}ctx.restore();
 if(typeof SceneEffects!=='undefined'){SceneEffects.trees(ctx,result.terrain.horizon,focus,scale,base,w,h,daylight);SceneEffects.glare(ctx,sun,result.terrain.horizon,sx,sy,sr,w,h);}
 // A subtle vignette grounds the atmospheric rendering.
 const vignette=ctx.createRadialGradient(w*.5,h*.45,h*.2,w*.5,h*.5,w*.75);vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,0,0,.24)');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
 $('sunPosition').textContent=`SUN ${sun.az.toFixed(1)}° AZ · ${sun.alt.toFixed(2)}° ALT`;$('compass').textContent=`${focus>=225&&focus<315?'W':focus>=315||focus<45?'N':focus<135?'E':'S'} · ${focus.toFixed(1)}°`;$('viewLabel').textContent=`${localDate(currentTime).toUpperCase()} · ${fov}° FIELD OF VIEW`;
}
function animate(now){if(playing&&result){setTime(playbackAnchorTime+(Date.now()-playbackAnchorWall)*30,false,true);if(currentTime>=result.timeline.at(-1).t){playing=false;updatePlay();}}lastFrame=now;if(lowPower)setTimeout(()=>requestAnimationFrame(animate),66);else requestAnimationFrame(animate);}
new ResizeObserver(draw).observe(canvas);requestAnimationFrame(animate);


function selectedEvent(){return result?result[$('eventMode').value]:null;}
function syncEventControls(){
 const mode=$('eventMode').value;
 $('centerSunset').textContent='Center on '+mode+' â†—';
 $('centerSunset').title='Center the view on the predicted '+mode+' direction';
 $('jump').textContent=mode==='sunrise'?'Jump to first light â†—':'Jump to last light â†—';
 $('jump').disabled=!selectedEvent();
 $('countdownLabel').textContent='COUNTDOWN TO LOCAL '+mode.toUpperCase();
 $('countdownPanel').setAttribute('aria-label','Live '+mode+' countdown');
}
function selectEventView(){
 syncEventControls();updateCountdown();
 if(!result)return;
 const event=selectedEvent();
 viewAzimuth=event?event.azimuth:($('eventMode').value==='sunrise'?90:270);
 setTime(event?Date.parse(event.utc)-180000:result.timeline[0].t+12*3600000);
}
$('eventMode').addEventListener('change',selectEventView);

function updateCountdown(){
 if(!controllerPage&&document.body.classList.contains('sky-only')&&result){realTimeView=true;playing=false;}
 const now=Date.now(),state=sunsetCountdown(result,now,$('eventMode').value);
 const zone=result?result.timezone:Intl.DateTimeFormat().resolvedOptions().timeZone;
 const clock=formatClock(now,zone);
 for(const id of ['currentLocalTime','projectionCurrentTime'])renderClock(id,clock);
 for(const id of ['currentLocalZone','projectionCurrentZone'])$(id).textContent=zone+(result?'':' (device time)');
 $('countdownLabel').textContent=(state.past?'TIME SINCE ':'TIME UNTIL ')+$('eventMode').value.toUpperCase();
 $('countdown').textContent=state.value;
 $('countdownNote').textContent=state.note;
 const lastRay=result&&result.sunset;
 $('lastRayTime').textContent=lastRay?formatTime(Date.parse(lastRay.utc)):(result?'No sunset':'—:—:—');
 $('lastRayZone').textContent=result?result.timezone:'Location time zone';
 $('lastRayDate').textContent=lastRay?localDate(Date.parse(lastRay.utc)):(result?'No last-ray event on the selected date.':'Select a location and calculate.');
 if(realTimeView&&result){
  if(Date.now()>=result.timeline[0].t&&Date.now()<=result.timeline.at(-1).t)setTime(Date.now(),true);
  // Keep the last valid scene at midnight while the next local day loads.
 }
 $('projectionCountdownLabel').textContent=(state.past?'SINCE ':'UNTIL ')+$('eventMode').value.toUpperCase();
 $('projectionCountdown').textContent=state.value;
 $('projectionNote').textContent=state.note;
 $('projectionSunrise').textContent=result?(result.sunrise?formatTime(Date.parse(result.sunrise.utc)):'No sunrise'):'—:—:—';
 $('projectionSunset').textContent=result?(result.sunset?formatTime(Date.parse(result.sunset.utc)):'No sunset'):'—:—:—';
 $('projectionDateZone').textContent=result?localDate(result.timeline[0].t)+' · '+result.timezone:'Choose a location and date';
 $('projectionClock').textContent=result?(realTimeView?'REALTIME \u00b7 ':'SIMULATION · ')+formatTime(currentTime):'SIMULATED SKY';
 $('projectorLive').textContent=realTimeView?'Realtime \u2713':'Realtime';
 $('realtime').textContent=realTimeView?'Realtime \u2713':'Realtime';
 for(const id of ['realtime','projectorLive'])$(id).setAttribute('aria-pressed',String(realTimeView));
 $('simulationModeLabel').textContent=realTimeView?'REALTIME \u00b7 LOCAL CLOCK':'SIMULATION TIME';
}
updateCountdown();
setInterval(updateCountdown,1000);
document.addEventListener('visibilitychange',updateCountdown);

function setProjector(enabled,remote=false){
 if(!remote)followsRemoteDisplay=!controllerPage;
 document.body.classList.toggle('projector',enabled);
 const url=new URL(window.location.href);
 if(enabled)url.searchParams.set('projector','1');else url.searchParams.delete('projector');
 history.replaceState(null,'',url);
 if(!enabled&&document.fullscreenElement)document.exitFullscreen().catch(()=>{});
 draw();
}
async function projectorFullscreen(){
 try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();}
 catch(error){status('Projector layout is active. Use the browser fullscreen command if fullscreen is unavailable.');}
}
$('projectorToggle').onclick=()=>{setProjector(true);projectorFullscreen();};
$('projectorExit').onclick=()=>setProjector(false);
$('projectorFullscreen').onclick=projectorFullscreen;
function enableLiveSky(){
 if(!result)return;
 if(Date.now()<result.timeline[0].t||Date.now()>result.timeline.at(-1).t){status('Live sky needs a calculation for today at this location.');return;}
 playing=false;realTimeView=true;realtimeRequested=false;updatePlay();updateCountdown();persistView();queueHDMI();
}
async function chooseRealtime(){
 if(realTimeView){
  realTimeView=false;realtimeRequested=false;updateCountdown();
  if(renderedKey===JSON.stringify(calculationInput())){resultDirty=false;updatePlaceTitle();}
  try{if(controllerPage&&$('syncHDMI').checked&&!resultDirty&&!remoteApplying)await publishLocationSelection();persistView();queueHDMI();status('Simulation paused at the displayed time.');}
  catch(error){status(error.message);}return;
 }
 realtimeRequested=true;
 $('remoteToday').checked=true;$('remoteLive').checked=true;
 if(calculationPending){status('Realtime will start when the current terrain calculation finishes.');return;}
 try{
  const position=coordinates(),today=await api('/api/today?lat='+position.lat+'&lon='+position.lon);
  const key=JSON.stringify({...calculationInput(),date:today.date});
  if(!result||renderedKey!==key){$('date').value=today.date;if(!await calculateCurrent())return;}
  else {resultDirty=false;updatePlaceTitle();if(controllerPage&&$('syncHDMI').checked&&!remoteApplying)await publishLocationSelection();}
  enableLiveSky();status('Realtime: sky brightness follows the current solar altitude. Clear-sky estimate; clouds are not included.');
 }catch(error){realtimeRequested=false;status(error.message);}
}
$('projectorLive').onclick=chooseRealtime;
$('realtime').onclick=chooseRealtime;
document.addEventListener('keydown',event=>{
 if(event.target.matches('input,select,textarea')||event.ctrlKey||event.metaKey||event.altKey)return;
 if(event.key==='Escape'&&document.body.classList.contains('projector'))setProjector(false);
 if(event.key.toLowerCase()==='p'){setProjector(!document.body.classList.contains('projector'));}
 if(event.key.toLowerCase()==='f'&&document.body.classList.contains('projector'))projectorFullscreen();
});
if(displayParams.get('event')==='sunrise')$('eventMode').value='sunrise';
if(displayParams.get('projector')==='1')setProjector(true);
syncEventControls();
async function startAutoLocation(){
 followsRemoteDisplay=true;
 const state=await api('/api/display-config');
 if(state.config){await applyRemoteDisplay(state);return;}
 if(!saved.length){status('Exit projector and save a location first. Kiosk startup uses the last saved place.');return;}
 $('saved').value=saved[saved.length-1].name;$('saved').onchange();autoLocationReady=true;
 await calculateToday();
}
async function calculateToday(){
 if(calculationPending||$('calculate').disabled)return;
 const position=coordinates();
 const today=await api('/api/today?lat='+encodeURIComponent(position.lat)+'&lon='+encodeURIComponent(position.lon));
 if($('date').value!==today.date||!result||renderedKey!==JSON.stringify({...calculationInput(),date:today.date})){$('date').value=today.date;$('calculateForm').requestSubmit();}
}
setInterval(()=>{if(!remoteApplying&&(realTimeView||(autoLocationReady&&(followsRemoteDisplay||displayParams.get('auto')==='1'))))calculateToday().catch(err=>status(err.message));},60000);

document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&document.body.classList.contains('projector'))setProjector(false);});

$('applyDisplay').onclick=async()=>{
 const button=$('applyDisplay');button.disabled=true;
 try{
  const settings={...coordinates(),name:currentName,date:$('date').value,
   radius:Number($('radius').value),zoom:Number($('zoom').value),source:$('source').value,
   event:$('remoteEvent').value,today:$('remoteToday').checked,live:$('remoteLive').checked,projector:$('remoteProjector').checked};
  const state=await api('/api/display-config',{...jsonOptions(settings),method:'PUT',headers:{'Content-Type':'application/json','X-Display-Intent':'select'}});
  hdmiConfigRevision=state.revision;hdmiBaseKey='';hdmiBlocked=false;
  $('remoteStatus').textContent='Saved configuration '+state.revision+'. Connected displays update automatically.';
 }catch(error){$('remoteStatus').textContent=error.message;}finally{button.disabled=false;}
};
async function applyRemoteDisplay(state){
 if(!state.config||state.revision===lastDisplayRevision||remoteApplying||$('calculate').disabled)return;
 remoteApplying=true;
 try{
  const settings=state.config;activeDisplaySettings=settings;
  for(const key of ['lat','lon','height','radius','zoom','source'])$(key).value=settings[key];if($('groundOverride'))$('groundOverride').value=settings.ground??'';if($('groundClearance'))$('groundClearance').value=settings.near??100;
  currentName=settings.name;updatePlaceTitle();$('search').value=settings.name;$('saved').value=saved.some(point=>point.name===settings.name)?settings.name:'';
  const eventChanged=$('eventMode').value!==settings.event;
  $('eventMode').value=settings.event;
  if(settings.today){
   const day=await api('/api/today?lat='+encodeURIComponent(settings.lat)+'&lon='+encodeURIComponent(settings.lon));
   $('date').value=day.date;
  }else $('date').value=settings.date;
  const after=JSON.stringify(calculationInput());
  if(result&&settings.live){const old=JSON.parse(renderedKey);if(old.lat===Number(settings.lat)&&old.lon===Number(settings.lon)&&old.date===$('date').value)enableLiveSky();}
  if(!result||renderedKey!==after){if(!await calculateCurrent()){remoteRetryAfter=Date.now()+1500;return;}}
  else {resultDirty=false;displayedName=settings.name;updatePlaceTitle();if(eventChanged)selectEventView();}
  realTimeView=false;
  if(settings.live)enableLiveSky();
  setProjector(settings.projector,true);
  lastDisplayRevision=state.revision;
  autoLocationReady=settings.today;
  status('Remote display configuration applied.');
 }catch(error){status(error.message);remoteRetryAfter=Date.now()+30000;}finally{remoteApplying=false;}
}
async function pollRemoteDisplay(){
 if(controllerPage||!(followsRemoteDisplay||displayParams.get('auto')==='1')||remoteApplying||Date.now()<remoteRetryAfter)return;
 try{const state=await api('/api/display-config');await applyRemoteDisplay(state);}
 catch(error){remoteRetryAfter=Date.now()+30000;status('Remote display connection interrupted; retrying.');}
}
setInterval(pollRemoteDisplay,1000);

$('loadDisplayConfig').onclick=async()=>{
 try{
  const state=await api('/api/display-config');
  if(!state.config){$('remoteStatus').textContent='No shared display configuration has been saved yet.';return;}
  const settings=state.config;
  invalidateResult();
  for(const key of ['lat','lon','height','radius','zoom','source'])$(key).value=settings[key];if($('groundOverride'))$('groundOverride').value=settings.ground??'';if($('groundClearance'))$('groundClearance').value=settings.near??100;
  currentName=settings.name;updatePlaceTitle();$('search').value=settings.name;$('saved').value=saved.some(point=>point.name===settings.name)?settings.name:'';
  zipRequest++;clearTimeout(zipTimer);zipFromMatch=false;$('zip').value='';$('zipCity').value='';
  $('remoteEvent').value=settings.event;$('eventMode').value=settings.event;
  $('remoteToday').checked=settings.today;$('remoteLive').checked=settings.live;$('remoteProjector').checked=settings.projector;
  $('date').value=settings.today?(await api('/api/today?lat='+encodeURIComponent(settings.lat)+'&lon='+encodeURIComponent(settings.lon))).date:settings.date;
  syncEventControls();updateCountdown();
  $('remoteStatus').textContent='Loaded configuration '+state.revision+'. Edit settings, then Apply to display.';
 }catch(error){$('remoteStatus').textContent=error.message;}
};

function controlSettings(){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:result.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const field=kind=>parts.find(p=>p.type===kind).value;
 const today=field('year')+'-'+field('month')+'-'+field('day');
 return {...coordinates(),name:currentName,date:$('date').value,radius:Number($('radius').value),zoom:Number($('zoom').value),source:$('source').value,
  event:$('eventMode').value,today:$('remoteToday').checked&&$('date').value===today,live:realTimeView,projector:$('remoteProjector').checked};
}
function queueHDMI(){
 if(!controllerPage||!$('syncHDMI').checked||remoteApplying||hdmiBlocked||resultDirty||calculationPending||!result)return;
 hdmiDirty=true;
 if(!hdmiTimer&&!hdmiSending)hdmiTimer=setTimeout(()=>{hdmiTimer=null;sendHDMI();},120);
}
async function sendHDMI(){
 if(hdmiSending||hdmiBlocked||resultDirty||calculationPending||!result||!$('syncHDMI').checked||$('calculate').disabled)return;
 hdmiSending=true;hdmiDirty=false;
 const generation=locationGeneration, expectedRevision=hdmiConfigRevision;
 try{
  const settings=controlSettings();
  const key=stableSettings(settings);
  if(key!==hdmiBaseKey){
   const existing=await api('/api/display-config');
   if(generation!==locationGeneration)return;
   if(existing.revision!==expectedRevision){const conflict=Error('Another location controls the projector. Click Project selected location to switch it.');conflict.status=409;throw conflict;}
   const saved=stableSettings(existing.config||{})===key?existing:await api('/api/display-config',{...jsonOptions(settings),method:'PUT',headers:{'Content-Type':'application/json','If-Match':String(expectedRevision)}});
   if(generation!==locationGeneration)return;
   hdmiConfigRevision=saved.revision;lastDisplayRevision=saved.revision;hdmiBaseKey=key;
  }
  if(generation!==locationGeneration)return;
  const state=await api('/api/display-view',{...jsonOptions({config_revision:hdmiConfigRevision,time_ms:simulationNow(),azimuth:viewAzimuth,event:$('eventMode').value,playing,live:realTimeView}),method:'PUT'});
  hdmiViewRevision=state.revision;
  $('syncStatus').textContent='Controls sent · awaiting HDMI confirmation';
 }catch(error){hdmiBaseKey='';$('syncStatus').textContent=error.message;if(error.status===409){hdmiBlocked=true;hdmiDirty=false;clearTimeout(hdmiTimer);hdmiTimer=null;}else{hdmiDirty=true;if(!hdmiTimer)hdmiTimer=setTimeout(()=>{hdmiTimer=null;sendHDMI();},1500);}}
 finally{hdmiSending=false;if(hdmiDirty)queueHDMI();}
}
async function followHDMIView(){
 if(!result||remoteApplying)return;
 const state=await api('/api/display-view');
 const view=state.view;
 if(!view||view.config_revision!==lastDisplayRevision)return;
 if(state.revision===hdmiViewRevision){if(Date.now()-lastHDMIAck>4000){await api('/api/display-ack',jsonOptions({revision:state.revision}));lastHDMIAck=Date.now();}return;}
 hdmiViewRevision=state.revision;
 $('eventMode').value=view.event;syncEventControls();
 const skyOnly=document.body.classList.contains('sky-only');
 const target=(skyOnly||view.live)?Date.now():view.time_ms+(view.playing?Math.max(0,Date.now()-view.updated_ms)*30:0);
 setTime(target,true,true);
 viewAzimuth=view.azimuth;playing=!skyOnly&&view.playing;realTimeView=skyOnly||view.live;updatePlay();draw();updateCountdown();
 await api('/api/display-ack',jsonOptions({revision:state.revision}));lastHDMIAck=Date.now();
}
$('syncHDMI').checked=controllerPage;
if(!controllerPage)$('syncHDMI').closest('.hdmi-sync').style.display='none';
$('syncHDMI').addEventListener('change',()=>{if($('syncHDMI').checked){hdmiBaseKey='';queueHDMI();}else $('syncStatus').textContent='HDMI mirroring paused';});
api('/api/display-target').then(target=>{$('syncStatus').textContent='HDMI control server: '+target.url;}).catch(()=>{});

let viewPollPending=false;
setInterval(async()=>{
 if(controllerPage||viewPollPending||remoteApplying||!result||!(followsRemoteDisplay||displayParams.get('auto')==='1'))return;
 viewPollPending=true;
 try{await followHDMIView();}catch(error){}finally{viewPollPending=false;}
},160);

setInterval(async()=>{
 if(!controllerPage||!result||!$('syncHDMI').checked||!hdmiViewRevision)return;
 try{
  const ack=await api('/api/display-ack');
  $('syncStatus').textContent=ack.revision>=hdmiViewRevision&&Date.now()-ack.updated_ms<10000?'HDMI confirmed · time and direction mirrored':'Controls sent · waiting for HDMI confirmation';
 }catch(error){}
},1000);

function simulationNow(){
 if(realTimeView&&result)return Math.max(result.timeline[0].t,Math.min(result.timeline.at(-1).t,Date.now()));
 if(!playing||!result)return currentTime;
 return Math.max(result.timeline[0].t,Math.min(result.timeline.at(-1).t,playbackAnchorTime+(Date.now()-playbackAnchorWall)*30));
}

function stableSettings(value){return JSON.stringify(Object.keys(value).sort().reduce((out,key)=>{out[key]=value[key];return out;},{}));}
async function publishLocationSelection(){
 const settings={...coordinates(),name:currentName,date:$('date').value,radius:Number($('radius').value),zoom:Number($('zoom').value),source:$('source').value,event:$('eventMode').value,today:false,live:realTimeView||realtimeRequested,projector:$('remoteProjector').checked};
 const today=await api('/api/today?lat='+encodeURIComponent(settings.lat)+'&lon='+encodeURIComponent(settings.lon));
 settings.today=$('remoteToday').checked&&settings.date===today.date;
 const state=await api('/api/display-config',{...jsonOptions(settings),method:'PUT',headers:{'Content-Type':'application/json','X-Display-Intent':'select'}});
 hdmiConfigRevision=state.revision;lastDisplayRevision=state.revision;hdmiBaseKey=stableSettings(settings);hdmiViewRevision=0;hdmiBlocked=false;
 $('projectionLocation').textContent='Projector target: '+settings.name+' · calculating';
 $('syncStatus').textContent='Switching HDMI to '+settings.name+'…';
}
async function showProjectorTarget(){
 if(!controllerPage)return;
 try{
  const state=await api('/api/display-config');
  $('projectionLocation').textContent=state.config?'Projector target: '+state.config.name:'No location selected for the projector yet.';
 }catch(error){$('projectionLocation').textContent='Projector connection unavailable.';}
}
showProjectorTarget();setInterval(showProjectorTarget,3000);

// Keep a complete last-good scene across kiosk/browser reloads, not just jobs in RAM.
function persistScene(){
 if(!cacheWritesEnabled||!result||resultDirty)return;
 try{localStorage.setItem('localsunset.lastScene.v1',JSON.stringify({version:1,result,key:renderedKey,name:displayedName,event:$('eventMode').value,time:currentTime,azimuth:viewAzimuth,live:realTimeView}));}catch(error){}
}
function persistView(){
 if(!cacheWritesEnabled||!result||resultDirty)return;
 try{localStorage.setItem('localsunset.lastView.v1',JSON.stringify({key:renderedKey,time:simulationNow(),azimuth:viewAzimuth,event:$('eventMode').value,live:realTimeView}));}catch(error){}
}
function restoreScene(){
 try{
  const cached=JSON.parse(localStorage.getItem('localsunset.lastScene.v1')||'null');
  if(!cached||cached.version!==1||!cached.result||!cached.result.terrain||!Array.isArray(cached.result.timeline)||cached.result.timeline.length<2)return false;
  const input=JSON.parse(cached.key);
  if(!input||!Number.isFinite(input.lat)||!Number.isFinite(input.lon))return false;
  const view=JSON.parse(localStorage.getItem('localsunset.lastView.v1')||'null');
  const previous=view&&view.key===cached.key?view:cached;
  for(const key of ['lat','lon','height','date','radius','zoom','source'])$(key).value=input[key];if($('groundOverride'))$('groundOverride').value=input.ground??'';if($('groundClearance'))$('groundClearance').value=input.near??100;
  result=cached.result;renderedKey=cached.key;currentName=displayedName=cached.name;
  resultDirty=true;currentTime=previous.time;viewAzimuth=previous.azimuth;
  $('eventMode').value=previous.event==='sunrise'?'sunrise':'sunset';$('search').value=currentName;
  showResult(true);realTimeView=previous.live===true;updateCountdown();updatePlaceTitle();
  status('Last working scene restored. Checking for updated terrain and controls.');return true;
 }catch(error){return false;}
}
restoreScene();loadSaved();
if(realTimeView)calculateToday().catch(error=>status(error.message));
setInterval(persistView,5000);
window.addEventListener('pagehide',persistView);
