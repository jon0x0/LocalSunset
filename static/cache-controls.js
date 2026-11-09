(function(){
 const el=id=>document.getElementById(id);
 async function stats(){try{const response=await fetch('/api/cache');if(!response.ok)throw Error('Cannot read server cache');const state=await response.json();el('cacheStatus').textContent=state.files+' cached server files / '+(state.bytes/1048576).toFixed(1)+' MB'+(state.busy?' - calculation running.':'');}catch(error){el('cacheStatus').textContent=error.message;}}
 el('cacheScope').closest('details').addEventListener('toggle',event=>{if(event.target.open)stats();});
 el('clearCache').onclick=async()=>{
  const scope=el('cacheScope').value;el('clearCache').disabled=true;
  try{
   if(scope!=='browser'){const response=await fetch('/api/cache',{method:'DELETE'}),state=await response.json();if(!response.ok)throw Error(state.error);}
   if(scope!=='server')forgetBrowserCache();
   el('cacheStatus').textContent='Cache cleared. Current image retained; the next trace rebuilds the cache. Saved locations and defaults are unchanged.';
  }catch(error){el('cacheStatus').textContent=error.message;}
  finally{el('clearCache').disabled=false;}
 };
})();
