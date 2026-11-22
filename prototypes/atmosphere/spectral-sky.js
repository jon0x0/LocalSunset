/* Experimental 16-band spherical single scattering, 400–700 nm.
 * CIE analytic fits: Wyman, Sloan & Shirley (2013), JCGT 2(2).
 * Ozone: broad Chappuis envelope, NOT a laboratory cross-section table.
 * No clear-air multiple scattering or refraction. Distances km. */
(function(root){
 const R=6371,TOP=6471,D=Math.PI/180,W=Array.from({length:16},(_,i)=>400+20*i);
 const gauss=(l,m,a,b)=>Math.exp(-.5*((l-m)*(l<m?a:b))**2);
 const xyz=W.map(l=>[1.056*gauss(l,599.8,.0264,.0323)+.362*gauss(l,442,.0624,.0374)-.065*gauss(l,501.1,.049,.0382),.821*gauss(l,568.8,.0213,.0247)+.286*gauss(l,530.9,.0613,.0322),1.217*gauss(l,437,.0845,.0278)+.681*gauss(l,459,.0385,.0725)]);
 const norm=xyz.reduce((s,v)=>s+v[1],0),ray=W.map(l=>.0135*(550/l)**4),mie=W.map(l=>(550/l)**1.3),solar=W.map(l=>(550/l)**5*Math.expm1(1.4387769e7/(550*5778))/Math.expm1(1.4387769e7/(l*5778)));
 function toRGB(s){const v=[0,0,0];for(let k=0;k<W.length;k++)for(let i=0;i<3;i++)v[i]+=s[k]*xyz[k][i]/norm;return [3.2406*v[0]-1.5372*v[1]-.4986*v[2],-.9689*v[0]+1.8758*v[1]+.0415*v[2],.0557*v[0]-.204*v[1]+1.057*v[2]].map(x=>Math.max(0,x));}
 const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],add=(p,v,t)=>p.map((x,i)=>x+v[i]*t);
 function exit(p,v,r=TOP){const b=dot(p,v);return -b+Math.sqrt(Math.max(0,b*b+r*r-dot(p,p)));}
 function densities(p){const h=Math.max(0,Math.hypot(...p)-R);return [Math.exp(-h/8),Math.exp(-h/1.2),Math.exp(-.5*((h-25)/8)**2)/(8*Math.sqrt(2*Math.PI))];}
 function ozone(l,du){return Math.max(0,du)/300*.0416*Math.exp(-.5*((l-603)/55)**2);}
 function transmission(p,s,aod,du){const b=dot(p,s);if(b<0&&b*b-dot(p,p)+R*R>0)return W.map(()=>0);const ds=exit(p,s)/20,c=[0,0,0];for(let j=0;j<20;j++){const d=densities(add(p,s,(j+.5)*ds));for(let i=0;i<3;i++)c[i]+=d[i]*ds;}return W.map((l,i)=>Math.exp(-ray[i]*c[0]-aod/1.2*mie[i]*c[1]-ozone(l,du)*c[2]));}
 function radiance(alt,az,sunAlt,aod=.12,height=0,options={}){
  const du=options.ozoneDU??300,p=[0,0,R+Math.max(.001,height/1000)],v=[Math.cos(alt*D)*Math.cos(az*D),Math.cos(alt*D)*Math.sin(az*D),Math.sin(alt*D)],s=[Math.cos(sunAlt*D),0,Math.sin(sunAlt*D)],mu=dot(v,s),pr=3/(16*Math.PI)*(1+mu*mu),g=.76,pm=(1-g*g)/(4*Math.PI*(1+g*g-2*g*mu)**1.5),ds=exit(p,v)/24,out=W.map(()=>0),c=[0,0,0];
  for(let j=0;j<24;j++){const q=add(p,v,(j+.5)*ds),d=densities(q),light=transmission(q,s,aod,du);for(let i=0;i<W.length;i++)out[i]+=solar[i]*light[i]*Math.exp(-ray[i]*(c[0]+d[0]*ds/2)-aod/1.2*mie[i]*(c[1]+d[1]*ds/2)-ozone(W[i],du)*(c[2]+d[2]*ds/2))*(ray[i]*d[0]*pr+aod/1.2*mie[i]*d[1]*pm)*ds;for(let i=0;i<3;i++)c[i]+=d[i]*ds;}
  return toRGB(out);
 }
 const cloudCache=new Map();
 function cloudLight(sunAlt,height,aod,options={}){
  const key=[Math.round(sunAlt*10),Math.round(height/250),aod,options.ozoneDU??300].join('|');if(cloudCache.has(key))return cloudCache.get(key);
  const p=[0,0,R+Math.max(.001,height/1000)],s=[Math.cos(sunAlt*D),0,Math.sin(sunAlt*D)],direct=toRGB(transmission(p,s,aod,options.ozoneDU??300).map((v,i)=>v*solar[i])),diffuse=[0,0,0];
  for(const az of [0,90,180,270]){const sky=radiance(45,az,sunAlt,aod,height,options);for(let i=0;i<3;i++)diffuse[i]+=sky[i]/4;}
  const rgb=direct.map((v,i)=>v/(4*Math.PI)+diffuse[i]*.8);if(cloudCache.size>512)cloudCache.clear();cloudCache.set(key,rgb);return rgb;
 }
 function directLight(sunAlt,height,aod=.12,options={}){const p=[0,0,R+Math.max(.001,height/1000)],s=[Math.cos(sunAlt*D),0,Math.sin(sunAlt*D)];return toRGB(transmission(p,s,aod,options.ozoneDU??300).map((v,i)=>v*solar[i]));}
 // Cosine-weighted hemispheric irradiance using Gauss quadrature in sin(elevation).
 // Azimuths are relative to the Sun; no camera-heading dependence.
 function skyIrradiance(sunAlt,height,aod=.12,options={}){const out=[0,0,0],nodes=[.1127016654,.5,.8872983346],weights=[5/18,8/18,5/18];
  for(let j=0;j<3;j++)for(const az of [0,90,180,270]){const rgb=radiance(Math.asin(nodes[j])/D,az,sunAlt,aod,height,options);for(let c=0;c<3;c++)out[c]+=rgb[c]*nodes[j]*weights[j]*Math.PI/2;}
  return out;
 }
 const api={skyIrradiance,directLight,radiance,cloudLight,toRGB,wavelengths:W,ozone};root.SpectralSky=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
