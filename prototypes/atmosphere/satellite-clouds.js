/* Observed GOES cloud mask projected onto a curved, height-varying cloud layer.
   No invented motion, cloud bases or phase retrievals. Units: km and degrees. */
(function(root){
 'use strict';
 const R=6371,D=Math.PI/180;
 function destination(lat,lon,az,angle){lat*=D;const a=az*D,b=angle,newLat=Math.asin(Math.sin(lat)*Math.cos(b)+Math.cos(lat)*Math.sin(b)*Math.cos(a));return [newLat/D,lon+Math.atan2(Math.sin(a)*Math.sin(b)*Math.cos(lat),Math.cos(b)-Math.sin(lat)*Math.sin(newLat))/D];}
 function intersection(lat,lon,observer,alt,az,height){const r=R+observer/1000,shell=R+height/1000;if(shell<=r)return null;const a=alt*D,t=-r*Math.sin(a)+Math.sqrt((r*Math.sin(a))**2+shell*shell-r*r);return destination(lat,lon,az,Math.atan2(t*Math.cos(a),r+t*Math.sin(a)));}
 function lookup(d,lat,lon,observer,alt,az,thickness,baseAt=null,sourceAt=null){
  // Walk the sightline from the observer outward. A distant clear cell cannot
  // erase an intersected nearer cloud. Steps stay below the 4.6 km mask grid.
  const r=R+observer/1000,a=alt*D,sa=Math.sin(a),ca=Math.cos(a);
  let unknown=false,known=false;
  for(let distance=.025;distance<=650;){
   const radial=Math.sqrt(r*r+distance*distance+2*r*distance*sa);
   const height=(radial-R)*1000;if(height>25000)break;
   if(height<observer-100)return null;
   const angle=Math.atan2(distance*ca,r+distance*sa),p=destination(lat,lon,az,angle);
   const source=sourceAt?sourceAt(height,p[0],p[1]):p;
   const c=source?cell(d,...source):null;
   if(!c){unknown=true;break;}
   if(c[0]===null||c[0]===1&&c[1]===null)unknown=true;
   else {
    known=true;
    if(c[0]===1){
     const estimate=baseAt?.(c[1],p[0],p[1]);
     const base=estimate?estimate.base:c[1]-thickness*1000;
     if(height>=base&&height<=c[1])return {cover:1,top:c[1],tau:c[2]};
     // Resolve thin layers at steep view angles without stepping over them.
     if(height<base){
      const hit=intersection(lat,lon,observer,alt,az,(base+c[1])/2);
      if(hit){
       const origin=sourceAt?sourceAt((base+c[1])/2,hit[0],hit[1]):hit;
       const other=origin?cell(d,...origin):null;
       if(other===c)return {cover:1,top:c[1],tau:c[2]};
      }
     }
    }
   }
   distance+=Math.min(2,Math.max(.025,distance*.08));
  }
  // Unknown/out-of-region sky uses the forecast fallback, never observed clear.
  return known&&!unknown?{cover:0}:null;
 }
 function validate(d){
  if(!d||d.schema!=='localsunset-satellite-v1'||!Number.isFinite(Date.parse(d.observedAt))||typeof d.source!=='string'||!Number.isInteger(d.width)||!Number.isInteger(d.height)||d.width<2||d.height<2||d.width>256||d.height>256||!Array.isArray(d.bounds)||d.bounds.length!==4||!d.bounds.every(Number.isFinite)||d.bounds[0]>=d.bounds[2]||d.bounds[1]>=d.bounds[3]||d.bounds[0]<-180||d.bounds[2]>180||d.bounds[1]<-90||d.bounds[3]>90||!Array.isArray(d.cells)||d.cells.length!==d.width*d.height)throw Error('Invalid satellite snapshot geometry.');
  for(const c of d.cells)if(!Array.isArray(c)||c.length!==3||![null,0,1].includes(c[0])||!(c[1]===null||Number.isFinite(c[1])&&c[1]>=0&&c[1]<=25000)||!(c[2]===null||Number.isFinite(c[2])&&c[2]>=0&&c[2]<=1000))throw Error('Invalid satellite cloud values.');
  return d;
 }
 function cell(d,lat,lon){const [west,south,east,north]=d.bounds;if(lat<south||lat>north||lon<west||lon>east)return null;const x=Math.round((lon-west)/(east-west)*(d.width-1)),y=Math.round((lat-south)/(north-south)*(d.height-1));return d.cells[y*d.width+x];}
 function matchesEvent(d,event,maxAge=3600000){return !!event&&Number.isFinite(event.time)&&Math.abs(event.time-Date.parse(d.observedAt))<=maxAge&&!!cell(d,event.lat,event.lon);}
 const api={validate,cell,intersection,lookup,matchesEvent};root.SatelliteCloudGeometry=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
