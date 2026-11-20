/* Marker order keeps an overlapping selected-time cursor from hiding the peak. */
(function(root){
 function markers(a,selected,mode='sunset',window=null){return [
  {t:a.astro,label:mode==='sunrise'?'Astronomical sunrise':'Astronomical sunset',color:'#79a7ff',width:2},
  {t:a.contact,label:'Terrain contact',color:'#b4bec8',width:2},
  {t:a.peak?a.peak.t:null,label:'Color peak',color:'#00f050',width:1.5},
  {t:window?window[0]:null,label:'Window start',color:'#93cbb2',width:1},
  {t:window?window[1]:null,label:'Window end',color:'#93cbb2',width:1},
  {t:selected,label:'Selected time',color:'#ffffff',width:1,selected:true}
 ].filter(m=>Number.isFinite(m.t));}
 function draw(g,list,x,w,top,bottom,stamp){
  const positioned=list.map((m,i)=>{const raw=x(m.t),xx=Math.max(1,Math.min(w-1,raw)),text=m.label+' · '+stamp(m.t)+(raw<0||raw>w?' · off chart':'');g.font='12px system-ui';const tw=g.measureText(text).width,left=Math.max(7,Math.min(w-tw-7,xx-tw/2));return {...m,x:xx,text,left,tw,y:14+i*18};});
  // Coincident times share the green peak line; no stacked/dotted cursor.
  const peak=positioned.find(m=>m.label==='Color peak');
  for(const m of positioned){
   if(m.selected&&peak&&Math.abs(m.x-peak.x)<2)continue;
   g.strokeStyle=m.color;g.lineWidth=m.width;g.setLineDash([]);g.beginPath();g.moveTo(m.x,top);g.lineTo(m.x,bottom);g.stroke();
  }
  g.setLineDash([]);g.lineWidth=1;
  for(const m of positioned){
   const fromX=m.left+m.tw/2,fromY=m.y+5,toY=top-4,angle=Math.atan2(toY-fromY,m.x-fromX);
   g.strokeStyle=m.color;g.fillStyle=m.color;g.beginPath();g.moveTo(fromX,fromY);g.lineTo(m.x,toY);g.stroke();g.beginPath();g.moveTo(m.x,toY);g.lineTo(m.x-6*Math.cos(angle-.45),toY-6*Math.sin(angle-.45));g.lineTo(m.x-6*Math.cos(angle+.45),toY-6*Math.sin(angle+.45));g.closePath();g.fill();
  }
  for(const m of positioned){g.fillStyle='#0d1720';g.fillRect(m.left-4,m.y-12,m.tw+8,17);g.fillStyle=m.color;g.font='12px system-ui';g.fillText(m.text,m.left,m.y);}
 }
 const api={markers,draw};root.ChartMarkers=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
