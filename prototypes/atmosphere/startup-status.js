/* Keep startup failures visible without clearing device settings or saved places. */
(()=>{
 let panel=null;
 function report(message){
  if(!document.body){document.addEventListener('DOMContentLoaded',()=>report(message),{once:true});return;}
  if(!panel){panel=document.createElement('div');panel.id='startupProblem';panel.setAttribute('role','alert');panel.style.cssText='position:fixed;top:8px;left:8px;right:8px;z-index:10000;padding:12px;background:#3a221beF;color:#fff1dc;border:1px solid #e4b587;border-radius:7px;font:13px/1.5 system-ui;display:flex;align-items:center;gap:12px;';const text=document.createElement('span');text.style.flex='1';panel.append(text);const reload=document.createElement('button');reload.textContent='Reload page';reload.style.cssText='padding:9px;font:inherit;cursor:pointer';reload.onclick=()=>location.reload();panel.append(reload);document.body.append(panel);}
  panel.firstChild.textContent=String(message).slice(0,350);
 }
 window.addEventListener('error',event=>{if(event.message)report('Page error: '+event.message);else if(event.target?.tagName==='SCRIPT')report('Could not load '+new URL(event.target.src,location.href).pathname.split('/').pop()+'. Reload to get the current version.');},true);
 window.addEventListener('unhandledrejection',event=>report('Page error: '+String(event.reason?.message||event.reason||'Startup did not complete')));
 setTimeout(()=>{const status=document.getElementById('skyDisplayStatus');if(!document.getElementById('renderMode')||!status||/^Loading/.test(status.textContent))report('The prediction has not finished starting. Reload the page to retry; saved places and settings will be retained.');},20000);
})();
