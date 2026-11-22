/* Shared, testable ENU geometry for the isolated GPU experiment. */
(function(root){
 const R=6371008.8,D=Math.PI/180;
 function axis(mesh){return mesh.axis||Array.from({length:mesh.size},(_,i)=>(i/(mesh.size-1)-.5)*mesh.span);}
 function sample(mesh,x,y){const a=axis(mesh),loc=v=>{let l=0,r=a.length-1;while(r-l>1){const m=(l+r)>>1;if(a[m]<=v)l=m;else r=m;}return [l,Math.max(0,Math.min(1,(v-a[l])/(a[l+1]-a[l])))];},[i,u]=loc(x),[j,v]=loc(y),n=mesh.size,h=mesh.heights;return (h[j*n+i]*(1-u)+h[j*n+i+1]*u)*(1-v)+(h[(j+1)*n+i]*(1-u)+h[(j+1)*n+i+1]*u)*v;}
 function combine(base,detail){if(!detail)return base;const fine=axis(detail),edge=fine.at(-1),a=[...axis(base).filter(v=>Math.abs(v)>edge),...fine].sort((a,b)=>a-b),heights=[];for(const y of a)for(const x of a)heights.push(sample(Math.abs(x)<=edge&&Math.abs(y)<=edge?detail:base,x,y));return {...base,size:a.length,axis:a,heights};}
 function buffers(mesh,observer){const a=axis(mesh),n=a.length,positions=new Float32Array(n*n*3),indices=[];for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=y*n+x,e=a[x],north=a[y];positions.set([e,mesh.heights[i]-observer-(e*e+north*north)/(2*R),-north],i*3);}
  for(let y=0;y<n-1;y++)for(let x=0;x<n-1;x++){const i=y*n+x;for(const tri of [[i,i+1,i+n],[i+n,i+1,i+n+1]]){indices.push(...tri);}}return {positions,indices:new Uint32Array(indices)};}
 // Bias in world metres scales with the shadow texel footprint. A heightfield
 // must cast front faces: unlike a closed solid it has no underside geometry.
 function shadowSettings(size,width=88000,height=88000){const texel=Math.max(width,height)/size;return {texel,normalBias:Math.max(.5,texel*.1),bias:-.5/199000};}
 // Compress normalized direct irradiance, not Sun altitude. Output luminance
 // is 24*Y/(1+6*Y): strictly increasing, bounded, and zero without sunlight.
 // One scalar preserves the spectral RGB ratios (the golden low-Sun hue).
 function sunStrength(rgb){const y=Math.max(0,.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]);return 24/(1+6*y);}
 function sunDirection(alt,az){return [Math.sin(az*D)*Math.cos(alt*D),Math.sin(alt*D),-Math.cos(az*D)*Math.cos(alt*D)];}
 const api={axis,sample,combine,buffers,shadowSettings,sunStrength,sunDirection};root.GPUTerrainGeometry=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
