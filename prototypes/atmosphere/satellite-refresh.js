/* Acquisition policy independent of UI/render cadence. All times milliseconds. */
(function(root){
 function sourceKey(lat,lon,target,now){return [lat,lon,Math.floor(Math.min(target,now)/300000)].join('|');}
 function needs(p){if(!p.enabled||!p.visible||!Number.isFinite(p.target))return false;const key=sourceKey(p.lat,p.lon,p.target,p.now);if(p.pending)return false;if(p.failed===key&&p.now<p.retryAt)return false;if(p.loaded&&!p.loaded.startsWith([p.lat,p.lon].join('|')+'|'))return true;if(p.loaded===key&&p.hasData)return false;const age=p.target-p.observed;return !p.hasData||!p.inRegion||age<0||age>600000||p.realtime||p.target>p.now;}
 function cached(entries,event,maxAge=5400000){return (Array.isArray(entries)?entries:[]).filter(e=>e.lat===event.lat&&e.lon===event.lon&&e.data&&Number.isFinite(Date.parse(e.data.observedAt))&&event.time>=Date.parse(e.data.observedAt)&&event.time-Date.parse(e.data.observedAt)<=maxAge).sort((a,b)=>(b.key===event.key)-(a.key===event.key)||Date.parse(b.data.observedAt)-Date.parse(a.data.observedAt))[0]||null;}
 const api={sourceKey,needs,cached};root.SatelliteRefresh=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
