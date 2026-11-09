/* Atmospheric optical glare and optional illustrative pines; independent of solar timing. */
const SceneEffects=(()=>{
 let settings={rays:true,trees:false,strength:65};const sprites=new Map();
 function horizonAt(az,profile){const n=profile.length,p=((az%360+360)%360)/360*n,i=Math.floor(p);return profile[i]+(profile[(i+1)%n]-profile[i])*(p-i);}
 function visibleFraction(sun,profile){
  let visible=0,total=0;
  for(let i=0;i<41;i++){const dx=((i+.5)/41*2-1)*sun.radius,half=Math.sqrt(Math.max(0,sun.radius*sun.radius-dx*dx));const edge=horizonAt(sun.az+dx,profile);total+=2*half;visible+=Math.max(0,Math.min(2*half,sun.alt+half-edge));}
  return total?visible/total:0;
 }
 function glare(ctx,sun,profile,sx,sy,sr,w,h){
  if(!settings.rays||settings.strength===0||sx<-.3*w||sx>1.3*w)return;
  const visible=visibleFraction(sun,profile);if(visible<=0)return;
  const contact=Math.exp(-Math.abs(sun.alt-horizonAt(sun.az,profile))/3);
  const power=Math.sqrt(visible)*(settings.strength/100)*(.3+.7*contact),radius=Math.max(sr*14,w*.085);
  ctx.save();ctx.globalCompositeOperation='screen';
  const halo=ctx.createRadialGradient(sx,sy,0,sx,sy,radius*1.8);
  halo.addColorStop(0,`rgba(255,253,226,${Math.min(1,power*1.8)})`);halo.addColorStop(.10,`rgba(255,249,213,${power*.85})`);halo.addColorStop(.32,`rgba(255,239,189,${power*.28})`);halo.addColorStop(1,'rgba(255,240,200,0)');
  ctx.fillStyle=halo;ctx.fillRect(sx-radius*1.8,sy-radius*1.8,radius*3.6,radius*3.6);
  // Soft, uneven lens rays: a pale flare, not opaque triangular light beams.
  for(let i=0;i<10;i++){
   const angle=i*Math.PI*2/10+.21,len=radius*(.8+.65*(.5+.5*Math.sin(i*7.13))),spread=.06+(i%3)*.025;
   ctx.save();ctx.translate(sx,sy);ctx.rotate(angle);
   const beam=ctx.createLinearGradient(0,0,len,0);beam.addColorStop(0,`rgba(255,255,236,${power*.085})`);beam.addColorStop(.22,`rgba(255,248,213,${power*.035})`);beam.addColorStop(1,'rgba(255,245,210,0)');
   ctx.fillStyle=beam;ctx.beginPath();ctx.moveTo(sr*.25,-sr*.25);ctx.quadraticCurveTo(len*.35,-len*spread,len,0);ctx.quadraticCurveTo(len*.35,len*spread,sr*.25,sr*.25);ctx.closePath();ctx.fill();ctx.restore();
  }
  const core=ctx.createRadialGradient(sx,sy,0,sx,sy,sr*6);core.addColorStop(0,`rgba(255,255,249,${Math.min(1,power*2)})`);core.addColorStop(.3,`rgba(255,255,240,${Math.min(1,power*1.6)})`);core.addColorStop(1,'rgba(255,250,220,0)');ctx.fillStyle=core;ctx.fillRect(sx-sr*6,sy-sr*6,sr*12,sr*12);ctx.restore();
 }
 function pineSprite(variant,daylight){
  const shade=Math.round(daylight*5),key=variant+':'+shade;if(sprites.has(key))return sprites.get(key);
  if(sprites.size>18)sprites.clear();
  const canvas=document.createElement('canvas');canvas.width=440;canvas.height=650;const c=canvas.getContext('2d');
  let seed=variant*1297+19;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const light=shade/5;c.lineCap='round';
  c.strokeStyle=`rgb(${10+light*13},${17+light*15},${19+light*18})`;
  const trunkX=y=>220+Math.sin(y*.004+variant)*13;
  c.lineWidth=9;c.beginPath();c.moveTo(trunkX(650),650);c.bezierCurveTo(215,440,234,220,220,22);c.stroke();
  function tuft(x,y,size){
   c.fillStyle=`rgba(${12+light*13|0},${24+light*17|0},${24+light*21|0},.9)`;
   for(let n=0;n<7;n++){const a=random()*Math.PI*2,r=random()*size;c.beginPath();c.ellipse(x+Math.cos(a)*r,y+Math.sin(a)*r*.45,size*(.3+random()*.3),size*(.12+random()*.12),a*.25,0,Math.PI*2);c.fill();}
   c.strokeStyle=`rgba(${23+light*13|0},${37+light*18|0},${35+light*24|0},.55)`;c.lineWidth=.8;
   for(let n=0;n<12;n++){const a=random()*Math.PI*2,r=random()*size;c.beginPath();c.moveTo(x+Math.cos(a)*r*.3,y+Math.sin(a)*r*.2);c.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r*.55);c.stroke();}
  }
  for(let level=0;level<22;level++){
   const y=55+level*24,reach=18+Math.pow(level/21,.8)*165;
   for(const side of [-1,1]){
    const length=reach*(.6+random()*.4),tipX=trunkX(y)+side*length,tipY=y-15-random()*35;
    c.strokeStyle=`rgb(${12+light*13},${20+light*14},${21+light*17})`;c.lineWidth=1+level*.14;c.beginPath();c.moveTo(trunkX(y),y+18);c.quadraticCurveTo(trunkX(y)+side*length*.7,y+22,tipX,tipY);c.stroke();
    for(let j=1;j<=5;j++){const t=j/5,xx=trunkX(y)+(tipX-trunkX(y))*t,yy=y+(tipY-y)*t;tuft(xx,yy,11+random()*12);}
   }
  }
  sprites.set(key,canvas);return canvas;
 }
 function foregroundSize(tree,scale,w,h){
  // The reference proportions were calibrated at 75 degrees. Both dimensions
  // must scale with pixels per degree, not just the crown width.
  return {height:h*tree.height*75*scale/Math.max(1,w),width:tree.widthDegrees*scale};
 }
 function trees(ctx,profile,focus,scale,base,w,h,daylight){
  if(!settings.trees)return;
  const xFor=az=>w/2+(((az-focus+540)%360)-180)*scale;
  // Sparse small pines on the western ridge, and nearby irregular pines at the edges.
  // Optional illustrative vegetation is distributed uniformly around the
  // observer, with no site-specific photographs or fixed landmark bearings.
  for(let i=0;i<24;i++){
   const az=i*15+Math.sin(i*7.1)*3,height=h*(.18+.15*(.5+.5*Math.sin(i*3.7)))*75/(w/scale);
   const width=height*.8,x=xFor(az);if(x+width/2<0||x-width/2>w)continue;
   ctx.drawImage(pineSprite(i%3+1,daylight),x-width/2,h-height,width,height);
  }
 }
 function update(value){settings=value;if(typeof draw==='function')draw();}
 return {glare,trees,visibleFraction,horizonAt,foregroundSize,update};
})();
(function(){
 const el=id=>document.getElementById(id);let revision=-1,settings=null,dirty=false,saving=false,timer=null;
 function read(){return {sky_labels:el('sceneSkyLabels').checked,clock12:el('sceneClock12').checked,sky_only:el('sceneSkyOnly').checked,rays:el('sceneRays').checked,trees:el('sceneTrees').checked,strength:Number(el('sceneStrength').value)};}
 function apply(state,fill=true){settings=state;document.body.dataset.skyLabels=String(state.sky_labels===true);document.body.dataset.clock12=String(state.clock12===true);if(typeof refreshTimeLabels==='function')refreshTimeLabels();document.body.classList.toggle('sky-only',state.sky_only===true);SceneEffects.update(state);if(fill){el('sceneSkyLabels').checked=state.sky_labels===true;el('sceneClock12').checked=state.clock12===true;el('sceneSkyOnly').checked=state.sky_only===true;el('sceneRays').checked=state.rays;el('sceneTrees').checked=state.trees;el('sceneStrength').value=state.strength;}el('sceneStrengthValue').textContent=state.strength+'%';try{localStorage.setItem('localsunset.sceneStyle.v1',JSON.stringify(state));}catch(error){}}
 async function save(){
  if(saving)return;saving=true;dirty=false;
  try{const response=await fetch('/api/scene-style',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(read())}),state=await response.json();if(!response.ok)throw Error(state.error);revision=state.revision;el('sceneStyleStatus').textContent='Appearance saved. Projector updates automatically.';}
  catch(error){el('sceneStyleStatus').textContent='Not saved: '+error.message;}
  finally{saving=false;if(dirty)save();}
 }
 function changed(){dirty=true;apply(read(),false);el('sceneStyleStatus').textContent='Saving appearance...';clearTimeout(timer);timer=setTimeout(save,250);}
 async function activateSkyOnly(){
  changed();
  if(el('sceneSkyOnly').checked&&typeof chooseRealtime==='function'&&!realTimeView&&!realtimeRequested)await chooseRealtime();
 }
 el('sceneSkyOnly').addEventListener('change',activateSkyOnly);
 el('projectorSkyOnly').onclick=()=>{el('sceneSkyOnly').checked=true;activateSkyOnly();};
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('sky-only')){event.preventDefault();event.stopImmediatePropagation();el('sceneSkyOnly').checked=false;changed();}});
 for(const id of ['sceneRays','sceneTrees','sceneClock12','sceneSkyLabels'])el(id).addEventListener('change',changed);
 el('sceneStrength').addEventListener('input',changed);
 async function poll(){
  if(dirty||saving)return;
  try{const response=await fetch('/api/scene-style');if(!response.ok)throw Error('Connection failed');const state=await response.json();if(state.revision!==revision){revision=state.revision;apply(state);}el('sceneStyleStatus').textContent='Ready. Appearance changes save automatically.';}
  catch(error){el('sceneStyleStatus').textContent='Cannot load appearance: '+error.message;}
 }
 try{const cached=JSON.parse(localStorage.getItem('localsunset.sceneStyle.v1')||'null');if(cached)apply(cached);}catch(error){}
 poll();setInterval(poll,1500);
})();
