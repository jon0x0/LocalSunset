const assert=require('assert'),P=require('./forecast-refresh');
const s={enabled:true,ready:true,pending:false,now:10000000,retryAt:0,hasData:true,target:'A',dataSite:'A',fetchedAt:9999999,covered:true,lastAttempt:9999999};
assert.strictEqual(P.needed(s),false);
assert(P.needed({...s,hasData:false}));assert(P.needed({...s,target:'B'}));
assert(P.needed({...s,fetchedAt:s.now-P.freshness}));
assert(P.needed({...s,covered:false,lastAttempt:0}));
assert.strictEqual(P.needed({...s,covered:false}),false,'unavailable coverage does not loop');
for(const change of [{enabled:false},{ready:false},{pending:true},{retryAt:s.now+1}])assert.strictEqual(P.needed({...s,...change,hasData:false}),false);
console.log('Forecast freshness, location/coverage changes, request deduplication, opt-out and retry backoff passed.');
