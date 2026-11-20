/* This preference is read before restored scenes or calculation requests. */
const TerrainOption=(()=>{
 const key='localsunset.atmosphere.candidate.terrainEnabled';
 let enabled=true;try{enabled=localStorage.getItem(key)!=='false';}catch(e){}
 function set(value){enabled=!!value;try{localStorage.setItem(key,String(enabled));}catch(e){}}
 const pending=new Map(),groundKey=input=>'localsunset.atmosphere.candidate.ground.v1.'+input.lat+','+input.lon;
 function readGround(input){try{const r=JSON.parse(localStorage.getItem(groundKey(input))||'null');return r&&Number.isFinite(r.value)?r:null;}catch(e){return null;}}
 function remember(input,terrain){if(input.ground!=null||terrain.disabled||!Number.isFinite(terrain.ground_m))return;try{localStorage.setItem(groundKey(input),JSON.stringify({value:terrain.ground_m,source:terrain.sources.join(' + ')+' DEM ground'}));}catch(e){}}
 // Reuse measured ground from the last terrain scene, without any new download.
 try{const cached=JSON.parse(localStorage.getItem('localsunset.atmosphere.candidate.lastScene.v1')||'null');if(cached&&cached.result)remember(JSON.parse(cached.key),cached.result.terrain);}catch(e){}
 async function resolveGround(input){
  if(input.ground!=null)return {value:input.ground,source:'Manual ground elevation'};
  const cached=readGround(input);if(cached)return cached;
  const key=groundKey(input);if(pending.has(key))return pending.get(key);
  const promise=(async()=>{const u=new URL('https://api.open-meteo.com/v1/elevation');u.searchParams.set('latitude',input.lat);u.searchParams.set('longitude',input.lon);const r=await fetch(u.href,{signal:AbortSignal.timeout(40000)});if(!r.ok)throw Error('Ground elevation lookup failed. Retry or enter ground elevation manually.');const data=await r.json(),value=data.elevation&&data.elevation[0];if(!Number.isFinite(value)||value< -12000||value>10000)throw Error('Ground elevation is unavailable. Enter a manual ground elevation.');const record={value,source:'Copernicus GLO-90 via Open-Meteo'};try{localStorage.setItem(key,JSON.stringify(record));}catch(e){}return record;})();pending.set(key,promise);try{return await promise;}finally{pending.delete(key);}
 }
 function calculate(input){
  const record=input.ground!=null?{value:input.ground,source:'Manual ground elevation'}:readGround(input);if(!record)throw Error('Ground elevation lookup is required before calculating the sky.');
  const ground=record.value,flat=Array(1440).fill(0),terrain={disabled:true,ground_source:record.source,ground_m:ground,observer_m:ground+input.height,horizon:flat,layers:[flat,flat,flat],azimuths:flat.map((_,i)=>i*.25),sources:[],pixel_m:0,radius_km:0};
  const result=BrowserSolar.calculate(input.lat,input.lon,input.date,tzlookup(input.lat,input.lon),terrain);
  result.assumptions=['Surrounding terrain disabled; point ground elevation is still used.','Unobstructed astronomical horizon; local terrain event predictions are unavailable.','Observer elevation uses measured/cached or manually entered ground elevation plus height above ground.'];return result;
 }
 return {get enabled(){return enabled;},set,calculate,resolveGround,remember};
})();
