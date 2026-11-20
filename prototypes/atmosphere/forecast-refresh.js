(function(root){
 const freshness=30*60000,retryDelay=5*60000;
 function needed(s){
  if(!s.enabled||!s.ready||s.pending||s.now<s.retryAt)return false;
  return !s.hasData||s.target!==s.dataSite||s.now-s.fetchedAt>=freshness||(!s.covered&&s.now-s.lastAttempt>=freshness);
 }
 const api={needed,freshness,retryDelay};root.ForecastRefresh=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
