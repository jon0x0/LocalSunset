/* Observed GOES cloud mask projected onto a curved, height-varying cloud layer.
   No invented motion, cloud bases or phase retrievals. Units: km and degrees. */
(function(root){
 'use strict';
 const R=6371,D=Math.PI/180;
 function destination(lat,lon,az,angle){lat*=D;const a=az*D,b=angle,newLat=Math.asin(Math.sin(lat)*Math.cos(b)+Math.cos(lat)*Math.sin(b)*Math.cos(a));return [newLat/D,lon+Math.atan2(Math.sin(a)*Math.sin(b)*Math.cos(lat),Math.cos(b)-Math.sin(lat)*Math.sin(newLat))/D];}
 function intersection(lat,lon,observer,alt,az,height){const r=R+observer/1000,shell=R+height/1000;if(shell<=r)return null;const a=alt*D,t=-r*Math.sin(a)+Math.sqrt((r*Math.sin(a))**2+shell*shell-r*r);return destination(lat,lon,az,Math.atan2(t*Math.cos(a),r+t*Math.sin(a)));}
 function lookup(d,lat,lon,observer,alt,az,thickness,baseAt=null,sourceAt=null){
  let height=8000,c=null;
  for(let i=0;i<5;i++){
   const p=intersection(lat,lon,observer,alt,az,height);if(!p)return null;const source=sourceAt?sourceAt(height,p[0],p[1]):p;if(!source)return null;c=cell(d,...source);if(!c||c[0]===null)return null;
   if(c[0]===0)return {cover:0};if(c[1]===null)return null;
   const base=baseAt?.(c[1],p[0],p[1]);const next=Math.max(observer+50,base?(c[1]+base.base)/2:c[1]-thickness*500);if(Math.abs(next-height)<100)break;height=next;
  }
  return {cover:1,top:c[1],tau:c[2]};
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
