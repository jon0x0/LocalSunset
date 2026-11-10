/* Pure geometry shared by browser workers and numerical regression tests. */
const BrowserTerrain=(()=>{
 const R=6371008.8,D=Math.PI/180;
 function destination(lat,lon,az,distance){const p=lat*D,l=lon*D,a=az*D,d=distance/R,c=Math.cos(d),s=Math.sin(d),north=[-Math.sin(p)*Math.cos(l),-Math.sin(p)*Math.sin(l),Math.cos(p)],east=[-Math.sin(l),Math.cos(l),0],origin=[Math.cos(p)*Math.cos(l),Math.cos(p)*Math.sin(l),Math.sin(p)],v=origin.map((value,i)=>value*c+(north[i]*Math.cos(a)+east[i]*Math.sin(a))*s);return [Math.atan2(v[2],Math.hypot(v[0],v[1]))/D,((Math.atan2(v[1],v[0])/D+540)%360)-180];}
 function pixels(lat,lon,zoom){const n=256*2**zoom,p=Math.max(-85.0511287,Math.min(85.0511287,lat))*D;return [(lon+180)/360*n,(1-Math.asinh(Math.tan(p))/Math.PI)/2*n];}
 function distances(radius,spacing){const values=[];for(let i=0;i<100;i++)values.push(2*(500**(i/99)));for(let d=1000;d<radius*1000+spacing;d+=spacing)values.push(d);return [...new Set(values)].sort((a,b)=>a-b);}
 function angle(height,observer,distance){const a=distance/R;return Math.atan2((R+height)*Math.cos(a)-(R+observer),(R+height)*Math.sin(a))/D;}
 async function trace(provider,lat,lon,height,radius,progress,groundOverride=null,nearDistance=null){
  const demGround=(await provider.sampleMany([[lat,lon]]))[0],ground=groundOverride??demGround,observer=ground+height,spacing=provider.spacing,ds=distances(radius,spacing).filter(d=>d>=(nearDistance??(groundOverride!=null?100:0))),dip=-Math.acos(R/(R+Math.max(0,observer)))/D,horizon=[],layers=[[],[],[]];
  for(let first=0;first<1440;first+=48){
   progress('Tracing terrain horizon: '+(first/48+1)+'/30 sectors. Terrain is cached on this device.');
   const points=[];for(let i=first;i<first+48;i++)for(const d of ds)points.push(destination(lat,lon,i*.25,d));
   const heights=await provider.sampleMany(points);
   for(let i=0;i<48;i++){let maximum=dip;const envelope=[dip,dip,dip];for(let j=0;j<ds.length;j++){const a=angle(heights[i*ds.length+j],observer,ds[j]);maximum=Math.max(maximum,a);for(let k=0;k<3;k++)if(ds[j]<=[2000,10000,radius*1000+spacing][k])envelope[k]=Math.max(envelope[k],a);}horizon.push(maximum);for(let k=0;k<3;k++)layers[k].push(envelope[k]);}
  }
  return {ground_m:ground,observer_m:observer,...(groundOverride!=null?{dem_ground_m:demGround,ground_override_m:ground,near_m:nearDistance??100}:{}),azimuths:horizon.map((_,i)=>i*.25),horizon,layers,sources:[...provider.used],pixel_m:Math.round(spacing*10)/10,radius_km:radius};
 }
 return {R,destination,pixels,distances,angle,trace};
})();
