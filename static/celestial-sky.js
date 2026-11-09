/* Catalog stars and topocentric planets. See THIRD-PARTY.md for sources/licenses. */
const CelestialSky=(()=>{
 const A=Astronomy,DEG=180/Math.PI,J2000=Date.UTC(2000,0,1,12),C=173.1446326846693;
 const planets=['Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune'];
 const planetColors={Mercury:[220,215,207],Venus:[255,246,220],Mars:[255,172,119],Jupiter:[255,231,199],Saturn:[246,224,174],Uranus:[175,227,236],Neptune:[137,172,249]};
 let cached=null,cacheKey='';
 function starColor(bv){const warm=Math.max(0,Math.min(1,bv/1.8)),blue=Math.max(0,Math.min(1,-bv/.4));return [Math.round(245+10*warm-65*blue),Math.round(245-55*warm-35*blue),Math.round(245-110*warm+10*blue)];}
 function snapshot(ms,lat,lon,height){
  // 1-second simulation bins: no network requests, including during scrubbing.
  const key=[Math.floor(ms/1000),lat,lon,height].join(':');if(key===cacheKey)return cached;
  const time=A.MakeTime((ms-J2000)/86400000),observer=new A.Observer(lat,lon,height),rotation=A.Rotation_EQJ_HOR(time,observer).rot,earth=A.BaryState('Earth',time),years=time.ut/365.25;
  const beta=[earth.vx/C,earth.vy/C,earth.vz/C],points=[];
  for(const s of StarCatalog){
   // Catalog Cartesian proper motion and annual parallax, then aberration.
   let x=s[4]+s[7]*years-earth.x*s[10],y=s[5]+s[8]*years-earth.y*s[10],z=s[6]+s[9]*years-earth.z*s[10];
   const length=Math.hypot(x,y,z);x/=length;y/=length;z/=length;
   const dot=x*beta[0]+y*beta[1]+z*beta[2];x+=beta[0]-x*dot;y+=beta[1]-y*dot;z+=beta[2]-z*dot;
   const north=rotation[0][0]*x+rotation[1][0]*y+rotation[2][0]*z,west=rotation[0][1]*x+rotation[1][1]*y+rotation[2][1]*z,up=rotation[0][2]*x+rotation[1][2]*y+rotation[2][2]*z;
   let alt=Math.atan2(up,Math.hypot(north,west))*DEG;if(alt< -1.5)continue;alt+=A.Refraction('normal',alt);
   if(alt< -1)continue;
   points.push({id:s[0],name:s[1],az:(Math.atan2(-west,north)*DEG+360)%360,alt,mag:s[2],color:starColor(s[3]),planet:false});
  }
  for(const body of planets){
   const equ=A.Equator(body,time,observer,true,true),hor=A.Horizon(time,observer,equ.ra,equ.dec,'normal'),light=A.Illumination(body,time);
   points.push({name:body,az:hor.azimuth,alt:hor.altitude,mag:light.mag,color:planetColors[body],planet:true});
  }
  cacheKey=key;cached=points;return points;
 }
 function limitingMagnitude(sunAltitude){
  if(sunAltitude>=0)return -3.5;
  if(sunAltitude>=-6)return -3.5+(-sunAltitude/6)*5;
  if(sunAltitude>=-12)return 1.5+(-sunAltitude-6)/6*3.3;
  return Math.min(6,4.8+(-sunAltitude-12)/6*1.2);
 }
 function aboveTerrain(point,profile){const u=((point.az%360+360)%360)/360*profile.length,i=Math.floor(u);return point.alt>profile[i]+(profile[(i+1)%profile.length]-profile[i])*(u-i);}
 function draw(ctx,ms,site,height,sunAltitude,focus,scale,base,w,h,profile){
  const points=snapshot(ms,site.lat,site.lon,height),limit=limitingMagnitude(sunAltitude);
  const labels=document.body.dataset.skyLabels==='true'&&!(document.body.classList.contains('projector')&&document.body.classList.contains('sky-only'));
  ctx.save();
  for(const p of points){
   if(p.alt<-.8||!aboveTerrain(p,profile))continue;
   const delta=((p.az-focus+540)%360)-180,x=w/2+delta*scale,y=base-p.alt*scale;
   if(x< -10||x>w+10||y< -10||y>h+10)continue;
   const airmass=1/(Math.sin(Math.max(.1,p.alt)/DEG)+.50572*Math.pow(Math.max(.1,p.alt)+6.07995,-1.6364));
   const mag=p.mag+.18*(airmass-1);if(mag>limit)continue;
   const alpha=Math.max(.08,Math.min(1,(limit-mag+.5)/3)),radius=Math.max(.5,Math.min(2.3,.55+(2.5-mag)*.2)),rgb=p.color.join(',');
   if(mag<.5){const halo=ctx.createRadialGradient(x,y,0,x,y,radius*4);halo.addColorStop(0,'rgba('+rgb+','+alpha*.24+')');halo.addColorStop(1,'rgba('+rgb+',0)');ctx.fillStyle=halo;ctx.fillRect(x-radius*4,y-radius*4,radius*8,radius*8);}
   ctx.fillStyle='rgba('+rgb+','+alpha+')';ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
   if(labels&&(p.planet||p.mag<1.1)){ctx.font='12px sans-serif';ctx.fillStyle='rgba(230,236,242,'+alpha*.9+')';ctx.fillText(p.name,x+radius+5,y-5);}
  }
  ctx.restore();
 }
 return {snapshot,draw,limitingMagnitude,aboveTerrain};
})();
