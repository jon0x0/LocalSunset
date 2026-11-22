import * as WebGLTHREE from '../../web/vendor/three.module.js';
let THREE=WebGLTHREE,TSL=null,backendName='Starting GPU';
const $=id=>document.getElementById(id),G=GPUTerrainGeometry,D=Math.PI/180;
// Display calibration for a normalized spectral source (not lux). Raise only
// direct illumination so shaded hills retain their sky-fill brightness.
// Visual reference: Nov 22 2026, 07:10 America/Denver, heading ~317°.
// Snow/vegetation are not modeled; these are bare-earth display parameters.
const DIRECT_SUN_STRENGTH=24;
const embedded=new URLSearchParams(location.search).get('embedded')==='1';let initialSceneResolve;
function tellParent(type,extra={}){if(embedded)parent.postMessage({type,...extra},location.origin);}
function cameraChanged(commit=false){cameraPending={heading,fov,revision:++viewRevision,commit};if(commit)flushCamera();}
function timeChanged(commit=false){timePending={time,commit,revision:++timeRevision};if(commit)flushTime();}
function flushTime(){if(timePending){tellParent('localsunset-gpu-time',timePending);timePending=null;}}
function flushCamera(){if(cameraPending){tellParent('localsunset-gpu-camera',cameraPending);cameraPending=null;}}
let state,renderer,scene,camera,sun,ambient,terrain,baseMesh,detailMesh,heading=270,pitch=3,fov=75,time=Date.now(),anchor=time,live=false,worker=null,dirty=true,lost=false,paused=false,lastSecond=-1,lastSolar='',preparing=false,buildGeneration=0,frameMs=0,submittedFrames=0,slowFrames=0,adapterName='Unknown adapter',demClearance=null,viewportKey='',projectionKey='',lastImageKey='',drag=null,viewRevision=0,timeRevision=0,cameraPending=null,timePending=null,lastDrawAt=0,lastInputAt=-Infinity,shadowRefreshPending=false;
function fail(error){$('error').textContent=error.message||String(error);}
function rejectGPU(error){fail(error);tellParent('localsunset-gpu-failed',{error:error.message||String(error)});}
function geometry(mesh,observer){const b=G.buffers(mesh,observer),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(b.positions,3));g.setIndex(new THREE.BufferAttribute(b.indices,1));g.setAttribute('terrainSun',new THREE.BufferAttribute(new Float32Array(b.positions.length).fill(1),3));g.computeVertexNormals();g.computeBoundingSphere();return g;}
function terrainMaterial(options){
 if(backendName==='WebGPU'&&TSL){
  class ElevationMaterial extends THREE.MeshStandardNodeMaterial{setupLightingModel(builder){const model=super.setupLightingModel(builder),direct=model.direct.bind(model);model.direct=(input,b)=>direct({...input,lightColor:input.lightColor.mul(TSL.attribute('terrainSun','vec3'))},b);return model;}}
  return new ElevationMaterial(options);
 }
 const material=new THREE.MeshStandardMaterial(options);
 material.onBeforeCompile=shader=>{shader.vertexShader='attribute vec3 terrainSun; varying vec3 vTerrainSun;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTerrainSun=terrainSun;');shader.fragmentShader='varying vec3 vTerrainSun;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.directDiffuse *= vTerrainSun;\nreflectedLight.directSpecular *= vTerrainSun;');};
 material.customProgramCacheKey=()=> 'terrain-elevation-light-v1';return material;
}
function updateTerrainLight(s){
 const aod=state.sky?.candidateAod??.12,options={ozoneDU:state.sky?.spectralEnabled===false?0:state.sky?.ozoneDU??300};
 if(terrain){const p=terrain.geometry.attributes.position,out=terrain.geometry.attributes.terrainSun,cache=new Map(),az=s.az*D;
  for(let i=0;i<p.count;i++){const east=p.getX(i),north=-p.getZ(i),height=p.getY(i)+state.observer+(east*east+north*north)/(2*6371008.8),alt=s.alt+(east*Math.sin(az)+north*Math.cos(az))/6371008.8/D;
   // Interpolate the small spectral lookup table; do not quantize the visible
   // light into elevation bands or produce steps as simulation time advances.
   const h=Math.floor(height/100)*100,a=Math.floor(alt*4)/4,u=(height-h)/100,v=(alt-a)*4,rgb=[0,0,0];
   for(const dh of [0,1])for(const da of [0,1]){const H=h+dh*100,A=a+da*.25,key=H+'|'+A;let sample=cache.get(key);
    if(!sample){const raw=SpectralSky.directLight(A,H,aod,options),gain=G.sunStrength(raw);sample=raw.map(c=>c*gain);cache.set(key,sample);}
    const weight=(dh?u:1-u)*(da?v:1-v);for(let c=0;c<3;c++)rgb[c]+=sample[c]*weight;
   }out.setXYZ(i,...rgb);
  }out.needsUpdate=true;
 }
 const rgb=SpectralSky.skyIrradiance(s.alt,state.observer,aod,options),y=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2],gain=12/(1+12*y);
 ambient.color.setRGB(...rgb.map(v=>v*gain));ambient.groundColor.setRGB(...rgb.map((v,i)=>v*gain*[.22,.19,.14][i]));ambient.intensity=1;
}
function rebuild(){const mesh=G.combine(baseMesh,detailMesh);if(terrain){scene.remove(terrain);terrain.geometry.dispose();terrain.material.dispose();terrain.customDepthMaterial?.dispose();}
 const material=$('surface').value==='normals'?new THREE.MeshNormalMaterial({side:THREE.DoubleSide}):terrainMaterial({color:new THREE.Color().setRGB(.22,.19,.14),roughness:1,metalness:0,side:$('surface').value==='front'?THREE.FrontSide:THREE.DoubleSide,shadowSide:THREE.FrontSide});
 demClearance=state.observer-G.sample(mesh,0,0);
 terrain=new THREE.Mesh(geometry(mesh,state.observer),material);terrain.castShadow=true;terrain.receiveShadow=true;
 // Offset caster depth by its slope in light space, rather than relying only
 // on smooth vertex normals. This addresses diagonal self-shadow stripes on
 // a large, shallow-lit heightfield without modifying the DEM or visible mesh.
 if(backendName==='WebGL 2')terrain.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.FrontSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:4});
 scene.add(terrain);renderer.shadowMap.needsUpdate=true;if(sun)sun.shadow.needsUpdate=true;dirty=true;
 lastSolar='';const generation=++buildGeneration;preparing=true;tellParent('localsunset-gpu-status',{message:'Preparing GPU shaders; location controls remain available.'});Promise.resolve(renderer.compileAsync(scene,camera)).then(()=>{if(generation===buildGeneration){preparing=false;dirty=true;}}).catch(e=>{preparing=false;rejectGPU(e);});
 $('status').textContent=`${backendName} · ${mesh.size.toLocaleString()} × ${mesh.size.toLocaleString()} terrain vertices · ${detailMesh?'50 m near patch + wider blocking terrain':'125 m near / 690 m outer mesh'} · ${mesh.source}. Camera ${demClearance.toFixed(1)} m above DEM at observer${demClearance<0?' — WARNING: observer is below sampled ground; verify ground elevation / load finer terrain':''}. Shadow edge resolution is approximately ${G.shadowSettings(sun.shadow.mapSize.x,sun.shadow.camera.right-sun.shadow.camera.left,sun.shadow.camera.top-sun.shadow.camera.bottom).texel.toFixed(0)} m; this experimental map cannot resolve a metre-scale sunline. Finite-solar-disk tracing is not implemented.`;tellParent('localsunset-gpu-status',{message:$('status').textContent});
}
function loadMesh(detail=false){if(worker)return;const button=$('detail');button.disabled=true;const previous=$('status').textContent;$('status').textContent=detail?'Loading finer elevations; existing terrain stays visible…':'Loading cached terrain or elevation tiles…';
 worker=new Worker('candidate/terrain-worker.js');worker.onmessage=({data:r})=>{
  if(r.status==='running'){$('status').textContent=r.message;tellParent('localsunset-gpu-status',{message:r.message});return;}
  worker.terminate();worker=null;button.disabled=!!detailMesh;
  if(r.status!=='mesh'){fail(Error(r.error||'Terrain unavailable'));$('status').textContent=previous;return;}
  if(detail)detailMesh=r.mesh;else baseMesh=r.mesh;try{rebuild();}catch(e){fail(e);}
 };
 worker.onerror=e=>{worker.terminate();worker=null;button.disabled=false;fail(Error(e.message||'Terrain worker failed'));};
 worker.postMessage({kind:'mesh',id:1,input:{...state.input,quality:detail?'gpu-detail':'default'}});
}
function solar(t){const observer=new Astronomy.Observer(state.input.lat,state.input.lon,state.observer),equ=Astronomy.Equator('Sun',new Date(t),observer,true,true),hor=Astronomy.Horizon(new Date(t),observer,equ.ra,equ.dec,'normal');return {alt:hor.altitude,az:hor.azimuth};}
function sky(s){const encode=v=>Math.round(255*Math.pow(Math.max(0,v)/(1+Math.max(0,v)),1/2.2)),top=SpectralSky.radiance(45,90,s.alt,state.sky?.candidateAod??.12,state.observer),horizon=SpectralSky.radiance(2,heading-s.az,s.alt,state.sky?.candidateAod??.12,state.observer);$('viewport').style.background=`linear-gradient(rgb(${top.map(encode)}),rgb(${horizon.map(encode)}))`;}
function resize(){const box=$('viewport').getBoundingClientRect(),size=[Math.round(box.width),Math.round(box.height)].join('|'),projection=[size,fov].join('|');if(size===viewportKey&&projection===projectionKey)return;
 if(size!==viewportKey){viewportKey=size;renderer.setSize(box.width,box.height,false);}
 camera.aspect=box.width/box.height;camera.fov=2*Math.atan(Math.tan(fov*D/2)*box.height/box.width)/D;camera.updateProjectionMatrix();projectionKey=projection;dirty=true;
}
// Focus light-space XY on nearby receivers. Distant eastern/western ridges
// still participate as casters: their depth range and geometry are retained.
function fitShadow(){
 if(!terrain)return;
 sun.shadow.updateMatrices(sun);
 const c=sun.shadow.camera,p=terrain.geometry.attributes.position,v=new THREE.Vector3();
 let left=Infinity,right=-Infinity,bottom=Infinity,top=-Infinity;
 for(let i=0;i<p.count;i++){if(Math.hypot(p.getX(i),p.getZ(i))>8000)continue;
  v.fromBufferAttribute(p,i).applyMatrix4(c.matrixWorldInverse);
  left=Math.min(left,v.x);right=Math.max(right,v.x);bottom=Math.min(bottom,v.y);top=Math.max(top,v.y);
 }
 if(!Number.isFinite(left))return;
 const width=Math.max(1000,right-left+400),height=Math.max(1000,top-bottom+400),size=sun.shadow.mapSize.x;
 const x=Math.round((left+right)/2/(width/size))*(width/size),y=Math.round((bottom+top)/2/(height/size))*(height/size);
 Object.assign(c,{left:x-width/2,right:x+width/2,bottom:y-height/2,top:y+height/2});c.updateProjectionMatrix();
 Object.assign(sun.shadow,G.shadowSettings(size,width,height));
}
function update(){const s=solar(time),direction=G.sunDirection(s.alt,s.az),key=[Math.round(s.alt*100),Math.round(s.az*100),$('shadows').checked,state.sky?.spectralEnabled,state.sky?.candidateAod,state.sky?.ozoneDU,state.sky?.terrainLightingEnabled].join('|');
 camera.lookAt(...G.sunDirection(pitch,heading));
 const interacting=!!drag||performance.now()-lastInputAt<180;
 if(lastSolar!==key){lastSolar=key;shadowRefreshPending=true;sun.position.set(...direction.map(v=>v*100000));updateTerrainLight(s);sun.color.setRGB(1,1,1);sun.intensity=state.sky?.terrainLightingEnabled===false?0:1;sun.castShadow=$('shadows').checked;sky(s);}
 let shadowsUpdated=false;if(shadowRefreshPending&&!interacting){fitShadow();renderer.shadowMap.needsUpdate=true;sun.shadow.needsUpdate=true;shadowRefreshPending=false;shadowsUpdated=true;}
 const imageKey=[key,heading,pitch,fov,viewportKey,buildGeneration,$('quality').value,shadowsUpdated].join('|');
 if(imageKey!==lastImageKey||shadowsUpdated){const start=performance.now();renderer.render(scene,camera);frameMs=performance.now()-start;submittedFrames++;slowFrames=frameMs>500?slowFrames+1:0;lastImageKey=imageKey;}
 $('overlay').textContent=`${live?'Realtime':'Preview'} · ${new Date(time).toLocaleString([],{timeZone:state.zone})} · ${state.zone}\nHeading ${heading.toFixed(1)}° · Sun ${s.alt.toFixed(3)}° / ${s.az.toFixed(2)}°\n${backendName} · GPU shadow maps ${sun.shadow.mapSize.x}² · ${renderer.info.render.triangles.toLocaleString()} drawn triangles\nCPU submission ${frameMs.toFixed(1)} ms (not GPU timing)\n${adapterName}\nCamera ${demClearance===null?'…':demClearance.toFixed(1)+' m above sampled DEM'}${demClearance!==null&&demClearance<0?' — observer below DEM; check elevation':''}`;
 if(submittedFrames>2&&slowFrames>=3&&embedded){rejectGPU(Error('Frame submission exceeded 500 ms; keeping the Standard view responsive.'));}
 if(frameMs>500&&live&&!embedded){live=false;fail(Error('Slow frame submission; realtime paused to keep this experiment responsive. Try a smaller shadow map or a hardware-accelerated browser.'));}
 $('live').setAttribute('aria-pressed',String(live));dirty=false;
}
async function start(){
 if(embedded){state=await new Promise(resolve=>{initialSceneResolve=resolve;tellParent('localsunset-gpu-ready');});}
 if(!state)try{state=JSON.parse(sessionStorage.getItem('localsunset.gpu-preview.v1')||'null');}catch(e){}
 if(!state){const fixture=await (await fetch('terrain-80228.json')).json();state={input:{lat:fixture.lat,lon:fixture.lon,height:fixture.height,zoom:10,source:'auto'},observer:fixture.terrain.observer_m,zone:'America/Denver',time:Date.now(),heading:270,fov:75,live:true};}
 heading=state.heading??270;fov=state.fov??75;time=anchor=state.time;live=!!state.live;viewRevision=state.gpuCameraRevision||0;timeRevision=state.gpuTimeRevision||0;$('shadows').checked=state.gpuDiagnostic!=='unshadowed'&&state.sky?.terrainCastShadows!==false;$('surface').value=state.gpuDiagnostic==='normals'?'normals':'solid';
 const chosen=await TerrainGPUContext.createRenderer({document,navigator,secure:isSecureContext,webGL:WebGLTHREE,loadWebGPU:()=>import('../../web/vendor/three.webgpu.js')});renderer=chosen.renderer;THREE=chosen.engine;if(chosen.api==='WebGPU')TSL=await import('../../web/vendor/three.tsl.js');backendName=chosen.api;renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
 $('viewport').prepend(renderer.domElement);renderer.domElement.style.touchAction=embedded&&state.gesture==='time'?'pan-y':'none';scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(60,1,5,80000);camera.position.set(0,0,0);
 ambient=new THREE.HemisphereLight(0xa7c6ed,0x292b29,.4);scene.add(ambient);sun=new THREE.DirectionalLight(0xffffff,DIRECT_SUN_STRENGTH);sun.castShadow=true;sun.shadow.autoUpdate=false;sun.target.position.set(0,0,0);scene.add(sun,sun.target);
 const cameraShadow=sun.shadow.camera;Object.assign(cameraShadow,{left:-44000,right:44000,top:44000,bottom:-44000,near:1000,far:200000});cameraShadow.updateProjectionMatrix();Object.assign(sun.shadow,G.shadowSettings(1024));
 let software=false;
 if(backendName==='WebGL 2'){const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');adapterName=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);software=/swiftshader|llvmpipe|software/i.test(adapterName);}
 else {const info=renderer.backend.device?.adapterInfo;adapterName=info?.description||'WebGPU adapter selected by the browser';software=info?.isFallbackAdapter===true;renderer.backend.device?.lost.then(info=>{if(!lost){lost=true;rejectGPU(Error('WebGPU device lost: '+info.message));}});}
 const coarse=matchMedia('(pointer:coarse)').matches;$('quality').value=software?'512':String(state.gpuShadowSize||1024);
 if(software){live=false;fail(Error('Software graphics adapter detected; reduced shadow resolution.'));}
 if(software&&embedded){rejectGPU(Error('Only software graphics is available; use a hardware-accelerated browser for GPU 3D.'));lost=true;return;}
 quality();resize();new ResizeObserver(resize).observe($('viewport'));
 renderer.domElement.addEventListener('webglcontextlost',e=>{if(lost)return;e.preventDefault();lost=true;rejectGPU(Error('GPU context lost. Reload this experiment; the main simulator is unaffected.'));});
 renderer.domElement.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,heading,pitch,time,active:false,mode:embedded?(state.gesture||'pan'):'pan'};lastInputAt=performance.now();renderer.domElement.setPointerCapture(e.pointerId);});
 renderer.domElement.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.active){if(Math.max(Math.abs(dx),Math.abs(dy))<6)return;if(drag.mode==='time'&&Math.abs(dy)>Math.abs(dx)){drag=null;return;}drag.active=true;}lastInputAt=performance.now();if(drag.mode==='time'){live=false;time=drag.time-dx/Math.max(1,renderer.domElement.clientWidth)*7200000;timeChanged();}else{heading=(drag.heading-dx*fov/renderer.domElement.clientWidth+360)%360;pitch=Math.max(-40,Math.min(70,drag.pitch+dy*.1));cameraChanged();}dirty=true;});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(name,()=>{if(!drag)return;const completed=drag;drag=null;lastInputAt=-Infinity;if(completed.active){if(completed.mode==='time')timeChanged(true);else cameraChanged(true);}dirty=true;});
 window.addEventListener('keydown',e=>{if(e.target.matches('input,select,button'))return;if(e.key==='ArrowLeft')heading=(heading+355)%360;else if(e.key==='ArrowRight')heading=(heading+5)%360;else if(e.key==='+')fov=Math.max(30,fov-5);else if(e.key==='-')fov=Math.min(120,fov+5);else return;e.preventDefault();resize();dirty=true;cameraChanged();});
 renderer.domElement.addEventListener('wheel',e=>{if(embedded&&state.gesture==='time'){e.preventDefault();live=false;time+=Math.sign(e.deltaY)*15000;timeChanged(true);lastInputAt=performance.now();dirty=true;}},{passive:false});
 loadMesh();
 function frame(){if(lost)return;requestAnimationFrame(frame);if(document.hidden||preparing||paused||performance.now()-lastDrawAt<33)return;lastDrawAt=performance.now();flushCamera();flushTime();if(shadowRefreshPending&&!drag&&performance.now()-lastInputAt>=180)dirty=true;const second=Math.floor(Date.now()/1000);if(live&&second!==lastSecond){lastSecond=second;time=Date.now();dirty=true;}if(dirty)try{update();}catch(e){lost=true;fail(e);}}
 requestAnimationFrame(frame);
}
function quality(){if(!renderer)return;const size=Math.min(Number($('quality').value),(renderer.capabilities?.maxTextureSize||renderer.backend?.device?.limits.maxTextureDimension2D||2048));sun.shadow.mapSize.set(size,size);Object.assign(sun.shadow,G.shadowSettings(size));sun.shadow.map?.dispose();sun.shadow.map=null;renderer.shadowMap.needsUpdate=true;if(sun)sun.shadow.needsUpdate=true;dirty=true;}
$('surface').onchange=()=>{if(baseMesh)rebuild();};$('quality').onchange=quality;$('shadows').onchange=()=>{lastSolar='';dirty=true;};$('detail').onclick=()=>loadMesh(true);
$('live').onclick=()=>{live=!live;if(live){time=anchor=Date.now();$('time').value=0;}dirty=true;};
function shift(minutes){live=false;time+=minutes*60000;anchor=time;$('time').value=0;dirty=true;}
$('back').onclick=()=>shift(-1);$('forward').onclick=()=>shift(1);$('time').oninput=()=>{live=false;time=anchor+Number($('time').value)*60000;dirty=true;};
$('sun').onclick=()=>{heading=solar(time).az;dirty=true;cameraChanged();};$('opposite').onclick=()=>{heading=(solar(time).az+180)%360;dirty=true;cameraChanged();};
window.addEventListener('message',event=>{
 if(!embedded||event.origin!==location.origin||event.source!==parent)return;
 if(event.data?.type==='localsunset-gpu-pause'){paused=true;return;}
 if(event.data?.type==='localsunset-gpu-resume'){paused=false;dirty=true;return;}
 if(event.data?.type==='localsunset-gpu-stop'){dispose();return;}
 if(event.data?.type==='localsunset-gpu-detail'){if(renderer&&baseMesh&&!detailMesh)loadMesh(true);return;}
 if(event.data?.type!=='localsunset-gpu-scene')return;
 const next=event.data.state;if(!next||!Number.isFinite(next.input?.lat)||!Number.isFinite(next.input?.lon)||!Number.isFinite(next.observer)||!Number.isFinite(next.time)||!Number.isFinite(next.heading)||!Number.isFinite(next.fov))return;
 if(initialSceneResolve){const resolve=initialSceneResolve;initialSceneResolve=null;resolve(next);return;}
 if(!renderer||!state)return;
 const identity=s=>JSON.stringify([s.input.lat,s.input.lon,s.input.zoom,s.input.source]),changed=identity(state)!==identity(next),observerChanged=state.observer!==next.observer;
 const acceptCamera=!drag&&(next.gpuCameraRevision??0)>=viewRevision;if(!drag&&time!==next.time&&!next.live)lastInputAt=performance.now();state=next;renderer.domElement.style.touchAction=next.gesture==='time'?'pan-y':'none';if((!drag||drag.mode!=='time')&&(next.gpuTimeRevision??0)>=timeRevision){time=next.time;live=!!next.live;}if(acceptCamera){heading=next.heading;fov=next.fov;}$('shadows').checked=next.gpuDiagnostic!=='unshadowed'&&next.sky?.terrainCastShadows!==false;const surface=next.gpuDiagnostic==='normals'?'normals':'solid',surfaceChanged=$('surface').value!==surface;$('surface').value=surface;
 if(changed){if(worker)worker.terminate();worker=null;baseMesh=detailMesh=null;if(terrain){scene.remove(terrain);terrain.geometry.dispose();terrain.material.dispose();terrain.customDepthMaterial?.dispose();terrain=null;}loadMesh();}
 else if((observerChanged||surfaceChanged)&&baseMesh)rebuild();if([512,1024,2048,4096].includes(next.gpuShadowSize)&&Number($('quality').value)!==next.gpuShadowSize){$('quality').value=String(next.gpuShadowSize);quality();}resize();dirty=true;
});
function dispose(){lost=true;if(worker)worker.terminate();if(renderer){renderer.dispose();renderer.forceContextLoss?.();}if(terrain){terrain.geometry.dispose();terrain.material.dispose();terrain.customDepthMaterial?.dispose();}}
window.addEventListener('pagehide',dispose);
window.addEventListener('pageshow',event=>{if(event.persisted&&lost)location.reload();});
start().catch(e=>{rejectGPU(e);$('overlay').textContent='GPU renderer unavailable on this browser. The main simulator is unchanged.';});
