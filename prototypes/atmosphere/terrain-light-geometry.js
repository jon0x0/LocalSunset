/* Coarse elevation-mesh lighting. ENU coordinates/metres; bounded grid shadows. */
(function(root){
 const D=Math.PI/180,R=6371008.8,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function normal(mesh,x,y){const n=mesh.size,step=mesh.span/(n-1),h=(x,y)=>mesh.heights[clamp(y,0,n-1)*n+clamp(x,0,n-1)],dx=(h(x+1,y)-h(x-1,y))/(step*(x>0&&x<n-1?2:1)),dy=(h(x,y+1)-h(x,y-1))/(step*(y>0&&y<n-1?2:1)),length=Math.hypot(dx,dy,1);return [-dx/length,-dy/length,1/length];}
 function direct(mesh,x,y,alt,az,shadows=true){
  const z=mesh.heights[y*mesh.size+x],dip=Math.acos(R/(R+Math.max(0,z)))/D,visible=clamp((alt+dip+.27)/.54,0,1);if(!visible)return 0;
  const n=normal(mesh,x,y),s=[Math.sin(az*D)*Math.cos(alt*D),Math.cos(az*D)*Math.cos(alt*D),Math.sin(alt*D)],incidence=Math.max(0,n.reduce((sum,v,i)=>sum+v*s[i],0));if(!incidence)return 0;
  if(shadows){const step=mesh.span/(mesh.size-1),east=Math.sin(az*D),north=Math.cos(az*D);for(let i=1;i<mesh.size*1.5;i++){
   const xx=Math.round(x+east*i),yy=Math.round(y+north*i);if(xx<0||yy<0||xx>=mesh.size||yy>=mesh.size)break;
   const distance=i*step,ray=z+distance*Math.tan(alt*D)+distance*distance/(2*R);if(mesh.heights[yy*mesh.size+xx]>ray+2)return 0;
  }}return incidence*visible;
 }
 function vertex(mesh,x,y,observer,focus,scale,base,width){const step=mesh.span/(mesh.size-1),east=(x-(mesh.size-1)/2)*step,north=(y-(mesh.size-1)/2)*step,distance=Math.hypot(east,north);if(distance<150)return null;const az=Math.atan2(east,north)/D,relative=((az-focus+540)%360)-180,alt=Math.atan2(mesh.heights[y*mesh.size+x]-observer-distance*distance/(2*R),distance)/D;return {x:width/2+relative*scale,y:base-alt*scale,distance,relative};}
 const api={normal,direct,vertex};root.TerrainLightGeometry=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
