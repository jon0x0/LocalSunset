/* Experimental spherical single-scattering model. Distances in km; RGB at
 * 680/550/440 nm. No fitted twilight palette or beauty-training data. */
(function(root){
 'use strict';
 const R=6371,TOP=6471,D=Math.PI/180,BR=[.0058,.0135,.0331],BM=[1,1,1].map((_,i)=>Math.pow(550/[680,550,440][i],1.3));
 const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),add=(a,b,t)=>a.map((v,i)=>v+b[i]*t);
 function exit(p,v,r){const b=dot(p,v);return -b+Math.sqrt(Math.max(0,b*b+r*r-dot(p,p)));}
 function density(p){const h=Math.max(0,Math.hypot(...p)-R);return [Math.exp(-h/8),Math.exp(-h/1.2)];}
 function sunlight(p,s,aod){const b=dot(p,s),disc=b*b-(dot(p,p)-R*R);if(b<0&&disc>0)return [0,0,0];const length=exit(p,s,TOP),ds=length/20;let r=0,m=0;for(let j=0;j<20;j++){const d=density(add(p,s,(j+.5)*ds));r+=d[0]*ds;m+=d[1]*ds;}return BR.map((k,i)=>Math.exp(-k*r-aod/1.2*BM[i]*m));}
 function radiance(alt,relativeAz,sunAlt,aod=.12,height=0,options=null){
  if(options?.spectral&&typeof SpectralSky!=='undefined')return SpectralSky.radiance(alt,relativeAz,sunAlt,aod,height,options);
  const p=[0,0,R+Math.max(.001,height/1000)],v=[Math.cos(alt*D)*Math.cos(relativeAz*D),Math.cos(alt*D)*Math.sin(relativeAz*D),Math.sin(alt*D)],s=[Math.cos(sunAlt*D),0,Math.sin(sunAlt*D)];
  const mu=dot(v,s),pr=3/(16*Math.PI)*(1+mu*mu),g=.76,pm=(1-g*g)/(4*Math.PI*Math.pow(1+g*g-2*g*mu,1.5));
  const ds=exit(p,v,TOP)/24,out=[0,0,0];let r=0,m=0;
  for(let j=0;j<24;j++){const q=add(p,v,(j+.5)*ds),d=density(q),t=sunlight(q,s,aod);for(let i=0;i<3;i++)out[i]+=t[i]*Math.exp(-BR[i]*(r+d[0]*ds/2)-aod/1.2*BM[i]*(m+d[1]*ds/2))*(BR[i]*d[0]*pr+aod/1.2*BM[i]*d[1]*pm)*ds;r+=d[0]*ds;m+=d[1]*ds;}
  return out;
 }
 function display(rgb,exposure=14){return rgb.map(v=>Math.round(255*Math.pow(1-Math.exp(-Math.max(0,v)*exposure),1/2.2)));}
 function metrics(rgb){const luminance=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2],max=Math.max(...rgb),min=Math.min(...rgb),chroma=max? (max-min)/max:0;const brightnessWeight=1-Math.exp(-luminance*35),warmth=max?Math.max(0,rgb[0]-rgb[2])/max:0;return {luminance,chroma,colorfulness:100*chroma,warmStrength:100*warmth*brightnessWeight,potential:100*chroma*brightnessWeight};}
 function windows(samples){const peak=Math.max(...samples.map(s=>s.potential)),threshold=Math.max(12,.8*peak),out=[];let start=null;for(let i=0;i<samples.length;i++){if(samples[i].potential>=threshold){if(start===null)start=i;}else if(start!==null){out.push([samples[start].t,samples[i-1].t]);start=null;}}if(start!==null)out.push([samples[start].t,samples[samples.length-1].t]);return out;}
 // Cloud amounts constrain an illustrative scene, not retrieved cloud geometry.
 function weatherAt(data,t){if(!data||!data.hourly)return null;const h=data.hourly,times=h.time.map(v=>Date.parse(v+'Z'));if(t<times[0]||t>times[times.length-1])return null;let i=0;while(i+1<times.length&&times[i+1]<=t)i++;const j=Math.min(i+1,times.length-1),f=j===i?0:(t-times[i])/(times[j]-times[i]),get=k=>{const a=h[k]&&h[k][i],b=h[k]&&h[k][j];return Number.isFinite(a)&&Number.isFinite(b)?a+(b-a)*f:null;};const a=h.wind_direction_10m?.[i],b=h.wind_direction_10m?.[j],direction=Number.isFinite(a)&&Number.isFinite(b)?((a+((b-a+540)%360-180)*f)%360+360)%360:null;const k=f===0?i:j,bucket=name=>Number.isFinite(h[name]?.[k])?h[name][k]:null;return {precipitation:bucket('precipitation'),precipitationProbability:bucket('precipitation_probability'),rain:bucket('rain'),showers:bucket('showers'),snowfall:bucket('snowfall'),precipitationStart:times[k]-3600000,precipitationEnd:times[k],windSpeed:get('wind_speed_10m'),windDirection:direction,temperature:get('temperature_2m'),total:get('cloud_cover'),low:get('cloud_cover_low'),mid:get('cloud_cover_mid'),high:get('cloud_cover_high'),humidity:get('relative_humidity_2m'),visibility:get('visibility')};}
 const api={radiance,display,metrics,windows,weatherAt};root.GlowModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
