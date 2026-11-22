/* Device-local renderer selection; the simulator remains the shared scene controller. */
const RenderMode=(()=>{
 const key='localsunset.atmosphere.candidate.renderMode',script=document.currentScript.src,scene=document.querySelector('.scene');
 const label=document.createElement('label');label.className='render-mode-control';label.textContent='View ';const select=document.createElement('select');select.id='renderMode';select.setAttribute('aria-label','Rendering mode');
 for(const [value,text] of [['standard','Standard'],['gpu','GPU 3D · experimental']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}label.append(select);document.querySelector('.quick-controls').prepend(label);
 const detail=document.createElement('button');detail.type='button';detail.id='gpuTerrainDetail';detail.textContent='Load finer GPU terrain';detail.hidden=true;label.after(detail);detail.onclick=()=>{if(frame&&ready)frame.contentWindow.postMessage({type:'localsunset-gpu-detail'},location.origin);};
 const direct=document.createElement('button');direct.type='button';direct.id='gpuDirectView';direct.textContent='Open GPU directly';direct.title='Test the same location and time in a separate tab, without an embedded frame';label.after(direct);direct.onclick=()=>{const state=snapshot();if(!state){note.textContent='Apply a location first, then open the GPU view.';return;}try{sessionStorage.setItem('localsunset.gpu-preview.v1',JSON.stringify(state));}catch(e){}window.open(new URL('gpu-terrain.html',script).href,'_blank');};
 const qualityLabel=document.createElement('label');qualityLabel.className='render-mode-control';qualityLabel.textContent='GPU quality ';const quality=document.createElement('select');quality.setAttribute('aria-label','GPU quality');for(const [value,text] of [['512','Fast'],['1024','Balanced'],['2048','Detailed'],['4096','Highest']]){const option=document.createElement('option');option.value=value;option.textContent=text;quality.append(option);}quality.value='4096';try{const saved=localStorage.getItem(key+'.quality');if(['512','1024','2048','4096'].includes(saved))quality.value=saved;}catch(e){}qualityLabel.append(quality);label.after(qualityLabel);qualityLabel.hidden=true;quality.onchange=()=>{try{localStorage.setItem(key+'.quality',quality.value);}catch(e){}lastState='';sync();};
 const diagnosticLabel=document.createElement('label');diagnosticLabel.className='render-mode-control';diagnosticLabel.textContent='GPU surface ';const diagnostic=document.createElement('select');diagnostic.id='gpuSurfaceDiagnostic';diagnostic.setAttribute('aria-label','GPU surface diagnostic');for(const [value,text] of [['lit','Sun + shadows'],['unshadowed','Sun, no shadows'],['normals','Surface normals']]){const option=document.createElement('option');option.value=value;option.textContent=text;diagnostic.append(option);}diagnosticLabel.append(diagnostic);label.after(diagnosticLabel);diagnosticLabel.hidden=true;diagnostic.onchange=()=>{lastState='';sync();};
 const panel=document.createElement('details');panel.id='gpuSettings';panel.className='gpu-settings';const summary=document.createElement('summary');summary.textContent='GPU settings';panel.append(summary,qualityLabel,diagnosticLabel,detail,direct);label.after(panel);
 const note=document.createElement('small');note.id='renderModeStatus';note.setAttribute('role','status');panel.append(note);
 let mode='standard',frame=null,ready=false,lastState='',fallback='',lastCamera=null,frameTimer=null,edits=0,lastTimeRevision=0;
 function snapshot(){if(!result||!renderedKey)return null;return {input:JSON.parse(renderedKey),observer:result.terrain.observer_m,zone:result.timezone,time:realTimeView?Date.now():(typeof TimeScrubber!=='undefined'&&TimeScrubber.selected?TimeScrubber.selected():currentTime),live:realTimeView,heading:viewAzimuth,fov:VIEW_FOV,gpuCameraRevision:lastCamera?.revision||0,gpuTimeRevision:lastTimeRevision,gesture:$('candidateGesture')?.value||'pan',gpuShadowSize:Number(quality.value),gpuDiagnostic:diagnostic.value,sky:typeof captureSkyOptions==='function'?captureSkyOptions():{},weather:typeof CandidateAtmosphere!=='undefined'?CandidateAtmosphere.weatherAt(realTimeView?Date.now():currentTime):null};}
 function sync(){if(mode!=='gpu'||edits||!frame||!ready)return;const state=snapshot();if(!state)return;const key=JSON.stringify({...state,time:Math.round(state.time/1000)});if(key===lastState)return;lastState=key;frame.contentWindow.postMessage({type:'localsunset-gpu-scene',state},location.origin);}
 function set(value,persist=true){mode=value==='gpu'?'gpu':'standard';select.value=mode;document.body.dataset.renderMode=mode;
  if(persist){fallback='';try{localStorage.setItem(key,mode);}catch(e){}}
  detail.hidden=mode!=='gpu';qualityLabel.hidden=mode!=='gpu';diagnosticLabel.hidden=mode!=='gpu';
  if(mode==='gpu'&&!edits){
   note.textContent='GPU terrain + Sun shadows; experimental clear-sun comparison. Satellite clouds remain in Standard.';
   if(!frame){ready=false;frame=document.createElement('iframe');frame.className='gpu-scene-frame';frame.title='GPU 3D terrain view';frame.src=new URL('gpu-terrain.html?embedded=1',script).href;frame.addEventListener('load',()=>{lastState='';sync();});scene.prepend(frame);frameTimer=setTimeout(()=>{if(mode==='gpu'&&!ready){panel.open=true;fallback='GPU 3D did not start. Using Standard; reload to retry.';set('standard',false);}},30000);}
   frame.hidden=false;lastState='';frame.contentWindow.postMessage({type:'localsunset-gpu-resume'},location.origin);sync();
  }else{clearTimeout(frameTimer);if(frame){frame.contentWindow.postMessage({type:'localsunset-gpu-pause'},location.origin);frame.hidden=true;if(fallback){frame.contentWindow.postMessage({type:'localsunset-gpu-stop'},location.origin);frame.remove();frame=null;ready=false;}}lastState='';note.textContent=fallback||'';}
  if(typeof draw==='function')draw();
 }
 function beginEdit(){edits++;if(mode==='gpu'){document.body.dataset.renderMode='standard';if(frame){frame.contentWindow.postMessage({type:'localsunset-gpu-pause'},location.origin);frame.hidden=true;}clearTimeout(frameTimer);lastState='';note.textContent='GPU view paused while the location is being applied. Controls remain available.';}}
 function endEdit(){edits=Math.max(0,edits-1);if(!edits&&mode==='gpu')set('gpu',false);}
 select.onchange=()=>set(select.value);
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||!frame||event.source!==frame.contentWindow)return;
  const message=event.data;if(!message||typeof message!=='object')return;
  if(message.type==='localsunset-gpu-status')note.textContent='GPU 3D · '+String(message.message||'').slice(0,260)+' Clear-sun comparison; satellite clouds remain in Standard.';
  if(message.type==='localsunset-gpu-ready'){clearTimeout(frameTimer);ready=true;lastState='';sync();}
  if(message.type==='localsunset-gpu-failed'){panel.open=true;fallback='GPU 3D unavailable: '+String(message.error||'graphics context lost').slice(0,180)+' Using Standard.';set('standard',false);}
  if(message.type==='localsunset-gpu-time'&&Number.isFinite(message.time)){if(Number.isFinite(message.revision)&&message.revision<lastTimeRevision)return;lastTimeRevision=message.revision||0;if(typeof TimeScrubber!=='undefined'&&TimeScrubber.seek)TimeScrubber.seek(message.time,!!message.commit);else {playing=false;updatePlay();setTime(message.time);if(message.commit)persistView();}return;}
  if(message.type==='localsunset-gpu-camera'&&Number.isFinite(message.heading)&&Number.isFinite(message.fov)){
   if(Number.isFinite(message.revision)&&message.revision<(lastCamera?.revision||0))return;
   lastCamera={revision:message.revision||0,heading:(message.heading%360+360)%360,fov:Math.max(30,Math.min(120,message.fov))};
   viewAzimuth=lastCamera.heading;setFieldOfView(lastCamera.fov);if($('projectorFov'))$('projectorFov').value=lastCamera.fov;draw();if(message.commit)persistView();queueHDMI();sync();
  }
 });
 setInterval(sync,1000);document.addEventListener('change',()=>{lastState='';sync();});
 // Keep the unattended Pi projector on its proven low-power renderer.
 let saved=new URLSearchParams(location.search||'').get('auto')==='1'?'standard':'gpu';try{saved=localStorage.getItem(key)||saved;}catch(e){}queueMicrotask(()=>set(saved,false));
 return {sync,beginEdit,endEdit,get active(){return mode==='gpu'&&!edits;},get mode(){return mode;},set};
})();
