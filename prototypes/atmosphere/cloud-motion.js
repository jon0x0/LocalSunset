/* Local-column wind advection; no cloud growth/decay or measured motion tracking. */
(function(root){
 function windAt(profile,height){
  const p=profile?.levels?.filter(l=>Number.isFinite(l.z)&&Number.isFinite(l.windSpeed)&&Number.isFinite(l.windDirection)&&l.windSpeed>=0).sort((a,b)=>a.z-b.z);if(!p?.length||height<p[0].z||height>p.at(-1).z)return null;
  let j=1;while(j<p.length&&p[j].z<height)j++;j=Math.min(j,p.length-1);const a=p[Math.max(0,j-1)],b=p[j],f=a.z===b.z?0:(height-a.z)/(b.z-a.z),vector=l=>[-l.windSpeed*Math.sin(l.windDirection*Math.PI/180),-l.windSpeed*Math.cos(l.windDirection*Math.PI/180)],u=vector(a),v=vector(b);return u.map((x,i)=>x+(v[i]-x)*f);

 }
 function backtrace(profile,height,lat,lon,observed,time){
  const dt=(time-observed)/1000;if(dt<0||dt>5400||!profile||Math.abs(profile.time-observed)>5400000)return null;
  if(Math.hypot((lat-profile.lat)*111.2,(lon-profile.lon)*111.2*Math.cos(lat*Math.PI/180))>50)return null;
  const wind=windAt(profile,height);if(!wind)return null;const sourceLat=lat-wind[1]*dt/111200,sourceLon=lon-wind[0]*dt/(111200*Math.max(.1,Math.cos(lat*Math.PI/180)));return [sourceLat,sourceLon];
 }
 const api={windAt,backtrace};root.CloudMotion=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
