(function(root){
 function hold(previous,current){return !!previous&&previous.site===current.site&&Math.abs(previous.time-current.time)<120000&&Math.abs(previous.sunAlt-current.sunAlt)<.25&&current.waitMs<15000;}
 const api={hold};root.SkyFramePolicy=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
