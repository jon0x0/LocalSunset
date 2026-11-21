/* Static-host satellite preprocessing. Pinned NIST h5wasm; all CPU work off UI. */
importScripts('https://cdn.jsdelivr.net/npm/h5wasm@0.10.3/dist/iife/h5wasm.js');
const bucket='https://noaa-goes19.s3.amazonaws.com/';
async function product(kind,target){
 for(let back=0;back<3;back++){
  const h=new Date(target-back*3600000),year=h.getUTCFullYear(),day=Math.floor((h-Date.UTC(year,0,1))/86400000)+1,prefix=`ABI-L2-${kind}C/${year}/${String(day).padStart(3,'0')}/${String(h.getUTCHours()).padStart(2,'0')}/`;
  const r=await fetch(bucket+'?list-type=2&prefix='+encodeURIComponent(prefix));if(!r.ok)throw Error('NOAA listing returned '+r.status);
  const text=await r.text(),keys=[...text.matchAll(/<Key>([^<]+)<\/Key>/g)].map(m=>m[1]);
  const entries=keys.map(key=>{const m=key.match(/_s(\d{4})(\d{3})(\d{2})(\d{2})(\d{2})/);return {key,time:Date.UTC(+m[1],0,+m[2],+m[3],+m[4],+m[5])};}).filter(v=>v.time<=target).sort((a,b)=>b.time-a.time);
  if(entries.length){const e=entries[0],response=await fetch(bucket+e.key);if(!response.ok)throw Error('NOAA product returned '+response.status);return {...e,bytes:new Uint8Array(await response.arrayBuffer())};}
 }
 throw Error('No recent '+kind+' observation available');
}
const scalar=v=>Array.isArray(v)||ArrayBuffer.isView(v)?Number(v[0]):Number(v);
const attr=(d,key,fallback)=>d.attrs[key]?scalar(d.attrs[key].value):fallback;
function sample(file,name,lats,lons,heights){
 const p=file.get('goes_imager_projection'),a=attr(p,'semi_major_axis'),b=attr(p,'semi_minor_axis'),H=a+attr(p,'perspective_point_height'),origin=attr(p,'longitude_of_projection_origin'),e2=1-b*b/(a*a),x=file.get('x'),y=file.get('y'),rawX=x.value,rawY=y.value;
 const axis=(d,r,i)=>r[i]*attr(d,'scale_factor',1)+attr(d,'add_offset',0),x0=axis(x,rawX,0),dx=axis(x,rawX,1)-x0,y0=axis(y,rawY,0),dy=axis(y,rawY,1)-y0,d=file.get(name),raw=d.value,fill=attr(d,'_FillValue',NaN),scale=attr(d,'scale_factor',1),offset=attr(d,'add_offset',0),quality=name==='BCM'?null:file.get('DQF')?.value;
 return lats.map((latitude,i)=>{
  const lat=latitude*Math.PI/180,dlon=(lons[i]-origin)*Math.PI/180,N=a/Math.sqrt(1-e2*Math.sin(lat)**2),radial=(N+heights[i])*Math.cos(lat),sx=H-radial*Math.cos(dlon),sy=radial*Math.sin(dlon),sz=(N*(1-e2)+heights[i])*Math.sin(lat),scanX=Math.asin(sy/Math.hypot(sx,sy,sz)),scanY=Math.atan2(sz,sx),ix=Math.round((scanX-x0)/dx),iy=Math.round((scanY-y0)/dy);
  if(ix<0||ix>=rawX.length||iy<0||iy>=rawY.length)return null;const index=iy*rawX.length+ix,v=raw[index];if(v===fill||quality&&quality[index]!==0)return null;return v*scale+offset;
 });
}
async function region(p){
 if(p.lat<20||p.lat>55||p.lon< -125||p.lon> -65)throw Error('Satellite experiment currently supports the contiguous US');
 const {FS}=await h5wasm.ready,mask=await product('ACM',p.time),top=await product('ACHA',mask.time+300000);if(Math.abs(top.time-mask.time)>900000)throw Error('Satellite product times do not align');
 const size=96,radius=220,south=p.lat-radius/111.2,north=p.lat+radius/111.2,west=p.lon-radius/(111.2*Math.cos(p.lat*Math.PI/180)),east=2*p.lon-west,lats=[],lons=[];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){lats.push(south+(north-south)*y/(size-1));lons.push(west+(east-west)*x/(size-1));}
 function read(product,name,heights,twice=false){const filename='cloud.nc';FS.writeFile(filename,product.bytes);let f;try{f=new h5wasm.File(filename,'r');let values=sample(f,name,lats,lons,heights);if(twice)values=sample(f,name,lats,lons,values.map(v=>v??0));return values;}finally{f?.close();FS.unlink(filename);}}
 const ht=read(top,'HT',lats.map(()=>0),true),cloud=read(mask,'BCM',ht.map(v=>v??0));let optical=lats.map(()=>null),codKey=null;
 try{const cod=await product('COD',mask.time+300000);if(Math.abs(cod.time-mask.time)<=900000){optical=read(cod,'COD',ht.map(v=>v??0));codKey=cod.key;}}catch(e){}
 return {schema:'localsunset-satellite-v1',source:'NOAA GOES-19 ABI (browser worker)',observedAt:new Date(mask.time).toISOString(),heightObservedAt:new Date(top.time).toISOString(),products:[mask.key,top.key,codKey],bounds:[west,south,east,north],width:size,height:size,cells:cloud.map((v,i)=>[v===0||v===1?v:null,ht[i]!==null&&ht[i]>=0&&ht[i]<=25000?Math.round(ht[i]):null,optical[i]!==null&&optical[i]>=0&&optical[i]<=1000?Math.round(optical[i]*100)/100:null])};
}
self.onmessage=async({data:p})=>{try{self.postMessage({data:await region(p)});}catch(e){self.postMessage({error:e.message});}};
