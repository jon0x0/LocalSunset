/* Coarse elevation-mesh lighting. ENU coordinates/metres; bounded grid shadows. */
(function(root){
 const D=Math.PI/180,R=6371008.8,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function coordinate(mesh,i){return mesh.axis?mesh.axis[i]:(i-(mesh.size-1)/2)*mesh.span/(mesh.size-1);}
 function nearest(mesh,v){if(!mesh.axis)return Math.round(v/(mesh.span/(mesh.size-1))+(mesh.size-1)/2);const a=Math.abs(v),i=a<=8000?a/125:64+(a-8000)/687.5;return Math.round((mesh.size-1)/2+Math.sign(v)*i);}
 function normal(mesh,x,y){const n=mesh.size,step=mesh.span/(n-1),h=(x,y)=>mesh.heights[clamp(y,0,n-1)*n+clamp(x,0,n-1)],dx=(h(x+1,y)-h(x-1,y))/(coordinate(mesh,Math.min(n-1,x+1))-coordinate(mesh,Math.max(0,x-1))),dy=(h(x,y+1)-h(x,y-1))/(coordinate(mesh,Math.min(n-1,y+1))-coordinate(mesh,Math.max(0,y-1))),length=Math.hypot(dx,dy,1);return [-dx/length,-dy/length,1/length];}
 function horizon(mesh,x,y,az,shadows=true){
  const z=mesh.heights[y*mesh.size+x];let angle=-Math.acos(R/(R+Math.max(0,z)))/D;
  if(shadows){const east=Math.sin(az*D),north=Math.cos(az*D),originX=coordinate(mesh,x),originY=coordinate(mesh,y),spacing=mesh.axis?125:mesh.span/(mesh.size-1);
   for(let distance=spacing;distance<=mesh.span*1.5;){
    const px=originX+east*distance,py=originY+north*distance,xx=nearest(mesh,px),yy=nearest(mesh,py);if(xx<0||yy<0||xx>=mesh.size||yy>=mesh.size)break;
    angle=Math.max(angle,Math.atan2(mesh.heights[yy*mesh.size+xx]-z-distance*distance/(2*R),distance)/D);
    distance+=mesh.axis&&Math.max(Math.abs(px),Math.abs(py))>8500?500:spacing;
   }
  }return angle;
 }
 function illumination(mesh,x,y,alt,az,obstruction=horizon(mesh,x,y,az)){
  const step=mesh.span/(mesh.size-1),east=coordinate(mesh,x),north=coordinate(mesh,y);
  const localAlt=alt+(east*Math.sin(az*D)+north*Math.cos(az*D))/R/D,n=normal(mesh,x,y),s=[Math.sin(az*D)*Math.cos(localAlt*D),Math.cos(az*D)*Math.cos(localAlt*D),Math.sin(localAlt*D)];
  const incidence=Math.max(0,n.reduce((sum,v,i)=>sum+v*s[i],0)),clearance=localAlt-obstruction;
  return {incidence,clearance,visibility:clamp((clearance+.27)/.54,0,1),localAlt};
 }
 function direct(mesh,x,y,alt,az,shadows=true){const light=illumination(mesh,x,y,alt,az,horizon(mesh,x,y,az,shadows));return light.incidence*light.visibility;}
 // Clip the actual illumination boundary, rather than averaging a lit and dark vertex.
 function sunPolygon(vertices,threshold=0){const out=[];for(let i=0;i<vertices.length;i++){
  const a=vertices[i],b=vertices[(i+1)%vertices.length],inside=a.clearance>=threshold,next=b.clearance>=threshold;
  if(inside)out.push(a);if(inside!==next){const f=(threshold-a.clearance)/(b.clearance-a.clearance),v={};for(const key of ['x','y','incidence','height'])v[key]=a[key]+(b[key]-a[key])*f;v.clearance=threshold;out.push(v);}
 }return out;}
 function vertex(mesh,x,y,observer,focus,scale,base,width){const step=mesh.span/(mesh.size-1),east=coordinate(mesh,x),north=coordinate(mesh,y),distance=Math.hypot(east,north);if(distance<150)return null;const az=Math.atan2(east,north)/D,relative=((az-focus+540)%360)-180,alt=Math.atan2(mesh.heights[y*mesh.size+x]-observer-distance*distance/(2*R),distance)/D;return {x:width/2+relative*scale,y:base-alt*scale,distance,relative};}
 // Assumed dry earth/vegetation reflectance, not measured land cover or snow.
 // Multiply incident light by reflectance before exposure; compress all channels
 // together so strong illumination cannot clip independently toward white.
 function material(solar,incidence,beam,daylight,haze){
  const albedo=[.18,.16,.105],sky=[.045,.07,.14],air=[.018,.025,.033],day=clamp(daylight,0,1),fog=clamp(haze,0,1);
  const rgb=albedo.map((a,i)=>(a*(sky[i]*(.04+.96*day)+Math.max(0,solar[i])*Math.max(0,incidence)*clamp(beam,0,1)*4))*(1-fog)+air[i]*day*fog);
  const exposure=1/(1+Math.max(...rgb));return rgb.map(v=>v*exposure);
 }
 const api={material,normal,horizon,illumination,direct,sunPolygon,vertex};root.TerrainLightGeometry=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
