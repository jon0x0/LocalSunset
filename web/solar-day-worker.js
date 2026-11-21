/* Adjacent-date events reuse the current horizon; no terrain/network downloads. */
importScripts('vendor/astronomy.browser.min.js','solar-core.js');
self.onmessage=({data:p})=>{
 try{self.postMessage({id:p.id,result:BrowserSolar.calculate(p.lat,p.lon,p.date,p.zone,p.terrain)});}
 catch(e){self.postMessage({id:p.id,error:e.message||String(e)});}
};
