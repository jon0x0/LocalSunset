/* Terrain-only cache removal, with a measured payload estimate and confirmation. */
(function(){
 const el=id=>document.getElementById(id),scope=el('cacheScope'),section=scope.closest('details'),clear=el('clearCache'),browserEdition=document.body.dataset.browserEdition==='true';
 if(browserEdition){scope.value='browser';scope.hidden=true;document.querySelector('label[for="cacheScope"]').hidden=true;}
 // Keep cache maintenance with terrain controls, rather than saved-place actions.
 el('source').closest('details').append(section);
 const dialog=document.createElement('dialog');dialog.className='terrain-cache-confirm';dialog.setAttribute('aria-labelledby','terrainCacheConfirmTitle');
 const title=document.createElement('h2');title.id='terrainCacheConfirmTitle';title.textContent='Clear terrain cache';
 const question=document.createElement('p');question.textContent='Delete locally cached terrain data, are you sure?';
 const amount=document.createElement('strong'),detail=document.createElement('p'),message=document.createElement('p'),actions=document.createElement('div');message.setAttribute('role','status');actions.className='cache-confirm-actions';
 const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';cancel.onclick=()=>dialog.close();
 const confirm=document.createElement('button');confirm.type='button';confirm.textContent='Delete terrain cache';actions.append(cancel,confirm);dialog.append(title,question,amount,detail,message,actions);document.body.append(dialog);
 let selected='browser',estimate=0;
 const localBusy=()=>typeof calculationPending!=='undefined'&&calculationPending||typeof TerrainLighting!=='undefined'&&TerrainLighting.cacheBusy||typeof TerrainOption!=='undefined'&&TerrainOption.cacheBusy;
 async function server(method='GET'){const response=await fetch('/api/cache',{method}),state=await response.json();if(!response.ok)throw Error(state.error||'Cannot access terrain cache.');return state;}
 async function measure(target){
  let files=0,bytes=0,busy=!!localBusy();
  if(browserEdition){const state=await server();files+=state.files;bytes+=state.bytes;busy||=state.busy;}
  else {
   if(target!=='browser'){const state=await server();files+=state.files;bytes+=state.bytes;busy||=state.busy;}
   if(target!=='server'&&typeof WebCache!=='undefined'){const state=await WebCache.terrainStats();files+=state.files;bytes+=state.bytes;}
  }
  if(target!=='server'&&typeof terrainSceneCache==='function'){const state=terrainSceneCache();files+=state.files;bytes+=state.bytes;}
  return {files,bytes,busy};
 }
 const megabytes=bytes=>(bytes/1048576).toFixed(2);
 async function stats(){try{const state=await measure(scope.value);el('cacheStatus').textContent=megabytes(state.bytes)+' MB terrain payload cached ('+state.files+' entries).'+(state.busy?' Terrain work is running.':'');}catch(error){el('cacheStatus').textContent=error.message;}}
 section.addEventListener('toggle',()=>{if(section.open)stats();});scope.onchange=stats;
 clear.textContent='Clear terrain cache';
 clear.onclick=async()=>{
  clear.disabled=true;
  try{
   selected=browserEdition?'browser':scope.value;const state=await measure(selected);
   if(state.busy)throw Error('Terrain work is running. Wait for it to finish before clearing the cache.');
   estimate=state.bytes;amount.textContent='Approximately '+megabytes(estimate)+' MB will be freed.';
   const where=selected==='both'?'This browser and the device/server':selected==='browser'?'This browser':'The device/server';
   detail.textContent=where+' · '+state.files+' terrain entries. Removes terrain tiles, lighting meshes, traced horizons and derived calculations. Saved places, projector settings, weather and satellite data are kept. The current image stays visible; terrain is rebuilt when needed. Size is an estimated payload, excluding storage overhead.';
   message.textContent=state.files?'':'No cached terrain data to delete.';confirm.disabled=!state.files;dialog.showModal();cancel.focus();
  }catch(error){el('cacheStatus').textContent=error.message;}
  finally{clear.disabled=false;}
 };
 confirm.onclick=async()=>{
  confirm.disabled=true;cancel.disabled=true;let completed=[];
  try{
   const state=await measure(selected);if(state.busy)throw Error('Terrain work started. Wait for it to finish and try again.');
   if(browserEdition){await server('DELETE');completed.push('Browser terrain cache');}
   else {
    if(selected!=='browser'){await server('DELETE');completed.push('Device/server terrain cache');}
    if(selected!=='server'&&typeof WebCache!=='undefined'){await WebCache.clearTerrain();completed.push('Browser terrain cache');}
   }
   if(selected!=='server'&&typeof terrainSceneCache==='function')terrainSceneCache(true);
   dialog.close();el('cacheStatus').textContent='Terrain cache cleared (about '+megabytes(estimate)+' MB). Current view retained; saved places and settings unchanged. Apply location to rebuild terrain.';
  }catch(error){message.textContent=(completed.length?completed.join(' and ')+' cleared. ':'')+error.message;}
  finally{confirm.disabled=false;cancel.disabled=false;}
 };
})();
