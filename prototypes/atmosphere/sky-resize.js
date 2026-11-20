/* Prototype viewport sizing; changes framing only, never event calculations. */
const CandidateSkyViewport=(()=>{
 const scene=document.querySelector('.scene'),workbench=document.querySelector('.sky-workbench');
 let sizing=SkyViewportPolicy.policy(innerWidth,innerHeight);const storageKey=()=> 'localsunset.atmosphere.candidate.skyHeight.v2.'+sizing.profile;
 const bar=document.createElement('div');bar.className='sky-resize-bar';
 const grip=document.createElement('div');grip.className='sky-resize-grip';grip.tabIndex=0;grip.setAttribute('role','separator');grip.setAttribute('aria-orientation','horizontal');grip.setAttribute('aria-label','Resize sky view vertically');grip.setAttribute('aria-valuemin',sizing.minimum);grip.setAttribute('aria-valuemax',sizing.maximum);grip.title='Drag up or down to resize the sky. Arrow keys adjust height.';
 const caption=document.createElement('span');grip.append(caption);bar.append(grip);
 const fit=document.createElement('button');fit.type='button';fit.textContent='Fit terrain';fit.title='Make enough vertical room for the visible terrain skyline';bar.append(fit);
 const reset=document.createElement('button');reset.type='button';reset.textContent='Reset';bar.append(reset);scene.after(bar);
 function bounds(focus,fov,profile){let low=Infinity,high=-Infinity;for(let j=0;j<=180;j++){const az=(focus+(j/180-.5)*fov+720)%360,p=az/360*profile.length,i=Math.floor(p),v=profile[i]*(1-(p-i))+profile[(i+1)%profile.length]*(p-i);low=Math.min(low,v);high=Math.max(high,v);}return {low,high};}
 function base(h,scale,focus,profile){const {low,high}=bounds(focus,VIEW_FOV,profile),lower=high*scale+30,upper=h+low*scale-30;return lower<=upper?Math.max(lower,Math.min(upper,h*.64)):(lower+upper)/2;}
 function updatePin(){workbench.classList.toggle('sky-workbench-large',workbench.getBoundingClientRect().height>innerHeight*.72);}
 function setHeight(value,persist=true){const h=Math.round(Math.max(sizing.minimum,Math.min(sizing.maximum,value)));scene.style.height=h+'px';grip.setAttribute('aria-valuenow',h);grip.setAttribute('aria-valuetext',h+' pixels tall');caption.textContent='↕ Resize sky';if(persist)try{localStorage.setItem(storageKey(),String(h));}catch(e){}updatePin();}
 let drag=null;
 grip.onpointerdown=e=>{if(!e.isPrimary||e.button!==0)return;grip.focus({preventScroll:true});drag={id:e.pointerId,y:e.clientY,height:scene.getBoundingClientRect().height};grip.setPointerCapture(e.pointerId);e.preventDefault();};
 grip.onpointermove=e=>{if(drag&&drag.id===e.pointerId)setHeight(drag.height+e.clientY-drag.y,false);};
 function finish(e){if(!drag||drag.id!==e.pointerId)return;drag=null;setHeight(scene.getBoundingClientRect().height);if(grip.hasPointerCapture(e.pointerId))grip.releasePointerCapture(e.pointerId);}
 for(const event of ['pointerup','pointercancel','lostpointercapture'])grip.addEventListener(event,finish);
 grip.onkeydown=e=>{const current=scene.getBoundingClientRect().height,step=e.shiftKey?50:20;let next;if(e.key==='ArrowDown')next=current+step;else if(e.key==='ArrowUp')next=current-step;else if(e.key==='Home')next=sizing.minimum;else if(e.key==='End')next=sizing.maximum;else return;e.preventDefault();setHeight(next);};
 fit.onclick=()=>{if(!result)return;const {low,high}=bounds(viewAzimuth,VIEW_FOV,result.terrain.horizon),scale=scene.getBoundingClientRect().width/VIEW_FOV;setHeight(Math.max(260,(high-low)*scale+120));draw();};
 reset.onclick=()=>setHeight(sizing.initial);
 function restoreHeight(){let stored;try{stored=Number(localStorage.getItem(storageKey()));}catch(e){}grip.setAttribute('aria-valuemin',sizing.minimum);grip.setAttribute('aria-valuemax',sizing.maximum);setHeight(Number.isFinite(stored)&&stored>=sizing.minimum?stored:sizing.initial,false);}
 restoreHeight();
 new ResizeObserver(updatePin).observe(workbench);
 window.addEventListener('resize',()=>{const next=SkyViewportPolicy.policy(innerWidth,innerHeight),changed=next.profile!==sizing.profile;sizing=next;if(changed){drag=null;restoreHeight();}else setHeight(scene.getBoundingClientRect().height,false);updatePin();});
 return {base,bounds};
})();
