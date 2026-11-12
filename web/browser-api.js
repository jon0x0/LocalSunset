/* Static-site API adapter: every /api operation is handled on this device. */
(()=>{
 const nativeFetch=window.fetch.bind(window),prefix='localsunset.web.',jobs=new Map(),queue=[];let worker=null,active=null,serial=0;
 const get=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(prefix+key))??fallback;}catch(error){return fallback;}};
 const set=(key,value)=>{localStorage.setItem(prefix+key,JSON.stringify(value));return value;};
 const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 function pump(){if(active||!queue.length)return;active=queue.shift();if(!worker){worker=new Worker(new URL('terrain-worker.js',document.baseURI));worker.onmessage=event=>{const state=event.data;jobs.set(state.id,{...jobs.get(state.id),...state});if(['done','error'].includes(state.status)){active=null;pump();}};worker.onerror=event=>{if(active)jobs.set(active.id,{...jobs.get(active.id),status:'error',error:event.message||'Browser worker could not load. Use an up-to-date browser over HTTP(S).'});worker.terminate();worker=null;active=null;pump();};}worker.postMessage(active);}
 const calibrationDefault=()=>({revision:0,enabled:true,grid:false,fov:75,corners:Object.fromEntries(['tl','tr','br','bl'].map(name=>[name,{x:0,y:0}]))});
 function zone(lat,lon){if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat< -90||lat>90||lon< -180||lon>180)throw Error('Enter valid latitude and longitude.');return tzlookup(lat,lon);}
 function today(lat,lon){const timezone=zone(lat,lon),parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));return {date:parts.year+'-'+parts.month+'-'+parts.day,timezone};}
 async function zip(code){const r=await nativeFetch('https://api.zippopotam.us/us/'+code.slice(0,5));if(!r.ok)throw Error('ZIP city lookup is unavailable. You can still enter coordinates.');const data=await r.json();return {zip:code,places:data.places.map(p=>({city:p['place name'],state:p['state abbreviation'],lat:Number(p.latitude),lon:Number(p.longitude)}))};}
 function census(address){return new Promise((resolve,reject)=>{const name='localSunsetGeocode'+(++serial),script=document.createElement('script'),timer=setTimeout(()=>finish(Error('US address lookup timed out.')),20000);function finish(error,data){clearTimeout(timer);script.remove();delete window[name];if(error)reject(error);else resolve(data);}window[name]=data=>finish(null,data);script.onerror=()=>finish(Error('US address lookup is unavailable.'));script.src='https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?'+new URLSearchParams({address,benchmark:'Public_AR_Current',format:'jsonp',callback:name});document.head.append(script);});}
 async function search(query,postal){
  const detected=query.match(/(?:^|[\s,])(\d{5}(?:-\d{4})?)(?:\s*,?\s*(?:USA|US|United States))?\s*$/i),code=postal||(detected?detected[1]:'');let locality=null;
  if(code){if(!/^\d{5}(?:-\d{4})?$/.test(code))throw Error('Enter a five-digit ZIP or ZIP+4.');try{locality=await zip(code);}catch(error){} }
  if((code||/^\s*\d+\s+\S/.test(query))&&query.replace(/\d{5}(?:-\d{4})?/,'').trim().length>2){try{const data=await census(query+(detected||!code?'':' '+code)),rows=data.result.addressMatches;if(rows.length)return rows.slice(0,8).map(row=>({name:row.matchedAddress,lat:row.coordinates.y,lon:row.coordinates.x,postcode:row.addressComponents.zip,city:row.addressComponents.city,state:row.addressComponents.state,source:'US Census street address'}));}catch(error){}}
  if(/^\d{5}(?:-\d{4})?$/.test(query.trim())&&locality)return locality.places.map(p=>({...p,name:p.city+', '+p.state+' '+code,postcode:code,source:'ZIP area center (approximate)'}));
  const house=query.trim().match(/^(\d+[A-Za-z]?(?:-\d+)?)\s+/),place=locality?locality.places[0]:null,full=query+(place?' '+place.city+' '+place.state+' '+code:'');
  try{const r=await nativeFetch('https://photon.komoot.io/api/?'+new URLSearchParams({q:full,limit:'8'}));if(r.ok){const data=await r.json(),matches=data.features.filter(f=>(!house||String(f.properties.housenumber||'').toLowerCase()===house[1].toLowerCase())&&(!code||String(f.properties.postcode||'').slice(0,5)===code.slice(0,5)));if(matches.length)return matches.map(f=>({name:[f.properties.name,f.properties.street,f.properties.housenumber,f.properties.city,f.properties.state,f.properties.country].filter(Boolean).join(', '),lat:f.geometry.coordinates[1],lon:f.geometry.coordinates[0],postcode:f.properties.postcode||'',city:f.properties.city||'',state:f.properties.state||'',source:'Photon / OpenStreetMap'}));}}catch(error){}
  if(house)return [];
  const r=await nativeFetch('https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name:query,count:'8',language:'en',format:'json'}));if(!r.ok)throw Error('Place lookup unavailable. Enter coordinates instead.');const data=await r.json();return (data.results||[]).map(p=>({name:[p.name,p.admin1,p.country].filter(Boolean).join(', '),lat:p.latitude,lon:p.longitude,source:'Open-Meteo city/place center (approximate; not a street address)'}));
 }
 async function api(url,options){
  const method=(options.method||'GET').toUpperCase(),path=url.pathname.replace(/\/$/,''),body=options.body?JSON.parse(options.body):null;
  if(body&&body.ground!=null){if(!Number.isFinite(body.ground)||body.ground< -12000||body.ground>10000)throw Error('Invalid ground elevation override.');body.near=body.near??100;if(!Number.isFinite(body.near)||body.near<50||body.near>1000)throw Error('DEM exclusion distance must be between 50 and 1000 meters.');}
  if(path==='/api/health')return {status:'ok',edition:'browser'};
  if(path==='/api/activity'){let value=get('activity',null);if(value===null||method==='POST')value=set('activity',Date.now());return {last_input_ms:value,idle_ms:Math.max(0,Date.now()-value)};}
  if(path==='/api/display-target')return {url:'this browser'};
  if(path==='/api/today')return today(Number(url.searchParams.get('lat')),Number(url.searchParams.get('lon')));
  if(path.startsWith('/api/zip/'))return zip(decodeURIComponent(path.slice(9)));
  if(path==='/api/search')return search(url.searchParams.get('q')||'',url.searchParams.get('zip')||'');
  if(path==='/api/locations'){
   const rows=get('locations',[]);if(method==='POST'){if(!body.name||body.name.length>120)throw Error('Give the location a name.');zone(body.lat,body.lon);return set('locations',[...rows.filter(p=>p.name!==body.name),body]);}return rows;
  }
  if(path.startsWith('/api/locations/')&&method==='DELETE')return set('locations',get('locations',[]).filter(p=>p.name!==decodeURIComponent(path.slice('/api/locations/'.length))));
  if(path==='/api/calculate'){
   zone(body.lat,body.lon);if(!/^\d{4}-\d\d-\d\d$/.test(body.date))throw Error('Choose a valid date.');const signature=[body.lat,body.lon,body.height,body.radius,body.zoom,body.source,body.date,...(body.ground!=null?[body.ground,body.near??100]:[])];
   for(const [id,job] of jobs)if(JSON.stringify(job.signature)===JSON.stringify(signature)&&job.status!=='error')return {id};
   for(const [id,job] of jobs)if(jobs.size>8&&['done','error'].includes(job.status))jobs.delete(id);
   const id=String(++serial);jobs.set(id,{status:'queued',message:'Waiting for browser terrain worker...',signature});queue.push({id,input:body});pump();return {id};
  }
  if(path.startsWith('/api/jobs/')){const result=jobs.get(path.slice('/api/jobs/'.length));if(!result)throw Error('Browser calculation not found. Trace this location again.');return result;}
  if(path==='/api/cache'){
   if(method==='DELETE'){if(active||queue.length)return json({error:'A calculation is running. Clear cache after it finishes.'},409);await WebCache.clear();jobs.clear();}
   return {...await WebCache.stats(),busy:!!active||queue.length>0};
  }
  if(path==='/api/scene-style'){const state=get('style',{revision:0,rays:true,trees:false,strength:65,sky_only:false,clock12:false,sky_labels:false});return method==='PUT'?set('style',{...body,revision:state.revision+1}):state;}
  if(path==='/api/projector-calibration'){
   const state=get('calibration',calibrationDefault());if(method!=='PUT')return state;
   let value={enabled:body.enabled,grid:body.grid,fov:body.fov,corners:body.corners,revision:state.revision+1};if(state.default)value.default=state.default;
   if(body.action==='save_default')value.default={enabled:value.enabled,fov:value.fov,corners:value.corners};
   if(body.action==='restore_default'){if(!state.default)throw Error('Save a default alignment first.');value={...value,...state.default,grid:false};}
   return set('calibration',value);
  }
  if(path==='/api/display-config'){const state=get('display',{revision:0,config:null});return method==='PUT'?set('display',{revision:state.revision+1,config:body}):state;}
  if(path==='/api/display-view'){const state=get('view',{revision:0,view:null});return method==='PUT'?set('view',{revision:state.revision+1,view:{...body,updated_ms:Date.now()}}):state;}
  if(path==='/api/display-ack'){const state=get('ack',{revision:0,updated_ms:0});return method==='POST'?set('ack',{revision:body.revision,updated_ms:Date.now()}):state;}
  return json({error:'This operation is not available in the browser edition.'},404);
 }
 window.fetch=async(input,options={})=>{const url=new URL(typeof input==='string'?input:input.url,document.baseURI);if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return nativeFetch(input,options);try{const result=await api(url,options);return result instanceof Response?result:json(result);}catch(error){return json({error:error.message||String(error)},400);}};
 window.addEventListener('DOMContentLoaded',()=>{document.body.dataset.browserEdition='true';document.getElementById('syncHDMI').checked=false;document.querySelector('.hdmi-sync').hidden=true;document.getElementById('projectLocation').hidden=true;document.querySelector('.network-settings:not(.scene-settings)').hidden=true;const note=document.createElement('p');note.className='hint browser-edition-note';note.textContent='Browser edition - calculations and saved places stay on this device.';document.querySelector('aside .intro').after(note);});
 if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
})();
