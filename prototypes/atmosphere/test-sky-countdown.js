const assert=require('assert'),C=require('./sky-countdown.js');
const a={contact:10000,astro:50000,peak:{t:30000}},window=[20000,40000];
for(const [now,label] of [[0,'Local terrain sunset'],[10000,'Viewing window starts'],[20000,'sunset peak'],[30000,'Viewing window ends'],[40000,'Astronomical sunset']])assert(C.next(a,window,'sunset',now).label.startsWith(label+' in '));
assert.strictEqual(C.next(a,window,'sunset',50000).event,null);
assert(C.next({...a,contact:25000},[10000,40000],'sunrise',0).label.startsWith('Viewing window starts'));
assert(C.next(a,null,'sunrise',0).label.startsWith('Local terrain sunrise'));
assert.strictEqual(C.next({contact:null,astro:null,peak:null},null,'sunset',0).event,null);
console.log('Countdown chronology, sunrise labels, independent window order and missing/past events passed.');

const preview={contact:0,astro:1500000,peak:{t:600000}};
assert.strictEqual(C.relative(preview,[0,1200000],'sunset',420000).label,'00:03:00 before sunset peak');
assert.strictEqual(C.relative(preview,[0,1200000],'sunset',780000).label,'00:07:00 before viewing window end');
assert.strictEqual(C.relative(preview,[0,1200000],'sunrise',600000).label,'00:10:00 before viewing window end');
assert.strictEqual(C.relative({contact:10000,astro:null,peak:null},null,'sunset',0).label,'00:00:10 before local terrain sunset');
console.log('Simulated next-event offsets, sunrise and missing-peak fallback passed.');

for(const [t,label] of [[0,'local terrain sunset'],[10000,'viewing window begin'],[20000,'sunset peak'],[30000,'viewing window end'],[40000,'astronomical sunset']])assert(C.relative(a,window,'sunset',t).label.endsWith(label));
assert.strictEqual(C.relative(a,window,'sunset',50000).event,null);
assert(C.relative({...a,contact:25000},[10000,40000],'sunrise',0).label.endsWith('viewing window begin'));
console.log('Preview status advances through all milestones in actual time order.');

const nav={contact:1000,astro:5000,peak:{t:3000}},windowNav=[2000,4000];
assert.strictEqual(C.adjacent(nav,windowNav,'sunset',3000,1).t,4000);
assert.strictEqual(C.adjacent(nav,windowNav,'sunset',3000,-1).t,2000);
assert.strictEqual(C.adjacent(nav,windowNav,'sunset',5000,1),null);

