const assert=require('assert'),{policy}=require('./viewport-policy');
for(const [w,h] of [[320,568],[390,844],[430,932]]){const p=policy(w,h);assert.strictEqual(p.profile,'phone-portrait');assert(p.initial>=240&&p.initial<=360);}
for(const [w,h] of [[568,320],[844,390],[932,430]]){const p=policy(w,h);assert.strictEqual(p.profile,'phone-landscape');assert(p.initial+140<=h);assert(p.maximum+140<=h);}
assert.strictEqual(policy(1440,900).profile,'desktop');
assert.notStrictEqual(policy(390,844).profile,policy(844,390).profile);
console.log('Phone portrait/landscape sizing, rotation profiles and desktop layout passed.');
