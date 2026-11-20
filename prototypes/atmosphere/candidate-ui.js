/* Additive local candidate: production controls and rendering remain the base. */
function syncTerrainVisibility(){
 const available=TerrainOption.enabled&&result&&!result.terrain.disabled;
 document.body.classList.toggle('terrain-off',!available);
 document.body.classList.toggle('terrain-downloads-off',!TerrainOption.enabled);
 $('contactTime').parentElement.hidden=!available;
 $('terrainOptionNote').hidden=TerrainOption.enabled;
 const check=$('candidateTerrainEnabled');check.checked=TerrainOption.enabled;check.disabled=calculationPending;
 const fit=document.querySelector('.sky-resize-bar button');if(fit)fit.disabled=!available;
 const calculate=$('calculate');if(calculate.firstChild&&calculate.firstChild.nodeType===3)calculate.firstChild.textContent=TerrainOption.enabled?'Trace sunrise & sunset ':'Calculate sky ';
}
const CandidateAtmosphere=(()=>{
 let analysis=null,analysisKey='',skyKey='',skyImage=null,weatherData=null,weatherSite='',gesture=null,scheduled=false;
 const compassStrip=document.createElement('div');compassStrip.className='sky-bearing-strip';compassStrip.setAttribute('aria-label','Compass bearings across the scenery; true north');document.querySelector('.scene').append(compassStrip);
 const centerBearing=document.createElement('span');centerBearing.className='sky-center-bearing';compassStrip.append(centerBearing);
 const compassMarks=Array.from({length:16},(_,i)=>{const mark=document.createElement('span');mark.className=i%2?'bearing-minor':'bearing-major';mark.textContent=i%2?'':['N','NE','E','SE','S','SW','W','NW'][i/2];compassStrip.append(mark);return mark;});
 function drawCompass(focus,fov){
  const projector=document.body.classList.contains('projector'),status=document.querySelector(projector?'.projector-hud':'.sky-status-strip');
  compassStrip.style.bottom=(status&&getComputedStyle(status).display!=='none'?status.offsetHeight:0)+'px';
  const controls=document.querySelector('.sky-gesture-buttons'),parent=document.body.classList.contains('projector')?document.querySelector('.scene'):document.querySelector('.sky-status-geometry');if(controls.parentNode!==parent)parent.append(controls);controls.style.bottom=(parseFloat(compassStrip.style.bottom)+32)+'px';
  centerBearing.textContent=((focus%360+360)%360).toFixed(1)+'°';
  compassMarks.forEach((mark,i)=>{const delta=((i*22.5-focus+540)%360)-180,x=50+delta/fov*100;mark.hidden=x<1||x>99;mark.style.left=x+'%';});
 }
 const aod=()=>Math.max(0,Math.min(3,Number($('candidateAod').value)||0));
 const padding=()=>Math.max(1,Math.min(45,Math.round(Number($('peakPadding').value)||10)));
 const site=()=>renderedKey?JSON.parse(renderedKey):null;
 function geometry(t){const p=site(),o=new Astronomy.Observer(p.lat,p.lon,result.terrain.observer_m),e=Astronomy.Equator('Sun',new Date(t),o,true,true),h=Astronomy.Horizon(new Date(t),o,e.ra,e.dec);return {alt:h.altitude,az:h.azimuth};}
 function weather(t){const p=site();return $('candidateUseWeather').checked&&weatherSite===p.lat+','+p.lon?GlowModel.weatherAt(weatherData,t):null;}
 function clouds(rgb,alt,az,t,sunAlt){
  const w=weather(t);if(!w)return rgb;
  let out=rgb.slice();
  for(const [amount,height,opacity] of [[w.high,10,.4],[w.mid,5,.6],[w.low,2,.85]]){
   if(amount===null)continue;
   const pattern=(Math.sin(az*.12+height)+Math.sin(alt*.32+az*.05+height*3)+Math.sin(az*.29-alt*.16))/3;
   const mask=Math.max(0,Math.min(1,(amount/100-(pattern*.45+.5))*8+.5))*opacity;
   const dip=Math.acos(6371/(6371+height))*180/Math.PI,lit=Math.max(0,Math.min(1,(sunAlt+dip+1)/3)),warm=Math.exp(-Math.pow((sunAlt+1)/5,2));
   out=out.map((v,i)=>v*(1-mask)+mask*(.004+lit*[.2,.15,.1][i]*(1+warm*[.8,-.1,-.6][i])));
  }return out;
 }
 function horizon(az){const p=((az%360+360)%360)/360*result.terrain.horizon.length,i=Math.floor(p);return result.terrain.horizon[i]*(1-(p-i))+result.terrain.horizon[(i+1)%result.terrain.horizon.length]*(p-i);}
 function buildAnalysis(){
  if(!result||!renderedKey)return null;
  const key=[TerrainOption.enabled,renderedKey,$('eventMode').value,aod(),$('candidateUseWeather').checked,weatherSite,weatherData&&weatherData.hourly.time[0]].join('|');
  if(key===analysisKey)return analysis;
  analysisKey=key;skyKey='';
  const p=site(),mode=$('eventMode').value,o=new Astronomy.Observer(p.lat,p.lon,result.terrain.observer_m),start=result.timeline[0].t,end=result.timeline.at(-1).t;
  const event=Astronomy.SearchRiseSet('Sun',o,mode==='sunrise'?1:-1,new Date(start),(end-start)/86400000);
  const astro=event&&event.date.getTime()<end?event.date.getTime():null;
  const contact=!result.terrain.disabled&&TerrainOption.enabled&&result[mode]?Date.parse(result[mode].utc):null,center=astro??contact;
  if(center===null){analysis={samples:[],astro,contact,peak:null};return analysis;}
  const samples=[];
  for(let t=Math.max(start,center-3600000);t<=Math.min(end,center+3600000);t+=60000){
   const s=geometry(t),rgb=[0,0,0];
   // Average three visible sky directions; avoid selecting a mountain as sky.
   for(const offset of [-20,0,20]){const az=s.az+offset,alt=Math.min(80,Math.max(6,horizon(az)+2)),r=clouds(GlowModel.radiance(alt,offset,s.alt,aod(),result.terrain.observer_m),alt,az,t,s.alt);for(let i=0;i<3;i++)rgb[i]+=r[i]/3;}
   samples.push({t,rgb,...GlowModel.metrics(rgb)});
  }
  const peak=PeakAnalysis.peak(samples);
  analysis={samples,astro,contact,peak};return analysis;
 }
 function jumpMilestone(direction){const a=buildAnalysis();if(!a)return;const event=SkyCountdown.adjacent(a,PeakAnalysis.windowAround(a.samples,a.peak,padding()),$('eventMode').value,realTimeView?Date.now():currentTime,direction);if(!event)return;playing=false;updatePlay();setTime(event.t);updateCountdown();persistView();refresh();}
 let countdownSelection=null,eventRowsKey='';
 function tableEvents(a,window,mode){return [{key:'contact',t:a.contact,label:'Local terrain '+mode},{key:'start',t:window?.[0],label:'Viewing window start'},{key:'peak',t:a.peak?.t,label:mode[0].toUpperCase()+mode.slice(1)+' peak'},{key:'end',t:window?.[1],label:'Viewing window end'},{key:'astro',t:a.astro,label:'Astronomical '+mode}].filter(e=>e.key!=='contact'||TerrainOption.enabled);}
 function liveTiming(a,window,mode){const chosen=tableEvents(a,window,mode).find(e=>e.key===countdownSelection&&Number.isFinite(e.t));return chosen?SkyCountdown.countdownTo(chosen,Date.now()):SkyCountdown.next(a,window,mode,Date.now());}
 function refreshEventTable(a,window,mode){
  const events=tableEvents(a,window,mode),now=realTimeView?Date.now():currentTime,chosen=events.find(e=>e.key===countdownSelection&&Number.isFinite(e.t)),timing=chosen?SkyCountdown.countdownTo(chosen,now):SkyCountdown.next(a,window,mode,now),selected=chosen||events.find(e=>e.t===timing.event?.t);
  $('selectedEventCountdown').textContent=(realTimeView?'Realtime countdown: ':'From simulated time: ')+timing.label;
  $('skyEventZone').textContent=result.timezone;
  const key=JSON.stringify([events,countdownSelection,selected?.key,result.timezone]);if(key===eventRowsKey)return;eventRowsKey=key;
  $('skyEventHead').replaceChildren(...events.map(event=>{const head=document.createElement('th');head.scope='col';head.textContent=event.label.replace('Local terrain','Terrain').replace('Viewing window','Window');return head;}));
  const row=document.createElement('tr');row.append(...events.map(event=>{const cell=document.createElement('td');cell.textContent=Number.isFinite(event.t)?stamp(event.t):'—';return cell;}));$('skyEventRows').replaceChildren(row);
 }
 function stamp(t){return t===null?'No event':formatClock(t,result.timezone,false);}
 function syncSkyMode(){
  const button=$('skyRealtime');if(!button)return;const a=buildAnalysis();for(const [id,direction] of [['skyPrevEvent',-1],['skyNextMilestone',1]])if($(id))$(id).disabled=!a||!SkyCountdown.adjacent(a,PeakAnalysis.windowAround(a.samples,a.peak,padding()),$('eventMode').value,realTimeView?Date.now():currentTime,direction);
  button.textContent=realTimeView?'Realtime':realtimeRequested?'Starting…':'Go Realtime';
  button.setAttribute('aria-pressed',String(realTimeView));button.classList.toggle('is-live',realTimeView);
  button.title=realTimeView?'Sky follows the real clock. Click to pause.':'Sky shows a selected preview time. Click to follow the real clock.';
 }
 function refreshCloudEstimate(){
  const enabled=$('candidateUseWeather').checked,w=enabled&&result?weather(realTimeView?Date.now():currentTime):null,pct=v=>Number.isFinite(v)?Math.round(Math.max(0,Math.min(100,v)))+'%':'unavailable';
  const temperature=w&&Number.isFinite(w.temperature)?'Forecast temperature: '+Math.round(w.temperature*9/5+32)+'°F ('+Math.round(w.temperature)+'°C) · ': 'Forecast temperature unavailable · ';
  const direction=w&&Number.isFinite(w.windDirection)?['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(w.windDirection/22.5)%16]+' ('+Math.round(w.windDirection)%360+'°)':'direction unavailable';
  const wind=w&&Number.isFinite(w.windSpeed)?'Wind: '+(w.windSpeed<.5?'calm':Math.round(w.windSpeed)+' mph ('+Math.round(w.windSpeed*1.609344)+' km/h) from '+direction)+' · ':'Wind unavailable · ';
  const text=temperature+wind+(w?'Forecast cloud cover: '+pct(w.total)+' total · low '+pct(w.low)+' · middle '+pct(w.mid)+' · high '+pct(w.high):'Forecast cloud cover unavailable for this location/time.');
  for(const id of ['skyCloudEstimate','dockCloudEstimate','projectorCloudEstimate']){$(id).hidden=!enabled;$(id).textContent=enabled?text:'';}
  $('forecastCloudDetail').textContent=enabled?text+' Layer percentages overlap and should not be added. Temperature is forecast air temperature at 2 m; wind is at 10 m above ground, with direction indicating where it comes from. Hourly forecast values are interpolated to the selected time.':'Enable the local cloud estimate to download and show forecast percentages.';
 }
 function refreshProjector(){refreshCloudEstimate();
  if(!result||!document.body.classList.contains('projector'))return;
  const a=buildAnalysis();if(!a)return;const mode=$('eventMode').value,window=PeakAnalysis.windowAround(a.samples,a.peak,padding()),timing=realTimeView?liveTiming(a,window,mode):SkyCountdown.relative(a,window,mode,currentTime);
  const clock=realTimeView?Date.now():currentTime;
  document.querySelector('.projection-countdown > span').textContent=SkyCountdown.displayStatus(a,window,mode,clock,realTimeView,playing);
  renderClock('projectionCurrentTime',formatClock(clock,result.timezone));
  $('projectionCountdownLabel').textContent=realTimeView?(countdownSelection?'SELECTED EVENT · LIVE CLOCK':'NEXT EVENT · LIVE CLOCK'):'From current simulated time:';
  $('projectionCountdown').textContent=timing.label;
  $('projectionClock').textContent=(realTimeView?'REALTIME · ':'SIMULATION · ')+formatClock(clock,result.timezone);
  if(!calculationPending&&!/failed|error/i.test($('status').textContent))$('projectionStatus').textContent=realTimeView?'Live sky follows the current clock.':'Preview · Swipe through time or select Realtime.';
  $('projectionNote').textContent=timing.event?stamp(timing.event.t)+' · '+result.timezone:'No remaining milestones on the selected date.';
  $('projectorBestWindow').textContent='Recommended '+mode+' viewing window: '+(window?stamp(window[0])+' – '+stamp(window[1]):'Unavailable');
 }
 function refresh(){ensureWeather();syncSkyMode();refreshCloudEstimate();
  const a=buildAnalysis();if(!a)return;
  const mode=$('eventMode').value;$('astroLabel').textContent='Astronomical '+mode;$('contactLabel').textContent='Terrain '+mode;
  $('astroTime').textContent=stamp(a.astro);$('contactTime').textContent=stamp(a.contact);
  $('colorPeakTime').textContent=a.peak?stamp(a.peak.t):'No qualifying color peak';
  $('jumpColorPeak').disabled=!a.peak;
  const window=PeakAnalysis.windowAround(a.samples,a.peak,padding());refreshEventTable(a,window,mode);
  const timing=realTimeView?liveTiming(a,window,mode):SkyCountdown.relative(a,window,mode,currentTime);
  $('skyNextEvent').querySelector('small').textContent=realTimeView?(countdownSelection?'SELECTED EVENT · LIVE CLOCK':'NEXT MILESTONE · LIVE CLOCK'):'From current simulated time:';
  $('skyNextEventText').textContent=timing.label;
  $('skyNextEventTime').textContent=timing.event?stamp(timing.event.t)+' · '+result.timezone+' · '+timing.event.label:(a.samples.length?localDate(a.samples[0].t):'Choose another date or event');
  const bestWindowText='Recommended '+mode+' viewing window: '+(window?stamp(window[0])+' – '+stamp(window[1]):'Unavailable');$('skyBestWindow').textContent=bestWindowText;$('dockBestWindow').textContent=bestWindowText;
  $('colorWindow').textContent=a.peak?stamp(window[0])+' – '+stamp(window[1]):'No recommended window';
  const s=a.samples;$('colorTime').disabled=!s.length;$('colorTime').max=Math.max(0,s.length-1);
  if(s.length){$('colorTime').value=Math.max(0,Math.min(s.length-1,Math.round((currentTime-s[0].t)/60000)));$('colorTimeLabel').textContent=stamp(currentTime)+' · '+result.timezone+' · '+stamp(s[0].t)+'–'+stamp(s.at(-1).t)+' event timeline';}
  $('colorNote').textContent=($('atmosphereEnabled').checked?'Modeled atmosphere':'Production sky rendering')+' · '+(weather(currentTime)?'local cloud estimate':'no live weather')+'. Graph uses the atmospheric model even in production sky mode. Recommended window: peak ±'+padding()+' min, clipped to the sampled range. Peak is uncalibrated.'+(a.peak&&(a.peak===s[0]||a.peak===s.at(-1))?' Peak reaches the sampled boundary; timing may lie outside this range.':'');
  const show=$('showColorComponents').checked;$('colorComponents').hidden=!show;
  if(show&&s.length){const nearest=s.reduce((a,b)=>Math.abs(a.t-currentTime)<=Math.abs(b.t-currentTime)?a:b),warm=s.reduce((a,b)=>a.warmStrength>=b.warmStrength?a:b);$('componentReadout').textContent='At '+stamp(nearest.t)+': colorfulness '+nearest.colorfulness.toFixed(0)+'/100 · warm strength '+nearest.warmStrength.toFixed(0)+'/100. '+(warm.warmStrength>=1?'Warm-strength maximum: '+stamp(warm.t)+'.':'No appreciable warm-color strength in this interval.');}
  $('skyTimeBadge').textContent=stamp(currentTime)+' · '+result.timezone;
  $('skyDisplayStatus').textContent=SkyCountdown.displayStatus(a,PeakAnalysis.windowAround(a.samples,a.peak,padding()),mode,realTimeView?Date.now():currentTime,realTimeView,playing);
  syncTerrainVisibility();refreshProjector();graph(a);
 }
 function graph(a){
  const c=$('colorChart'),g=c.getContext('2d'),w=Math.max(240,c.getBoundingClientRect().width),h=302,dpr=Math.min(devicePixelRatio||1,2),s=a.samples;
  if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
  g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);if(!s.length)return;
  const top=128,bottom=270,x=t=>(t-s[0].t)/(s.at(-1).t-s[0].t||1)*w,max=Math.max(...s.map(v=>v.luminance),1e-9);
  if(a.peak){g.fillStyle='rgba(0,240,80,.12)';g.fillRect(x(a.peak.t-padding()*60000),top,2*padding()*60000/(s.at(-1).t-s[0].t)*w,bottom-top);}
  const curves=$('showColorComponents').checked?[['colorfulness','#c5a3ff',100,[4,3]],['warmStrength','#ff9b32',100,[8,4]]]:[];curves.push(['luminance','#ffd28a',max,[]],['potential','#ff8e87',100,[]]);
  for(const [key,color,scale,dash] of curves){g.setLineDash(dash);g.beginPath();g.strokeStyle=color;g.lineWidth=dash.length?1.5:2;s.forEach((v,i)=>{const xx=x(v.t),y=top+125-v[key]/scale*115;i?g.lineTo(xx,y):g.moveTo(xx,y);});g.stroke();}
  g.setLineDash([]);
  s.forEach(v=>{g.fillStyle='rgb('+GlowModel.display(v.rgb).join(',')+')';g.fillRect(x(v.t),top+130,w/s.length+1,14);});
  ChartMarkers.draw(g,ChartMarkers.markers(a,currentTime,$('eventMode').value,PeakAnalysis.windowAround(s,a.peak,padding())),x,w,top,bottom,stamp);
  g.fillStyle='#cedbe5';g.font='12px system-ui';g.fillText(stamp(s[0].t),4,h-4);g.fillText(stamp(s.at(-1).t),w-g.measureText(stamp(s.at(-1).t)).width-4,h-4);
  c.setAttribute('aria-label',ChartMarkers.markers(a,currentTime,$('eventMode').value,PeakAnalysis.windowAround(s,a.peak,padding())).map(m=>m.label+' '+stamp(m.t)).join('; '));
 }
 function renderSky(ctx,v){syncSkyMode();
  if(!$('atmosphereEnabled').checked)return;
  const {sun,focus,scale,base,w,h}=v,s=geometry(Math.round(currentTime/1000)*1000),width=64,height=28;
  const key=[Math.round(s.alt*5),Math.round(s.az),Math.round(focus),Math.round(w/h*100),Math.round(VIEW_FOV),aod(),result.terrain.observer_m,$('candidateUseWeather').checked,weatherSite,Math.floor(currentTime/60000)].join(':');
  if(key!==skyKey){
   skyKey=key;skyImage=document.createElement('canvas');skyImage.width=width;skyImage.height=height;const g=skyImage.getContext('2d'),image=g.createImageData(width,height);
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){const az=focus+(x/width-.5)*VIEW_FOV,alt=Math.min(90,Math.max(.15,(base-y/height*h)/scale)),relative=((az-s.az+540)%360)-180,rgb=clouds(GlowModel.radiance(alt,relative,s.alt,aod(),result.terrain.observer_m),alt,az,currentTime,s.alt);image.data.set([...GlowModel.display(rgb),255],(y*width+x)*4);}g.putImageData(image,0,0);
  }
  ctx.drawImage(skyImage,0,0,w,h);
 }
 function invalidate(){analysisKey='';skyKey='';}
 function requestRefresh(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;refresh();});}
 for(const id of ['candidateAod','atmosphereEnabled'])$(id).addEventListener('change',()=>{invalidate();draw();refresh();});
 $('showColorComponents').onchange=refresh;
 $('peakPadding').onchange=()=>{$('peakPadding').value=padding();refresh();};
 $('colorTime').oninput=()=>{const a=buildAnalysis();if(a&&a.samples.length){playing=false;updatePlay();setTime(a.samples[+$('colorTime').value].t);refresh();}};
 $('jumpColorPeak').onclick=()=>{const a=buildAnalysis();if(a&&a.peak){playing=false;updatePlay();setTime(a.peak.t);centerSunset();refresh();}};
 $('eventMode').addEventListener('change',()=>{invalidate();requestRefresh();});
 $('time').addEventListener('input',requestRefresh);
 // Intercept only single-pointer horizontal drags in timeline mode. Pan mode
 // leaves the original production pointer and pinch behavior in place.
 canvas.addEventListener('pointerdown',e=>{if($('candidateGesture').value!=='time'||!result)return;if(!e.isPrimary){e.stopImmediatePropagation();return;}if(e.button!==0)return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,t:realTimeView?Date.now():currentTime,active:false};e.stopImmediatePropagation();},{capture:true});
 canvas.addEventListener('pointermove',e=>{if(!gesture||gesture.id!==e.pointerId)return;e.stopImmediatePropagation();const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(!gesture.active){if(Math.max(Math.abs(dx),Math.abs(dy))<8)return;if(Math.abs(dy)>Math.abs(dx)){gesture=null;return;}gesture.active=true;playing=false;realTimeView=false;realtimeRequested=false;updatePlay();canvas.setPointerCapture(e.pointerId);}const a=buildAnalysis();if(a.samples.length)setTime(gesture.t-dx/Math.max(1,canvas.getBoundingClientRect().width)*(a.samples.at(-1).t-a.samples[0].t));requestRefresh();},{capture:true});
 function finish(e){if(!gesture||gesture.id!==e.pointerId)return;e.stopImmediatePropagation();gesture=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);requestRefresh();}
 $('candidateGesture').onchange=()=>{gesture=null;document.querySelectorAll('[data-gesture]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.gesture===$('candidateGesture').value)));canvas.style.touchAction=$('candidateGesture').value==='time'?'pan-y':'none';document.querySelector('.view-tools > span').textContent=$('candidateGesture').value==='time'?'SWIPE TO CHANGE TIME · SELECT PAN MODE TO LOOK AROUND':'DRAG TO PAN · PINCH TO ZOOM · SCROLL TO CHANGE TIME';};$('candidateGesture').onchange();
 for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,finish,{capture:true});
 const weatherPreference='localsunset.atmosphere.candidate.weatherEnabled',weatherCache='localsunset.atmosphere.candidate.weatherCache.v3';
 let weatherRequest=null,weatherRequestId=0,weatherPendingKey='',weatherFetchedAt=0;
 const weatherAttempts=new Map(),weatherRetries=new Map();
 try{$('candidateUseWeather').checked=localStorage.getItem(weatherPreference)!=='false';const cached=JSON.parse(localStorage.getItem(weatherCache)||'null');if(cached&&cached.data?.hourly?.time?.length&&Number.isFinite(cached.fetchedAt)){weatherData=cached.data;weatherSite=cached.site;weatherFetchedAt=cached.fetchedAt;}}catch(e){}
 if($('candidateUseWeather').checked)$('candidateWeatherStatus').textContent=(weatherData?'Cached cloud forecast from '+new Date(weatherFetchedAt).toLocaleString()+' · automatic updates active.':'Local cloud estimate enabled · checking forecast automatically.');
 async function ensureWeather(){
  const checkbox=$('candidateUseWeather');if(!checkbox.checked||!result||!renderedKey||calculationPending||resultDirty||document.hidden)return;
  const p=site(),target=p.lat+','+p.lon,time=realTimeView?Date.now():currentTime,key=target+'|'+new Date(time).toISOString().slice(0,10),now=Date.now();
  if(weatherRequest&&weatherPendingKey!==key){weatherRequestId++;weatherRequest.abort();weatherRequest=null;weatherPendingKey='';}
  if(!ForecastRefresh.needed({enabled:true,ready:true,pending:!!weatherRequest,now,target,dataSite:weatherSite,hasData:!!weatherData,fetchedAt:weatherFetchedAt,covered:weatherSite===target&&!!GlowModel.weatherAt(weatherData,time),lastAttempt:weatherAttempts.get(key)||0,retryAt:weatherRetries.get(key)||0}))return;
  const id=++weatherRequestId,controller=new AbortController();weatherRequest=controller;weatherPendingKey=key;weatherAttempts.set(key,now);const timer=setTimeout(()=>controller.abort(),40000);checkbox.setAttribute('aria-busy','true');
  $('candidateWeatherStatus').textContent='Updating local cloud forecast automatically…';
  try{
   const u=new URL('https://api.open-meteo.com/v1/forecast');Object.entries({latitude:p.lat,longitude:p.lon,hourly:'wind_speed_10m,wind_direction_10m,temperature_2m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high',wind_speed_unit:'mph',temperature_unit:'celsius',timezone:'GMT',forecast_days:7}).forEach(([k,v])=>u.searchParams.set(k,v));
   const r=await fetch(u.href,{signal:controller.signal});if(!r.ok)throw Error('Weather provider returned '+r.status);const data=await r.json();if(!data.hourly?.time?.length)throw Error('No hourly forecast available.');
   if(id!==weatherRequestId||!checkbox.checked)return;
   const current=site();if(current.lat+','+current.lon!==target)return;
   weatherData=data;weatherSite=target;weatherFetchedAt=Date.now();weatherRetries.delete(key);
   try{localStorage.setItem(weatherCache,JSON.stringify({site:weatherSite,fetchedAt:weatherFetchedAt,data:weatherData}));}catch(e){}
   $('candidateWeatherStatus').textContent='Forecast updated '+new Date(weatherFetchedAt).toLocaleString()+'. Refreshes automatically about every 30 minutes and when the location or required coverage changes.'+(!GlowModel.weatherAt(data,time)?' Selected time is outside the available forecast.':'');
  }catch(e){if(id===weatherRequestId&&checkbox.checked){weatherRetries.set(key,Date.now()+ForecastRefresh.retryDelay);$('candidateWeatherStatus').textContent='Forecast refresh unavailable. Retrying automatically in 5 minutes; the last available forecast is retained where applicable.';}}
  finally{clearTimeout(timer);if(id===weatherRequestId){weatherRequest=null;weatherPendingKey='';checkbox.removeAttribute('aria-busy');invalidate();draw();refresh();}}
 }
 $('candidateUseWeather').onchange=()=>{
  const checkbox=$('candidateUseWeather');try{localStorage.setItem(weatherPreference,String(checkbox.checked));}catch(e){}
  if(!checkbox.checked){weatherRequestId++;if(weatherRequest)weatherRequest.abort();weatherRequest=null;weatherPendingKey='';checkbox.removeAttribute('aria-busy');$('candidateWeatherStatus').textContent='Local cloud estimate off.';}
  else{$('candidateWeatherStatus').textContent='Local cloud estimate enabled · automatic updates active.';weatherRetries.clear();}
  invalidate();draw();refresh();
 };
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)ensureWeather();});
 // Keep the graph cursor synced to playback, wheel, clocks and saved views.
 setInterval(requestRefresh,1000);
 return {renderSky,invalidate,refresh,buildAnalysis,refreshProjector,drawCompass,jumpMilestone};
})();

async function initializeCandidate(){
 if(!TerrainOption.enabled&&!result){if(!$('lat').value){$('lat').value=39.6888;$('lon').value=-105.156;$('height').value=2;$('date').value=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());currentName=displayedName='ZIP 80228 · approximate area center';}await calculateCurrent();CandidateAtmosphere.refresh();return;}
 if(result){CandidateAtmosphere.invalidate();draw();CandidateAtmosphere.refresh();calculateCurrent();return;}
 try{
  const r=await fetch('../terrain-80228.json');if(!r.ok)throw Error('Default terrain unavailable');const fixture=await r.json();
  for(const [key,value] of Object.entries({lat:fixture.lat,lon:fixture.lon,height:fixture.height,radius:60,zoom:10,source:'global'}))$(key).value=value;
  $('date').value=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  currentName=displayedName='ZIP 80228 · approximate area center';$('search').value='80228';$('zip').value='80228';$('zipCity').value='Colorado · ZIP area center';
  const input=calculationInput();await WebCache.put('horizon:'+JSON.stringify([1,input.lat,input.lon,input.height,input.radius,input.zoom,input.source]),fixture.terrain);
  TerrainOption.remember(input,fixture.terrain);result=BrowserSolar.calculate(input.lat,input.lon,input.date,'America/Denver',fixture.terrain);renderedKey=JSON.stringify(input);resultDirty=false;
  showResult();updatePlaceTitle();persistScene();CandidateAtmosphere.refresh();status('ZIP 80228 test terrain ready · modeled atmosphere · no live weather.');
 }catch(e){status(e.message);}
}
// Name entry avoids modal dialogs and still uses the original saved-place API.
const saveName=document.createElement('input');saveName.id='candidateSaveName';saveName.placeholder='Name for saved location';saveName.setAttribute('aria-label','Name for saved location');$('saved').before(saveName);
$('save').onclick=async()=>{try{const name=saveName.value.trim()||currentName;await api('/api/locations',jsonOptions({name,...coordinates()}));await loadSaved();status('Location saved in this candidate browser.');}catch(e){status(e.message);}};
$('candidateTerrainEnabled').onchange=async()=>{
 if(calculationPending){$('candidateTerrainEnabled').checked=TerrainOption.enabled;return;}
 TerrainOption.set($('candidateTerrainEnabled').checked);CandidateAtmosphere.invalidate();syncTerrainVisibility();
 if(TerrainOption.enabled){await calculateCurrent();}
 else {try{const input=calculationInput();if(result&&renderedKey){const prior=JSON.parse(renderedKey);if(prior.lat===input.lat&&prior.lon===input.lon)TerrainOption.remember(input,result.terrain);}await TerrainOption.resolveGround(input);result=TerrainOption.calculate(input);renderedKey=JSON.stringify(input);displayedName=currentName;resultDirty=false;showResult(true);updatePlaceTitle();persistScene();status('Surrounding terrain disabled. Ground elevation retained; unobstructed sky calculated.');}catch(e){status(e.message);}}
 CandidateAtmosphere.invalidate();syncTerrainVisibility();draw();CandidateAtmosphere.refresh();
};
syncTerrainVisibility();initializeCandidate();
