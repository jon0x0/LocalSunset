/* Optional CPU canvas mesh: ~2k visible triangles; phone uses half resolution. */
const TerrainLighting=(()=>{
 const label=document.createElement('label');label.className='check-label terrain-light-option';label.innerHTML='<input id="terrainLightingEnabled" type="checkbox" checked> Terrain sunlight & shadows';document.getElementById('atmosphereEnabled').parentElement.after(label);
 const enabled=document.getElementById('terrainLightingEnabled'),details=document.createElement('details');details.innerHTML='<summary>Terrain lighting · experimental</summary><label class="check-label"><input id="terrainCastShadows" type="checkbox" checked> Mountain cast shadows</label><p id="terrainLightStatus" role="status">Enabled by default; loads a cached 40 km-wide coarse elevation mesh. No cloud shadows or volumetric light shafts yet.</p><p class="hint">Approximate terrain reflectance and haze; terrain shadows stop at the mesh boundary. The existing skyline and event predictions are unchanged. Phones draw fewer triangles.</p>';document.querySelector('.atmosphere-panel').append(details);
 const message=document.getElementById('terrainLightStatus'),badge=document.createElement('div');badge.className='cloud-loading-badge terrain-loading-badge';badge.hidden=true;badge.style.top='46px';document.querySelector('.scene').append(badge);
 const preference='localsunset.atmosphere.candidate.terrainLighting';try{enabled.checked=localStorage.getItem(preference)!=='false';}catch(e){}
 let mesh=null,worker=null,pending='',failed='',meshKey='',shadeKey='',brightness=[],loadId=0,renderKey='',surface=null;
 const script=document.currentScript.src;
 function context(){if(typeof result==='undefined'||!result||!renderedKey||!TerrainOption.enabled||result.terrain.disabled)return null;const p=JSON.parse(renderedKey);return {...p,key:JSON.stringify([p.lat,p.lon,p.zoom,p.source])};}
 function ensure(){const p=context();if(!enabled.checked||!p){if(worker){loadId++;worker.terminate();worker=null;pending='';}badge.hidden=true;return;}if(meshKey===p.key||pending===p.key||failed===p.key)return;
  if(worker)worker.terminate();pending=p.key;badge.hidden=false;badge.textContent='Loading terrain surfaces for sunlight…';message.textContent=badge.textContent;const id=++loadId;
  worker=new Worker(new URL('terrain-worker.js',document.querySelector('script[src$="app.js"]').src));
  worker.onmessage=({data:r})=>{if(id!==loadId)return;if(r.status==='running'){message.textContent=r.message;return;}if(r.status==='mesh'){mesh=r.mesh;meshKey=p.key;shadeKey='';message.textContent='Terrain lighting ready · '+mesh.source+' · approximate surfaces/shadows within the 40 km-wide mesh.';}else{failed=p.key;message.textContent=r.error||'Lighting mesh unavailable.';}worker.terminate();worker=null;pending='';badge.hidden=true;draw();};
  worker.onerror=()=>{failed=p.key;pending='';worker.terminate();worker=null;badge.hidden=true;message.textContent='Terrain lighting unavailable; original scenery retained.';};worker.postMessage({kind:'mesh',id,input:p});
 }
 enabled.onchange=()=>{try{localStorage.setItem(preference,String(enabled.checked));}catch(e){}failed='';ensure();draw();};document.getElementById('terrainCastShadows').onchange=()=>{shadeKey='';draw();};
 function render(ctx,v){ensure();const p=context();if(!enabled.checked||!mesh||!p||meshKey!==p.key)return;const {sun,focus,scale,base,w,h}=v,step=(w<760||matchMedia('(pointer:coarse)').matches)?2:1,n=mesh.size,shadows=document.getElementById('terrainCastShadows').checked,key=[Math.round(sun.alt*5),Math.round(sun.az*2),shadows].join('|');
  const cacheKey=[renderedKey,key,focus,scale,base,w,h,document.getElementById('spectralEnabled')?.checked,document.getElementById('ozoneDU')?.value,document.getElementById('candidateAod')?.value].join('|');
  if(surface&&renderKey===cacheKey){ctx.drawImage(surface,0,0,w,h);return;}
  const target=ctx,ratio=Math.min(1,1024/w,800/h);if(!surface)surface=document.createElement('canvas');surface.width=Math.max(1,Math.ceil(w*ratio));surface.height=Math.max(1,Math.ceil(h*ratio));ctx=surface.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);renderKey=cacheKey;
  if(key!==shadeKey){shadeKey=key;brightness=mesh.heights.map((_,i)=>TerrainLightGeometry.direct(mesh,i%n,Math.floor(i/n),sun.alt,sun.az,shadows));}
  const triangles=[],vertices=mesh.heights.map((_,i)=>TerrainLightGeometry.vertex(mesh,i%n,Math.floor(i/n),result.terrain.observer_m,focus,scale,base,w));
  for(let y=0;y<n-step;y+=step)for(let x=0;x<n-step;x+=step)for(const ids of [[y*n+x,y*n+x+step,(y+step)*n+x],[(y+step)*n+x,y*n+x+step,(y+step)*n+x+step]]){
   const vs=ids.map(i=>vertices[i]);if(vs.some(v=>!v||Math.abs(v.relative)>VIEW_FOV/2+12)||Math.max(...vs.map(v=>v.x))-Math.min(...vs.map(v=>v.x))>w*.8)continue;
   triangles.push({vs,distance:vs.reduce((s,v)=>s+v.distance,0)/3,direct:ids.reduce((s,i)=>s+brightness[i],0)/3});
  }
  triangles.sort((a,b)=>b.distance-a.distance);
  const spectral=document.getElementById('spectralEnabled')?.checked,ozone=Number(document.getElementById('ozoneDU')?.value)||300,illumination=spectral&&typeof SpectralSky!=='undefined'?SpectralSky.cloudLight(sun.alt,result.terrain.observer_m,Number(document.getElementById('candidateAod')?.value)||.12,{ozoneDU:ozone}):null;
  const daylight=Math.max(0,Math.min(1,(sun.alt+6)/12)),warm=Math.exp(-Math.pow((sun.alt-1)/8,2)),directColor=illumination&&Math.max(...illumination)>0?illumination.map(v=>v/Math.max(...illumination)):[1,1-.35*warm,1-.65*warm],ambient=[.12,.17,.24].map(v=>v*(.04+.96*daylight));
  ctx.save();ctx.beginPath();ctx.moveTo(0,h);for(let x=0;x<=w;x+=3){const az=((focus+(x-w/2)/scale)%360+360)%360,idx=az/360*result.terrain.horizon.length,j=Math.floor(idx),alt=result.terrain.horizon[j]+(result.terrain.horizon[(j+1)%result.terrain.horizon.length]-result.terrain.horizon[j])*(idx-j);ctx.lineTo(x,base-alt*scale);}ctx.lineTo(w,h);ctx.closePath();ctx.clip();
  for(const t of triangles){const haze=1-Math.exp(-t.distance/32000),lit=t.direct*Math.max(0,Math.min(1,(sun.alt+3)/6)),color=directColor.map((v,i)=>Math.round(255*((ambient[i]+v*lit*.45)*(1-haze)+[.23,.29,.34][i]*daylight*haze)));
   ctx.fillStyle='rgb('+color.join(',')+')';ctx.beginPath();t.vs.forEach((v,i)=>i?ctx.lineTo(v.x,Math.max(-h*3,Math.min(h*4,v.y))):ctx.moveTo(v.x,Math.max(-h*3,Math.min(h*4,v.y))));ctx.closePath();ctx.fill();
  }ctx.restore();target.drawImage(surface,0,0,w,h);
 }
 return {render};
})();
