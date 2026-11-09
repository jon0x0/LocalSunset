// Map the entire projector viewport to four independently inset corners.
function projectorMatrix(corners,width,height){
 const names=['tl','tr','br','bl'],src=[[0,0],[1,0],[1,1],[0,1]];
 const dst=names.map((name,i)=>{const p=corners[name];return [i===1||i===2?1-p.x/100:p.x/100,i>=2?1-p.y/100:p.y/100];});
 const rows=[];
 src.forEach(([x,y],i)=>{const [u,v]=dst[i];rows.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]);});
 for(let col=0;col<8;col++){
  let pivot=col;for(let row=col+1;row<8;row++)if(Math.abs(rows[row][col])>Math.abs(rows[pivot][col]))pivot=row;
  [rows[col],rows[pivot]]=[rows[pivot],rows[col]];
  const factor=rows[col][col];if(Math.abs(factor)<1e-10)throw Error('Invalid corner geometry');
  for(let j=col;j<=8;j++)rows[col][j]/=factor;
  for(let row=0;row<8;row++)if(row!==col){const f=rows[row][col];for(let j=col;j<=8;j++)rows[row][j]-=f*rows[col][j];}
 }
 const [a,b,c,d,e,f,g,h]=rows.map(row=>row[8]);
 return [a,d*height/width,0,g/width,b*width/height,e,0,h/height,0,0,1,0,c*width,f*height,0,1];
}
// Symmetric taper adds exactly the same inset to both ends of an edge.
function projectorTaper(base,vertical,horizontal){
 const c=JSON.parse(JSON.stringify(base));
 function pair(names,axis,amount){const change=Math.min(amount,...names.map(name=>25-c[name][axis]));for(const name of names)c[name][axis]+=change;}
 pair(vertical>=0?['tl','tr']:['bl','br'],'x',Math.abs(vertical));
 pair(horizontal>=0?['tl','bl']:['tr','br'],'y',Math.abs(horizontal));
 return c;
}
(function(){
 const names=['tl','tr','br','bl'];let settings=null,revision=-1,timer=null,saving=false,dirty=false,commitPending=false,commitTimer=null,pollPending=false,lastSent=0,pendingAction='update',pairBase=null,editGeneration=0,streamConnected=false;
 const el=id=>document.getElementById(id),main=document.querySelector('main');
 const grid=document.createElement('div');grid.id='projectorAlignmentGrid';grid.setAttribute('aria-hidden','true');grid.innerHTML='<span>TOP LEFT</span><span>TOP RIGHT</span><span>BOTTOM LEFT</span><span>BOTTOM RIGHT</span>';main.append(grid);
 function apply(value){
  settings=value;setFieldOfView(value.fov===undefined?75:value.fov);
  const projected=document.body.classList.contains('projector');
  main.style.transform=projected&&value.enabled?'matrix3d('+projectorMatrix(value.corners,window.innerWidth,window.innerHeight).join(',')+')':'';
  const preview=el('view').parentElement;
  preview.style.transformOrigin='0 0';
  preview.style.transform=!projected&&value.enabled?'matrix3d('+projectorMatrix(value.corners,preview.clientWidth,preview.clientHeight).join(',')+')':'';
  main.style.transformOrigin='0 0';grid.hidden=!(projected&&value.grid);
  try{localStorage.setItem('localsunset.calibration.v1',JSON.stringify(value));}catch(error){}
 }
 function read(){return {fov:Number(el('projectorFov').value),enabled:el('keystoneEnabled').checked,grid:el('keystoneGrid').checked,corners:Object.fromEntries(names.map(name=>[name,{x:Number(el('keystone_'+name+'_x').value),y:Number(el('keystone_'+name+'_y').value)}]))};}
 function resetPairs(){pairBase=read().corners;el('keystoneVertical').value=0;el('keystoneHorizontal').value=0;}
 function fill(value){
  el('projectorFov').value=value.fov===undefined?75:value.fov;
  el('keystoneEnabled').checked=value.enabled;el('keystoneGrid').checked=value.grid;
  for(const name of names)for(const axis of ['x','y'])el('keystone_'+name+'_'+axis).value=value.corners[name][axis];
  resetPairs();labels();
 }
 function labels(){for(const axis of ['Vertical','Horizontal'])el('keystone'+axis+'Value').textContent=Number(el('keystone'+axis).value).toFixed(1)+'%';el('projectorFovValue').textContent=el('projectorFov').value+'\u00b0';for(const name of names)for(const axis of ['x','y']){const id='keystone_'+name+'_'+axis;el(id+'_value').textContent=Number(el(id).value).toFixed(1)+'%';}}
 function schedule(){if(!timer&&!saving)timer=setTimeout(()=>{timer=null;save();},Math.max(0,16-(Date.now()-lastSent)));}
 async function save(){
  if(saving||(!dirty&&!commitPending))return;
  saving=true;dirty=false;lastSent=Date.now();const persist=commitPending;commitPending=false;
  const action=pendingAction;pendingAction='update';const value={...read(),preview:!persist,action};
  try{const response=await fetch('/api/projector-calibration',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});const state=await response.json();if(!response.ok)throw Error(state.error);revision=state.revision;el('keystoneRestoreDefault').disabled=!state.default;if(action==='restore_default'){fill(state);apply(state);}el('keystoneStatus').textContent=action==='save_default'?'Default alignment saved.':action==='restore_default'?'Default alignment restored.':persist?'Alignment and field of view saved.':'Live adjustment sent to projector.';}
  catch(error){el('keystoneStatus').textContent='Alignment not saved: '+error.message;}
  finally{saving=false;if(dirty||commitPending)schedule();}
 }
 function commit(){clearTimeout(commitTimer);commitPending=true;schedule();}
 function changed(){editGeneration++;labels();apply(read());dirty=true;el('keystoneStatus').textContent='Adjusting live...';schedule();clearTimeout(commitTimer);commitTimer=setTimeout(commit,350);}
 for(const name of names)for(const axis of ['x','y']){const slider=el('keystone_'+name+'_'+axis);slider.addEventListener('input',()=>{resetPairs();changed();});slider.addEventListener('change',commit);}
 for(const axis of ['Vertical','Horizontal']){const slider=el('keystone'+axis);slider.addEventListener('input',()=>{
  if(!pairBase)pairBase=read().corners;
  const corners=projectorTaper(pairBase,Number(el('keystoneVertical').value),Number(el('keystoneHorizontal').value));
  for(const name of names)for(const coordinate of ['x','y'])el('keystone_'+name+'_'+coordinate).value=corners[name][coordinate];
  changed();
 });slider.addEventListener('change',commit);}
 function defaultAction(action){clearTimeout(commitTimer);pendingAction=action;commitPending=true;schedule();}
 el('keystoneSaveDefault').onclick=()=>defaultAction('save_default');
 el('keystoneRestoreDefault').onclick=()=>defaultAction('restore_default');
 el('projectorFov').addEventListener('input',changed);el('projectorFov').addEventListener('change',commit);
 el('keystoneEnabled').addEventListener('change',()=>{changed();commit();});el('keystoneGrid').addEventListener('change',()=>{changed();commit();});
 el('keystoneReset').onclick=()=>{fill({enabled:true,grid:false,fov:Number(el('projectorFov').value),corners:Object.fromEntries(names.map(name=>[name,{x:0,y:0}]))});changed();commit();};
 async function poll(initial=false){
  if(saving||dirty||commitPending||pollPending)return;pollPending=true;const generation=editGeneration;
  try{const response=await fetch('/api/projector-calibration');if(!response.ok)throw Error('Connection failed');const state=await response.json();
   if(generation!==editGeneration||saving||dirty||commitPending)return;
   if(state.revision!==revision){revision=state.revision;el('keystoneRestoreDefault').disabled=!state.default;apply(state);if(initial||!controllerPage)fill(state);}
   if(initial)el('keystoneStatus').textContent='Ready. Adjust corners; changes save automatically.';
  }catch(error){if(initial)el('keystoneStatus').textContent='Cannot load alignment: '+error.message;}finally{pollPending=false;}
 }
 try{const cached=JSON.parse(localStorage.getItem('localsunset.calibration.v1')||'null');if(cached)apply(cached);}catch(error){}
 new MutationObserver(()=>{if(settings)apply(settings);}).observe(document.body,{attributes:true,attributeFilter:['class']});
 window.addEventListener('resize',()=>{if(settings)apply(settings);});
 poll(true);
 if(!controllerPage&&typeof EventSource!=='undefined'){
  const stream=new EventSource('/api/projector-calibration/events');
  stream.onopen=()=>{streamConnected=true;};stream.onerror=()=>{streamConnected=false;};
  stream.onmessage=event=>{try{const state=JSON.parse(event.data);if(state.revision!==revision&&!saving&&!dirty&&!commitPending){revision=state.revision;apply(state);fill(state);}}catch(error){streamConnected=false;}};
  window.addEventListener('pagehide',()=>{streamConnected=false;stream.close();});
 }
 setInterval(()=>{if(controllerPage||!streamConnected)poll();},500);
})();
