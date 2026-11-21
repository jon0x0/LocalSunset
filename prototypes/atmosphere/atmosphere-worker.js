/* Numerical atmosphere integration runs off the UI thread. */
importScripts('spectral-sky.js','model.js');
self.onmessage=({data:p})=>{
 const pixels=new Float32Array(p.width*p.height*3);
 for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){
  const az=p.focus+(x/p.width-.5)*p.fov,alt=Math.min(90,Math.max(.15,(p.base-y/p.height*p.h)/p.scale)),relative=((az-p.sunAz+540)%360)-180;
  pixels.set(GlowModel.radiance(alt,relative,p.sunAlt,p.aod,p.observer,p.options),(y*p.width+x)*3);
 }
 self.postMessage({key:p.key,pixels},[pixels.buffer]);
};
