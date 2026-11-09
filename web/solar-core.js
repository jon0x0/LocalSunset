/* Browser-only solar event solver; uses the same search contract as solar.py. */
const BrowserSolar=(()=>{
 const A=Astronomy,J2000=Date.UTC(2000,0,1,12);
 function dateParts(ms,zone){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));}
 function midnight(date,zone){const [year,month,day]=date.split('-').map(Number),target=Date.UTC(year,month-1,day);let guess=target;for(let i=0;i<8;i++){const p=dateParts(guess,zone),actual=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour%24,+p.minute,+p.second),delta=target-actual;if(!delta)return guess;guess+=delta;}throw Error('This local date does not exist in the selected time zone.');}
 function nextDate(date){const [y,m,d]=date.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+1)).toISOString().slice(0,10);}
 function sunAt(ms,observer){const time=A.MakeTime((ms-J2000)/86400000),equ=A.Equator('Sun',time,observer,true,true),hor=A.Horizon(time,observer,equ.ra,equ.dec,'normal');return {az:hor.azimuth,alt:hor.altitude,radius:Math.asin(695700/(equ.dist*149597870.7))*180/Math.PI};}
 function clearance(sun,profile){let highest=-Infinity;for(let i=0;i<65;i++){const offset=(-1+2*i/64)*sun.radius,az=(sun.az+offset/Math.max(.01,Math.cos(sun.alt*Math.PI/180))+360)%360,p=az/360*profile.length,j=Math.floor(p),edge=profile[j]+(profile[(j+1)%profile.length]-profile[j])*(p-j);highest=Math.max(highest,sun.alt+Math.sqrt(Math.max(0,sun.radius**2-offset**2))-edge);}return highest;}
 function localISO(ms,zone){const p=dateParts(ms,zone);return p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':'+p.second;}
 function calculate(lat,lon,date,zone,terrain){
  const start=midnight(date,zone),end=midnight(nextDate(date),zone),observer=new A.Observer(lat,lon,terrain.observer_m),timeline=[],events=[];
  const evaluate=ms=>{const sun=sunAt(ms,observer);return {...sun,clearance:clearance(sun,terrain.horizon)};};
  let previous=evaluate(start).clearance,visible=previous>0,count=0;
  for(let ms=start;ms<=end;ms+=15000){const sun=evaluate(ms);if(ms>start&&(previous>0)!==(sun.clearance>0)){let lo=ms-15000,hi=ms;const wasVisible=previous>0;while(hi-lo>125){const mid=(hi+lo)/2;if((evaluate(mid).clearance>0)===wasVisible)lo=mid;else hi=mid;}const t=(lo+hi)/2;events.push({kind:wasVisible?'disappearance':'appearance',utc:new Date(t).toISOString(),local:localISO(t,zone),azimuth:evaluate(t).az});}if(count%2===0)timeline.push({t:ms,az:sun.az,alt:sun.alt,radius:sun.radius,visible:sun.clearance>0});previous=sun.clearance;visible=previous>0;count++;}
  const appearances=events.filter(e=>e.kind==='appearance'),losses=events.filter(e=>e.kind==='disappearance');
  return {timezone:zone,events,sunrise:appearances[0]||null,sunset:losses[losses.length-1]||null,status:events.length?'events':visible?'sun_visible_all_day':'sun_hidden_all_day',timeline,terrain,assumptions:['Standard atmospheric refraction; no live weather.','Bare-earth terrain: buildings, vegetation and clouds excluded.','15-second event search, 0.125-second root refinement; tiny visibility windows may be missed.','65 solar disk slices; terrain horizon sampled every 0.25 degrees.','Terrain beyond '+terrain.radius_km+' km is assumed at sea level.','Displayed seconds are numerical precision, not guaranteed observational accuracy.','Calculated entirely in this browser.']};
 }
 return {midnight,nextDate,sunAt,clearance,calculate};
})();
