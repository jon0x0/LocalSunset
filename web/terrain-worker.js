importScripts('vendor/astronomy.browser.min.js','vendor/geotiff.js','vendor/proj4.js','vendor/tz.js','cache-db.js','terrain-core.js','solar-core.js');
const USGS='https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage',NOAA='https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_global_mosaic/ImageServer/exportImage';
async function request(url,timeout=60000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw Error('Elevation service returned '+r.status);return r;}finally{clearTimeout(timer);}}
async function raster(url){const response=await request(url,120000),tiff=await GeoTIFF.fromArrayBuffer(await response.arrayBuffer()),image=await tiff.getImage(),values=await image.readRasters({interleave:true});if(image.getSamplesPerPixel()!==1)throw Error('Elevation service did not return a single-band raster.');return {data:new Float32Array(values),width:image.getWidth(),height:image.getHeight()};}
async function parallel(items,fn){let next=0;await Promise.all(Array.from({length:Math.min(6,items.length)},async()=>{while(next<items.length)await fn(items[next++]);}));}
class Tiles{
 constructor(lat,lon,zoom,source){this.zoom=zoom;this.n=2**zoom;this.spacing=156543.03*Math.cos(lat*Math.PI/180)/this.n;const inUS=(lat>=24&&lat<=50&&lon>=-126&&lon<=-66)||(lat>=50&&lat<=72&&lon>=-180&&lon<=-129)||(lat>=18&&lat<=23&&lon>=-161&&lon<=-154)||(lat>=17&&lat<=19&&lon>=-68&&lon<=-64);this.source=source==='usgs'||(source==='auto'&&inUS)?'usgs':'global';this.used=new Set();this.tiles=new Map();}
 key(x,y){return ((x%this.n+this.n)%this.n)+','+Math.max(0,Math.min(this.n-1,y));}
 async tile(key){
  if(this.tiles.has(key))return this.tiles.get(key);if(this.tiles.size>=512)throw Error('Terrain tile limit reached. Reduce range or detail.');
  const [x,y]=key.split(',').map(Number),cacheKey='tile:v1:'+this.source+':'+this.zoom+':'+key;let value=await WebCache.get(cacheKey);
  if(!value){let data,source=this.source;
   try{if(source!=='usgs')throw Error('global source');const extent=20037508.342789244,size=2*extent/this.n,west=-extent+x*size,north=extent-y*size,params=new URLSearchParams({f:'image',bbox:[west,north-size,west+size,north].join(','),bboxSR:'3857',imageSR:'3857',size:'256,256',format:'tiff',pixelType:'F32',noData:'-999999',interpolation:'RSP_BilinearInterpolation',renderingRule:'{"rasterFunction":"None"}'}),decoded=await raster(USGS+'?'+params);if(decoded.width!==256||decoded.height!==256||decoded.data.some(v=>!Number.isFinite(v)||v< -12000))throw Error('Invalid USGS elevations');data=decoded.data;}
   catch(error){source='global';const response=await request('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/'+this.zoom+'/'+x+'/'+y+'.png'),bitmap=await createImageBitmap(await response.blob()),canvas=new OffscreenCanvas(256,256),ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);bitmap.close();const rgb=ctx.getImageData(0,0,256,256).data;data=new Float32Array(65536);for(let i=0;i<data.length;i++)data[i]=rgb[i*4]*256+rgb[i*4+1]+rgb[i*4+2]/256-32768;}
   value={data,source};await WebCache.put(cacheKey,value,data.byteLength);
  }
  this.used.add(value.source);this.tiles.set(key,value.data);return value.data;
 }
 async sampleMany(points){
  const px=new Float64Array(points.length),py=new Float64Array(points.length),keys=new Set();
  for(let i=0;i<points.length;i++){const p=BrowserTerrain.pixels(points[i][0],points[i][1],this.zoom);px[i]=p[0]-.5;py[i]=p[1]-.5;const x=Math.floor(px[i]),y=Math.floor(py[i]);for(const dx of [0,1])for(const dy of [0,1])keys.add(this.key(Math.floor((x+dx)/256),Math.floor((y+dy)/256)));}
  if(this.tiles.size+[...keys].filter(key=>!this.tiles.has(key)).length>512)throw Error('Terrain tile limit reached. Reduce range or detail.');
  await parallel([...keys],key=>this.tile(key));
  const values=new Float64Array(points.length);
  for(let i=0;i<points.length;i++){const ix=Math.floor(px[i]),iy=Math.floor(py[i]),fx=px[i]-ix,fy=py[i]-iy;for(const dx of [0,1])for(const dy of [0,1]){const x=ix+dx,y=iy+dy,tile=this.tiles.get(this.key(Math.floor(x/256),Math.floor(y/256)));values[i]+=tile[((y%256+256)%256)*256+((x%256+256)%256)]*(dx?fx:1-fx)*(dy?fy:1-fy);}}
  return values;
 }
}
class Polar{
 static async create(lat,lon,radius){
  const crs=lat>=0?'EPSG:3413':'EPSG:3031';proj4.defs('EPSG:3413','+proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +datum=WGS84 +units=m +no_defs');proj4.defs('EPSG:3031','+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +datum=WGS84 +units=m +no_defs');
  const [x,y]=proj4('EPSG:4326',crs,[lon,lat]),extent=Math.max(10000,radius*2000),box=[x-extent,y-extent,x+extent,y+extent],key='polar:v1:'+crs+':'+box.join(',');let image=await WebCache.get(key);
  if(!image){image=await raster(NOAA+'?'+new URLSearchParams({f:'image',bbox:box.join(','),bboxSR:crs.slice(5),imageSR:crs.slice(5),size:'2048,2048',format:'tiff',pixelType:'F32',noData:'-999999',interpolation:'RSP_BilinearInterpolation',renderingRule:'{"rasterFunction":"None"}'}));await WebCache.put(key,image,image.data.byteLength);}
  const result=new Polar();Object.assign(result,{image,crs,box,spacing:2*extent/image.width,used:new Set(['NOAA polar mosaic'])});return result;
 }
 async sampleMany(points){const {data,width,height}=this.image,[left,bottom,right,top]=this.box,out=new Float64Array(points.length);for(let i=0;i<points.length;i++){const p=proj4('EPSG:4326',this.crs,[points[i][1],points[i][0]]),x=(p[0]-left)/(right-left)*width-.5,y=(top-p[1])/(top-bottom)*height-.5,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;if(ix<0||iy<0||ix+1>=width||iy+1>=height)throw Error('Polar DEM does not cover this search radius.');for(const dx of [0,1])for(const dy of [0,1]){const v=data[(iy+dy)*width+ix+dx];if(!Number.isFinite(v)||v< -12000)throw Error('Polar elevation service returned missing data.');out[i]+=Math.max(0,v)*(dx?fx:1-fx)*(dy?fy:1-fy);}}return out;}
}
self.onmessage=async event=>{
 const {id,input}=event.data,progress=message=>self.postMessage({id,status:'running',message});
 try{
  const {lat,lon,height,radius,zoom,source,date}=input;for(const [value,min,max] of [[lat,-90,90],[lon,-180,180],[height,0,10000],[radius,5,200],[zoom,9,13]])if(!Number.isFinite(value)||value<min||value>max)throw Error('Invalid location or terrain settings.');
  const identity=JSON.stringify([1,lat,lon,height,radius,zoom,source]),resultKey='result:'+identity+':'+date;let result=await WebCache.get(resultKey);
  if(!result){progress('Loading cached terrain or downloading elevation tiles...');let terrain=await WebCache.get('horizon:'+identity);
   if(!terrain){const provider=Math.abs(lat)>80?await Polar.create(lat,lon,radius):new Tiles(lat,lon,zoom,source);if(Math.abs(lat)<=80&&Math.PI*(radius*1000/(provider.spacing*256))**2>512)throw Error('This range/detail needs too many tiles. Reduce range or detail.');terrain=await BrowserTerrain.trace(provider,lat,lon,height,radius,progress);await WebCache.put('horizon:'+identity,terrain);}
   progress('Solving terrain-adjusted sunrise and sunset in your browser...');result=BrowserSolar.calculate(lat,lon,date,tzlookup(lat,lon),terrain);await WebCache.put(resultKey,result);
  }
  self.postMessage({id,status:'done',message:'Ready - calculated in this browser',result,signature:[lat,lon,height,radius,zoom,source,date]});
 }catch(error){self.postMessage({id,status:'error',message:'Calculation failed; the previous image is retained.',error:error.message||String(error)});}
};
