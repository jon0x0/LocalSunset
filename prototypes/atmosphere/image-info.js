/* Provenance belongs to the presented frame, independently of pending downloads. */
(()=>{
 const button=document.createElement('button');button.type='button';button.textContent='About this image';button.setAttribute('aria-haspopup','dialog');
 document.querySelector('.sky-gesture-buttons').append(button);
 const dialog=document.createElement('dialog');dialog.className='image-info';dialog.setAttribute('aria-labelledby','imageInfoTitle');
 const title=document.createElement('h2');title.id='imageInfoTitle';title.textContent='About this image';
 const close=document.createElement('button');close.type='button';close.textContent='Close';close.onclick=()=>dialog.close();
 const table=document.createElement('dl'),note=document.createElement('p');note.textContent='Satellite geometry and illumination are approximate. A local forecast is not an observation of the historical sky. Unresolved cloud heights, hidden layers, snowfall and cloud growth/decay are not reconstructed.';
 dialog.append(title,close,table,note);document.body.append(dialog);button.onclick=()=>{dialog.showModal();refresh();};
 const checked=id=>!!document.getElementById(id)?.checked;
 function stamp(t){return t?new Date(t).toLocaleString([],{timeZone:result?.timezone||'UTC'})+' '+(result?.timezone||'UTC'):'Unavailable';}
 function refresh(){
  if(typeof CandidateAtmosphere==='undefined')return;
  const info=CandidateAtmosphere.imageInfo(),f=info.frame,site=renderedKey?JSON.parse(renderedKey):null;
  const live=site&&typeof SatelliteClouds!=='undefined'?SatelliteClouds.imageInfo(info.selectedTime,site.lat,site.lon):null;
  const loading=[live?.loading?(live.stage||'Preparing matching clouds'):null,info.rendering?'Rendering sky':null,document.querySelector('.terrain-loading-badge')?.hidden===false?'Loading terrain surfaces':null].filter(Boolean);
  button.textContent=loading.length?'About this image · Loading…':'About this image';button.title=loading.join(' · ')||'Effects, data sources and observation times';
  if(!dialog.open&&table.childElementCount)return;
  const scroll=dialog.scrollTop;table.replaceChildren();
  function row(label,value){const term=document.createElement('dt'),text=document.createElement('dd');term.textContent=label;text.textContent=value;table.append(term,text);}
  row('Selected view',(info.realtime?'Realtime · ':'Simulation · ')+stamp(info.selectedTime));
  row('Loading / pending',loading.join(' · ')||'No active downloads or sky render');
  if(live)row('Requested cloud data',live.state+' · '+live.message);
  row('Displayed sky',!info.atmosphere?'Original sky renderer':!f?'Waiting for first atmosphere frame':f.backgroundOnly?'Temporary atmosphere-only background while cloud data loads':Math.abs(info.selectedTime-f.frameTime)>2000?'Previous rendered frame while updating':'Atmospheric sky with cloud data');
  if(f&&info.atmosphere){
   row('Frame time',stamp(f.frameTime));row('Frame rendered',stamp(f.renderedAt));
   row('Atmosphere',f.optics?.spectral?'16-band spectral scattering, approximate ozone absorption and diffuse cloud light · '+f.optics.ozoneDU+' DU assumed ozone':'Original RGB atmospheric model');
   row('Haze / elevation','Assumed aerosol optical depth '+f.aod+' · observer '+Math.round(f.observer)+' m above sea level');
   if(!f.backgroundOnly){
    const u=f.usage,total=u?u.satellite+u.forecast+u.clear:0,pct=n=>total?Math.round(n/total*100)+'%':'0%';
    if(u)row('Cloud source use',pct(u.satellite)+' satellite lookup · '+pct(u.forecast)+' forecast fallback · '+pct(u.clear)+' no cloud data (sampled sky pixels, not cloud-cover percentages)');
    const s=f.satellite;if(s){
     row('Satellite in this frame',s.source+' · '+s.state);row('Cloud-mask observation',stamp(s.observedAt));row('Cloud-top observation',stamp(s.topObservedAt));
     row('Time projection',s.offsetMinutes===null?'No observation':s.offsetMinutes.toFixed(1)+' minutes after observation · '+(s.windProjection?'height-dependent profile wind within 50 km; distant/unsupported clouds held still':'still observation'));
     row('Cloud bases / thickness',s.baseEstimation?s.profileStatus:'Base estimation off; assumed thickness '+s.assumedThicknessKm+' km');row('Wind / humidity profile',stamp(s.profileTime));
     row('Satellite products',s.products.filter(Boolean).join('\n')||'None');
    }
    row('Precipitation forecast',CandidateAtmosphere.precipitationText(f.weather));
    row('Forecast fallback',f.weather?'Open-Meteo local hourly model forecast; interpolated to frame time · downloaded '+stamp(f.weatherFetchedAt):'No matching forecast applied');
   }
  }
  row('Terrain',checked('candidateTerrainEnabled')?'Elevation-map skyline and terrain event calculations enabled':'Surrounding terrain disabled; point ground elevation retained');
  row('Terrain lighting',checked('terrainLightingEnabled')?(document.getElementById('terrainLightStatus')?.textContent||'Enabled')+' · mountain cast shadows '+(checked('terrainCastShadows')?'on':'off'):'Off');
  if(info.workerFailed)row('Rendering error','Atmosphere worker unavailable; base sky fallback');
  dialog.scrollTop=scroll;
 }
 setInterval(()=>{if(!document.hidden)refresh();},1000);refresh();
})();
