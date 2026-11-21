/* Chronological navigation across both event groups, without wrapping a group. */
(function(root){
 function adjacent(events,anchor,direction){const list=events.filter(e=>Number.isFinite(e.t)).sort((a,b)=>a.t-b.t);return direction<0?[...list].reverse().find(e=>e.t<anchor-500)||null:list.find(e=>e.t>anchor+500)||null;}
 function shiftDate(date,direction){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+(direction<0?-1:1));return d.toISOString().slice(0,10);}
 async function find({date,anchor,direction,eventsForDay,cancelled=()=>false,limit=370,realtimeTime=null,realtimeDate=null}){
  for(let i=0;i<limit;i++){
   if(cancelled())return null;
   const events=await eventsForDay(date);if(cancelled())return null;
   const candidates=Number.isFinite(realtimeTime)&&date===realtimeDate?[...events,{t:realtimeTime,realtime:true,label:'Realtime'}]:events;
   const found=adjacent(candidates,anchor,direction);if(found)return {...found,date};
   date=shiftDate(date,direction);
  }return null;
 }
 const api={adjacent,shiftDate,find};root.EventNavigation=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
