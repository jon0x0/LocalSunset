const assert=require('node:assert/strict'),P=require('./sky-frame-policy.js');
const previous={site:'a',time:0,sunAlt:-8};
assert.equal(P.hold(previous,{site:'a',time:1000,sunAlt:-8,waitMs:1000}),true);
assert.equal(P.hold(previous,{site:'a',time:3600000,sunAlt:1,waitMs:1000}),false,'sunrise must not retain a night frame');
assert.equal(P.hold(previous,{site:'a',time:1000,sunAlt:-8,waitMs:15001}),false,'loading may not freeze sky indefinitely');
assert.equal(P.hold(previous,{site:'b',time:1000,sunAlt:-8,waitMs:1000}),false);
assert.equal(P.hold(null,{site:'a',time:1000,sunAlt:-8,waitMs:1000}),false);
console.log('Sunrise/night transition, stale-frame deadline and location guard passed');
