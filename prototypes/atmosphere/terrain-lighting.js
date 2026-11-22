/* Cached direct solar illumination and moving sunline; shadow sweeps run in a worker. */
const TerrainLighting=(()=>{
 const label=document.createElement('label');label.className='check-label terrain-light-option';label.innerHTML='<input id="terrainLightingEnabled" type="checkbox" checked> Terrain sunlight & shadows';document.getElementById('atmosphereEnabled').parentElement.after(label);
 const enabled=document.getElementById('terrainLightingEnabled'),details=document.createElement('details');details.innerHTML='<summary>Terrain lighting · experimental</summary><label class="check-label"><input id="terrainCastShadows" type="checkbox" checked> Mountain cast shadows</label><label class="check-label"><input id="terrainCloudSun" type="checkbox" checked> Account for clouds along sunlight path</label><p id="terrainLightStatus" role="status">Enabled by default; loads a cached 60 km-wide elevation mesh. Direct sunlight and moving ridge shadows; approximate cloud attenuation.</p><p class="hint">Sunline follows the 125 m near / 690 m outer elevation grid and a finite solar disk. Reflectance and cloud attenuation are approximate; shadows stop at the mesh boundary. The existing skyline and event predictions are unchanged. Phones draw fewer triangles. Remote cloud shadows, snow cover and volumetric light shafts are not resolved.</p>';document.querySelector('.atmosphere-panel').append(details);
 const message=document.getElementById('terrainLightStatus'),badge=document.createElement('div');badge.className='cloud-loading-badge terrain-loading-badge';badge.hidden=true;badge.style.top='46px';document.querySelector('.scene').append(badge);
 const preference='localsunset.atmosphere.candidate.terrainLighting';try{enabled.checked=localStorage.getItem(preference)!=='false';}catch(e){}
 let mesh=null,worker=null,pending='',failed='',meshKey='',shadeKey='',brightness=[],loadId=0,renderKey='',surface=null,lightWorker=null,lightPending='',lightReady='',lightId=0;
 const script=document.currentScript.src;
 function context(){if(typeof result==='undefined'||!result||!renderedKey||!TerrainOption.enabled||result.terrain.disabled)return null;const p=JSON.parse(renderedKey);return {...p,key:JSON.stringify([p.lat,p.lon,p.zoom,p.source])};}
 function ensure(){const p=context();if(!enabled.checked||!p){if(worker){loadId++;worker.terminate();worker=null;pending='';}badge.hidden=true;return;}if(meshKey===p.key||pending===p.key||failed===p.key)return;
  if(worker)worker.terminate();pending=p.key;badge.hidden=false;badge.textContent='Loading terrain surfaces for sunlight…';message.textContent=badge.textContent;const id=++loadId;
  worker=new Worker(new URL('terrain-worker.js',document.querySelector('script[src$="app.js"]').src));
  worker.onmessage=({data:r})=>{if(id!==loadId)return;if(r.status==='running'){message.textContent=r.message;return;}if(r.status==='mesh'){mesh=r.mesh;meshKey=p.key;shadeKey='';brightness=[];lightReady='';lightPending='';lightId++;if(lightWorker)lightWorker.terminate();lightWorker=null;message.textContent='Terrain lighting ready · '+mesh.source+' · approximate surfaces/shadows within the 60 km-wide mesh.';}else{failed=p.key;message.textContent=r.error||'Lighting mesh unavailable.';}worker.terminate();worker=null;pending='';badge.hidden=true;draw();};
  worker.onerror=()=>{failed=p.key;pending='';worker.terminate();worker=null;badge.hidden=true;message.textContent='Terrain lighting unavailable; original scenery retained.';};worker.postMessage({kind:'mesh',id,input:p});
 }
 enabled.onchange=()=>{try{localStorage.setItem(preference,String(enabled.checked));}catch(e){}failed='';ensure();draw();};document.getElementById('terrainCastShadows').onchange=()=>{shadeKey='';draw();};document.getElementById('terrainCloudSun').onchange=()=>{renderKey='';draw();};
 function requestLights(sun,shadows){
  const key=[Math.round(sun.alt*20),Math.round(sun.az*10),shadows].join('|');
  if(lightReady===key||lightPending)return;
  if(!lightWorker){
   lightWorker=new Worker(new URL('terrain-light-worker.js',script));
   lightWorker.onmessage=({data:r})=>{if(r.id!==lightId)return;brightness=r.lights;lightReady=lightPending;lightPending='';shadeKey=lightReady;renderKey='';badge.hidden=true;draw();};
   lightWorker.onerror=()=>{message.textContent='Sunlight computation unavailable; reload to retry.';lightPending='';badge.hidden=true;};
   lightWorker.postMessage({mesh,id:++lightId,alt:sun.alt,az:sun.az,shadows});
  }else lightWorker.postMessage({id:++lightId,alt:sun.alt,az:sun.az,shadows});
  lightPending=key;if(!brightness.length){badge.hidden=false;badge.textContent='Computing terrain sunline…';}
 }
 function display(rgb){return 'rgb('+rgb.map(v=>{v=Math.max(0,Math.min(1,v));return Math.round(255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055));}).join(',')+')';}
 function render(ctx,v){ensure();const p=context();if(!enabled.checked||!mesh||!p||meshKey!==p.key)return;
  const {sun,focus,scale,base,w,h}=v,phone=w<760||matchMedia('(pointer:coarse)').matches,step=phone?2:1,n=mesh.size,shadows=document.getElementById('terrainCastShadows').checked;
  requestLights(sun,shadows);if(!brightness.length)return;
  const spectral=document.getElementById('spectralEnabled')?.checked,ozone=Number(document.getElementById('ozoneDU')?.value)||300,aod=Number(document.getElementById('candidateAod')?.value)||.12;
  const time=typeof realTimeView!=='undefined'&&realTimeView?Date.now():currentTime,weather=typeof CandidateAtmosphere!=='undefined'?CandidateAtmosphere.weatherAt(time):null,cloudSun=document.getElementById('terrainCloudSun').checked;
  const revision=typeof SatelliteClouds==='undefined'?0:SatelliteClouds.revision;
  const cacheKey=[renderedKey,shadeKey,focus,scale,base,w,h,spectral,ozone,aod,cloudSun,revision,Math.floor(time/60000),weather?.total].join('|');
  if(surface&&renderKey===cacheKey){ctx.drawImage(surface,0,0,w,h);return;}
  const target=ctx,ratio=Math.min(1,(phone?720:1024)/w,800/h);if(!surface)surface=document.createElement('canvas');surface.width=Math.max(1,Math.ceil(w*ratio));surface.height=Math.max(1,Math.ceil(h*ratio));ctx=surface.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);renderKey=cacheKey;
  const triangles=[],vertices=mesh.heights.map((height,i)=>{const v=TerrainLightGeometry.vertex(mesh,i%n,Math.floor(i/n),result.terrain.observer_m,focus,scale,base,w);return v?{...v,height,...brightness[i]}:null;});
  for(let y=0;y<n-step;y+=step)for(let x=0;x<n-step;x+=step)for(const ids of [[y*n+x,y*n+x+step,(y+step)*n+x],[(y+step)*n+x,y*n+x+step,(y+step)*n+x+step]]){
   const vs=ids.map(i=>vertices[i]);if(vs.some(v=>!v||Math.abs(v.relative)>VIEW_FOV/2+12)||Math.max(...vs.map(v=>v.x))-Math.min(...vs.map(v=>v.x))>w*.8)continue;
   triangles.push({vs,x,y,distance:vs.reduce((s,v)=>s+v.distance,0)/3});
  }triangles.sort((a,b)=>b.distance-a.distance);
  const daylight=Math.max(0,Math.min(1,(sun.alt+8)/12)),colorCache=new Map(),cloudCache=new Map();
  function transmission(x,y){if(!cloudSun)return 1;const xx=Math.round(x/16)*16,yy=Math.round(y/16)*16,key=xx+','+yy;if(cloudCache.has(key))return cloudCache.get(key);
   const east=mesh.axis?mesh.axis[xx]:(xx/(n-1)-.5)*mesh.span,north=mesh.axis?mesh.axis[yy]:(yy/(n-1)-.5)*mesh.span,lat=mesh.lat+north/111200,lon=mesh.lon+east/(111200*Math.cos(mesh.lat*Math.PI/180)),z=mesh.heights[Math.min(n-1,yy)*n+Math.min(n-1,xx)];
   let beam=typeof SatelliteClouds!=='undefined'?SatelliteClouds.sunTransmission(time,lat,lon,z+2,sun.alt+(east*Math.sin(sun.az*Math.PI/180)+north*Math.cos(sun.az*Math.PI/180))/6371008.8*180/Math.PI,sun.az):null;
   if(beam===null)beam=Number.isFinite(weather?.total)?Math.pow(1-weather.total/100,2):1;
   cloudCache.set(key,beam);return beam;
  }
  function directColor(height,alt){const bin=Math.round(height/250),key=bin+'|'+Math.round(alt*20);if(colorCache.has(key))return colorCache.get(key);
   // Direct solar spectrum only: diffuse illumination belongs in the shadow color.
   const rgb=typeof SpectralSky!=='undefined'?SpectralSky.directLight(alt,bin*250,aod,{ozoneDU:spectral?ozone:0}):[1,.55,.2];colorCache.set(key,rgb);return rgb;
  }
  function polygon(vs,color,alpha=1){if(vs.length<3)return;ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.beginPath();vs.forEach((v,i)=>i?ctx.lineTo(v.x,Math.max(-h*3,Math.min(h*4,v.y))):ctx.moveTo(v.x,Math.max(-h*3,Math.min(h*4,v.y))));ctx.closePath();ctx.fill();}
  ctx.save();ctx.beginPath();ctx.moveTo(0,h);for(let x=0;x<=w;x+=3){const az=((focus+(x-w/2)/scale)%360+360)%360,idx=az/360*result.terrain.horizon.length,j=Math.floor(idx),alt=result.terrain.horizon[j]+(result.terrain.horizon[(j+1)%result.terrain.horizon.length]-result.terrain.horizon[j])*(idx-j);ctx.lineTo(x,base-alt*scale);}ctx.lineTo(w,h);ctx.closePath();ctx.clip();
  for(const t of triangles){
   const haze=1-Math.exp(-t.distance/(55000/(1+aod*3)));
   polygon(t.vs,display(TerrainLightGeometry.material([0,0,0],0,0,daylight,haze)));
   const beam=transmission(t.x,t.y),incidence=t.vs.reduce((s,v)=>s+v.incidence,0)/3,height=t.vs.reduce((s,v)=>s+v.height,0)/3,solar=directColor(height,t.vs.reduce((s,v)=>s+v.localAlt,0)/3);
   const paintAt=value=>display(TerrainLightGeometry.material(solar,value,beam,daylight,haze));
   let paint=paintAt(incidence);
   const [a,b,c]=t.vs,dx=b.x-a.x,dy=b.y-a.y,ex=c.x-a.x,ey=c.y-a.y,det=dx*ey-dy*ex;
   if(Math.abs(det)>1e-5){const db=b.incidence-a.incidence,dc=c.incidence-a.incidence,gx=(db*ey-dc*dy)/det,gy=(dc*dx-db*ex)/det,len=Math.hypot(gx,gy);
    if(len>1e-6){const ux=gx/len,uy=gy/len,ps=t.vs.map(v=>v.x*ux+v.y*uy),lo=Math.min(...ps),hi=Math.max(...ps);
     if(hi-lo>.1){paint=ctx.createLinearGradient(ux*lo,uy*lo,ux*hi,uy*hi);paint.addColorStop(0,paintAt(Math.min(...t.vs.map(v=>v.incidence))));paint.addColorStop(1,paintAt(Math.max(...t.vs.map(v=>v.incidence))));}
    }
   }
   const min=Math.min(...t.vs.map(v=>v.clearance)),max=Math.max(...t.vs.map(v=>v.clearance));if(max<=-.27||beam<.001)continue;
   if(min>=.27)polygon(t.vs,paint);
   else for(const [threshold,alpha] of [[-.27,.2],[-.135,.25],[0,1/3],[.135,.5],[.27,1]])polygon(TerrainLightGeometry.sunPolygon(t.vs,threshold),paint,alpha);
  }ctx.restore();target.drawImage(surface,0,0,w,h);
  message.textContent='Sun '+sun.alt.toFixed(2)+'° · terrain sunline ready · '+mesh.source+' · 125 m near / 690 m outer grid, 60 km wide · '+(cloudSun?'satellite sunlight paths / forecast cloud fallback':'clear-sky direct sunlight comparison')+'. Mountain shadows stop at mesh boundary.';
 }
 return {render,get cacheBusy(){return !!pending;}};
})();
