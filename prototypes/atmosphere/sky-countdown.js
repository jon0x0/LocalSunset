/* Live countdowns and relative offsets from the selected preview time. */
(function(root){
 function milestones(a,window,mode){
  const type=mode==='sunrise'?'sunrise':'sunset',events=[
   {t:a.contact,label:'Local terrain '+type},
   {t:window?window[0]:null,label:'Viewing window starts'},
   {t:a.peak?a.peak.t:null,label:type+' peak'},
   {t:window?window[1]:null,label:'Viewing window ends'},
   {t:a.astro,label:'Astronomical '+type}
  ].filter(e=>Number.isFinite(e.t)).sort((a,b)=>a.t-b.t);
  return events;
 }
 function adjacent(a,window,mode,now,direction){const list=milestones(a,window,mode);return direction<0?[...list].reverse().find(e=>e.t<now-500)||null:list.find(e=>e.t>now+500)||null;}
 function next(a,window,mode,now){
  const type=mode==='sunrise'?'sunrise':'sunset',events=milestones(a,window,mode);
  const event=events.find(e=>e.t>now);
  if(!event)return {label:events.length?'Selected '+type+' milestones have passed':'No predicted '+type+' milestones',event:null};
  const seconds=Math.ceil((event.t-now)/1000),pad=n=>String(n).padStart(2,'0'),remaining=pad(Math.floor(seconds/3600))+':'+pad(Math.floor(seconds/60)%60)+':'+pad(seconds%60);
  return {label:event.label+' in '+remaining,event};
 }
 function relative(a,window,mode,time){
  const upcoming=next(a,window,mode,time),event=upcoming.event;
  if(!event)return upcoming;
  const names={'Viewing window starts':'viewing window begin','Viewing window ends':'viewing window end'};
  const label=names[event.label]||event.label.toLowerCase();
  const delta=time-event.t,seconds=Math.round(Math.abs(delta)/1000),minutes=Math.round(seconds/60);
  const pad=n=>String(n).padStart(2,'0'),amount=pad(Math.floor(seconds/3600))+':'+pad(Math.floor(seconds/60)%60)+':'+pad(seconds%60);
  return {label:seconds===0?'At '+label:amount+' '+(delta<0?'before ':'after ')+label,event};
 }
 const api={next,relative,adjacent};root.SkyCountdown=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

