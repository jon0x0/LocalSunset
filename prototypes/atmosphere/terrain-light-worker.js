/* Horizon sweeps stay off the UI thread. A cached horizon advances with the Sun. */
importScripts('terrain-light-geometry.js');
let mesh=null,key='',horizons=[];
self.onmessage=({data:p})=>{
 if(p.mesh){mesh=p.mesh;key='';}
 if(!mesh)return;
 const next=[Math.round(p.az*10),p.shadows].join('|');
 if(next!==key){key=next;horizons=mesh.heights.map((_,i)=>TerrainLightGeometry.horizon(mesh,i%mesh.size,Math.floor(i/mesh.size),p.az,p.shadows));}
 const lights=mesh.heights.map((_,i)=>({...TerrainLightGeometry.illumination(mesh,i%mesh.size,Math.floor(i/mesh.size),p.alt,p.az,horizons[i]),obstruction:horizons[i]}));
 self.postMessage({id:p.id,lights});
};
