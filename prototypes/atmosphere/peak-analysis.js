(function(root){
 function peak(samples,minimum=12){
  if(!samples.length)return null;
  const best=samples.reduce((a,b)=>a.potential>=b.potential?a:b);
  return Number.isFinite(best.potential)&&best.potential>=minimum?best:null;
 }
 function windowAround(samples,selected,minutes){
  if(!selected||!samples.length)return null;
  const half=Math.max(1,Math.min(45,Number(minutes)||10))*60000;
  return [Math.max(samples[0].t,selected.t-half),Math.min(samples[samples.length-1].t,selected.t+half)];
 }
 const api={peak,windowAround};root.PeakAnalysis=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
