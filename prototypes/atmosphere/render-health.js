/* Pi-only render diagnostics, loaded before the app so startup errors are visible. */
(()=>{
 if(new URLSearchParams(location.search).get('auto')!=='1')return;
 const send=window.fetch.bind(window);let error='';
 window.addEventListener('error',e=>{error=String(e.message||'Script error').slice(0,220);});
 window.addEventListener('unhandledrejection',e=>{error=String(e.reason?.message||e.reason||'Promise rejected').slice(0,220);});
 function report(){
  try{
   const c=document.getElementById('view'),r=c?.getBoundingClientRect(),main=document.querySelector('main'),diag={hidden:document.hidden,atmosphere:document.getElementById('atmosphereEnabled')?.checked,classes:document.body?.className,rect:r?{x:r.x,y:r.y,w:r.width,h:r.height}:null,scrollY:scrollY,opacity:main?getComputedStyle(main).opacity:null},status=typeof CandidateAtmosphere!=='undefined'?CandidateAtmosphere.diagnostics():{},payload={...status,error:JSON.stringify({error,...diag}),reportedAt:Date.now()};
   if(c&&c.width&&c.height){const g=c.getContext('2d');let sum=0,max=0;for(let y=1;y<5;y++)for(let x=1;x<9;x++){const p=g.getImageData(Math.floor(c.width*x/10),Math.floor(c.height*y/6),1,1).data,v=(p[0]+p[1]+p[2])/3;sum+=v;max=Math.max(max,v);}payload.canvasMean=sum/32;payload.canvasMax=max;}
   send('/api/sky-render-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).catch(()=>{});
  }catch(e){send('/api/sky-render-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({error:String(e.message),reportedAt:Date.now()})}).catch(()=>{});}
 }
 setInterval(report,5000);setTimeout(report,2000);
})();
