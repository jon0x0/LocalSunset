/* Relative, unbounded time control; the texture moves, with no thumb/end stops. */
(function(root){
 const move=(anchor,pixels,width,hours=2)=>anchor-pixels/Math.max(1,width)*hours*3600000;
 function day(t,zone){const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(t)),get=type=>parts.find(p=>p.type===type).value;return get('year')+'-'+get('month')+'-'+get('day');}
 const covers=(result,t)=>!!result&&t>=result.timeline[0].t&&t<result.timeline.at(-1).t;
 const policy={move,day,covers};if(typeof module!=='undefined')module.exports=policy;
 if(typeof document==='undefined')return;
 const strip=document.createElement('section');strip.className='time-scrubber';strip.setAttribute('aria-label','Continuous time control');
 const heading=document.createElement('div'),label=document.createElement('span'),speed=document.createElement('select');heading.className='time-scrubber-heading';
 label.textContent='Continuous time · swipe left for later';speed.setAttribute('aria-label','Time swipe scale');
 for(const [value,text] of [[2,'2h per swipe'],[12,'12h per swipe']]){const option=document.createElement('option');option.value=value;option.textContent=text;speed.append(option);}
 heading.append(label,speed);const track=document.createElement('div');track.className='time-scrubber-track';track.tabIndex=0;track.setAttribute('role','spinbutton');track.setAttribute('aria-label','Continuous time: swipe left for later, right for earlier');track.title='Drag repeatedly with no end stops. Arrow keys: 5 min; Shift+arrows: 1 hour; Page Up/Down: 6 hours. Horizontal scroll or Shift+wheel also changes time.';
 const cursor=document.createElement('span');cursor.className='time-scrubber-cursor';cursor.setAttribute('aria-hidden','true');track.append(cursor);strip.append(heading,track);document.querySelector('.scene').after(strip);
 let wanted=null,busy=false,retry=null,inputTimer=null,drag=null,texture=0;
 const selected=()=>wanted??(realTimeView?Date.now():currentTime);
 function update(){const t=selected();if(!result||!Number.isFinite(t))return;track.setAttribute('aria-valuenow',Math.round(t/60000));track.setAttribute('aria-valuetext',localDate(t)+' '+formatClock(t,result.timezone)+' '+result.timezone);label.textContent=(busy?'Loading date · ':'Continuous time · ')+localDate(t)+' · '+formatClock(t,result.timezone,false);track.setAttribute('aria-busy',String(busy));}
 async function apply(){
  if(busy||wanted===null||!result)return;
  if(calculationPending){clearTimeout(retry);retry=setTimeout(apply,250);return;}
  busy=true;let generation=locationGeneration;update();
  try{
   while(wanted!==null){
    if(generation!==locationGeneration){wanted=null;break;}
    const target=wanted;
    if(!covers(result,target)){
     const previousDate=$('date').value,az=viewAzimuth;
     $('date').value=day(target,result.timezone);realTimeView=false;realtimeRequested=false;
     const task=calculateCurrent();generation=locationGeneration;const ok=await task;
     if(generation!==locationGeneration){wanted=null;break;}
     if(!ok){$('date').value=previousDate;wanted=null;status('Could not load that date. The previous sky is retained; swipe again to retry.');break;}
     realTimeView=false;realtimeRequested=false;viewAzimuth=az;
     // A newer swipe may have arrived while that day's events were calculated.
     continue;
    }
    wanted=null;setTime(target);updatePlay();CandidateAtmosphere.refresh();persistView();
   }
  }finally{busy=false;update();}
 }
 function seek(t,immediate=false){if(!result||!Number.isFinite(t))return;playing=false;realTimeView=false;realtimeRequested=false;updatePlay();wanted=t;clearTimeout(inputTimer);if(immediate)apply();else inputTimer=setTimeout(apply,120);update();}
 track.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0||!result)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,time:selected(),offset:texture,active:false};});
 track.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.active){if(Math.max(Math.abs(dx),Math.abs(dy))<6)return;if(Math.abs(dy)>Math.abs(dx)){drag=null;return;}drag.active=true;track.setPointerCapture(e.pointerId);}e.preventDefault();texture=drag.offset+dx;track.style.backgroundPositionX=texture+'px';seek(move(drag.time,dx,track.getBoundingClientRect().width,Number(speed.value)));});
 function finish(e){if(!drag||e.pointerId!==drag.id)return;drag=null;if(track.hasPointerCapture(e.pointerId))track.releasePointerCapture(e.pointerId);clearTimeout(inputTimer);apply();}
 for(const event of ['pointerup','pointercancel','lostpointercapture'])track.addEventListener(event,finish);
 track.addEventListener('keydown',e=>{let minutes;if(['ArrowLeft','ArrowDown'].includes(e.key))minutes=e.shiftKey?-60:-5;else if(['ArrowRight','ArrowUp'].includes(e.key))minutes=e.shiftKey?60:5;else if(e.key==='PageUp')minutes=360;else if(e.key==='PageDown')minutes=-360;else return;e.preventDefault();texture-=minutes;track.style.backgroundPositionX=texture+'px';seek(selected()+minutes*60000,true);});
 track.addEventListener('wheel',e=>{if(!e.deltaX&&!e.shiftKey)return;e.preventDefault();const pixels=e.deltaX||e.deltaY;texture-=pixels;track.style.backgroundPositionX=texture+'px';seek(move(selected(),-pixels,track.getBoundingClientRect().width,Number(speed.value)));},{passive:false});
 setInterval(()=>{if(!document.hidden){update();if(wanted!==null&&!busy)apply();}},1000);update();
})(typeof globalThis!=='undefined'?globalThis:this);
