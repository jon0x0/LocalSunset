/* Experimental phase-aware humidity layers; elevations metres MSL.
   Murphy & Koop (2005), equations tabulated by NCAR EOL.
   Input provider RH is explicitly assumed relative to liquid water. */
(function(root){
 const cache=new WeakMap();
 function saturation(c,ice=false){
  if(!Number.isFinite(c)||c< -100||c>60)return null;
  const t=c+273.15;
  return Math.exp(ice?9.550426-5723.265/t+3.53068*Math.log(t)-.00728332*t:54.842763-6763.22/t-4.21*Math.log(t)+.000367*t+Math.tanh(.0415*(t-218.8))*(53.878-1331.22/t-9.44523*Math.log(t)+.014025*t));
 }
 function iceHumidity(rh,c){const w=saturation(c),i=saturation(c,true);return Number.isFinite(rh)&&w&&i?rh*w/i:null;}
 function layers(levels,ground=0){
  const points=levels.filter(p=>Number.isFinite(p.z)&&Number.isFinite(p.rh)&&Number.isFinite(p.temperature)&&p.z>ground&&p.rh>=0&&p.rh<=150&&p.temperature>=-100&&p.temperature<=60).sort((a,b)=>a.z-b.z),out=[];
  for(const phase of ['water','ice']){
   let start=null;
   const score=p=>phase==='water'?p.rh-95:(p.temperature<0?iceHumidity(p.rh,p.temperature)-100:-100);
   const cross=(a,b)=>a.z+(b.z-a.z)*(-score(a))/(score(b)-score(a));
   for(let i=0;i<points.length;i++){
    const p=points[i],previous=points[i-1],gap=previous&&p.z-previous.z>2000;
    if(gap&&start){out.push({...start,top:previous.z,openTop:true,phase});start=null;}
    if(score(p)>=0&&start===null)start={base:previous&&!gap?cross(previous,p):p.z,uncertainty:previous&&!gap?(p.z-previous.z)/2:1000,openBase:!previous||gap,minTemperature:p.temperature};
    if(start)start.minTemperature=Math.min(start.minTemperature,p.temperature);
    if(start&&score(p)>=0&&phase==='ice'&&p.temperature> -38)start.ambiguous=true;
    if(start&&(score(p)<0||i===points.length-1)){
     const top=score(p)<0?cross(previous,p):p.z;
     out.push({...start,top,phase,openTop:score(p)>=0,uncertainty:Math.max(start.uncertainty,previous?(p.z-previous.z)/2:1000)});start=null;
    }
   }
  }
  return out.map(l=>({...l,ambiguous:!!l.ambiguous}));
 }
 function profileLayers(profile){if(!cache.has(profile))cache.set(profile,layers(profile.levels,profile.ground));return cache.get(profile);}
 function estimate(profile,top,lat,lon,time){
  if(!profile||!Number.isFinite(top)||Math.abs(time-profile.time)>5400000)return null;
  const km=Math.hypot((lat-profile.lat)*111.2,(lon-profile.lon)*111.2*Math.cos(lat*Math.PI/180));if(km>50)return null;
  const candidates=profileLayers(profile).filter(l=>!l.ambiguous&&!l.openBase&&!l.openTop&&l.base<top&&top<=l.top+Math.min(1000,l.uncertainty));
  if(!candidates.length)return null;
  const l=candidates.reduce((a,b)=>Math.abs(a.top-top)<Math.abs(b.top-top)?a:b);
  return {base:l.base,thickness:top-l.base,uncertainty:l.uncertainty,phase:l.phase,method:'Phase-aware humidity candidate; unvalidated'};
 }
 function diagnostics(profile){const valid=profile.levels.filter(p=>Number.isFinite(p.rh)&&Number.isFinite(p.temperature)&&p.z>profile.ground),ice=valid.filter(p=>p.temperature<0).map(p=>iceHumidity(p.rh,p.temperature));return {count:valid.length,maxWater:valid.length?Math.max(...valid.map(p=>p.rh)):null,maxIce:ice.length?Math.max(...ice):null,layers:profileLayers(profile)};}
 const api={saturation,iceHumidity,layers,estimate,diagnostics};root.CloudBase=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
