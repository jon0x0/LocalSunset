var assert=require('assert'),fs=require('fs'),vm=require('vm'),source=fs.readFileSync('static/app.js','utf8');
var context={document:{body:{dataset:{clock12:'true'}}},Date:Date,Intl:Intl,result:{timezone:'America/Denver'}};vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function formatClock('),source.indexOf('function refreshTimeLabels(')),context);
assert.ok(/12:00:00 AM/.test(context.formatTime(Date.parse('2026-11-08T07:00:00Z'))));
assert.ok(/12:00:00 PM/.test(context.formatTime(Date.parse('2026-11-08T19:00:00Z'))));
assert.ok(/0?6:00:00 PM/.test(context.formatTime(Date.parse('2026-11-09T01:00:00Z'))));
context.document.body.dataset.clock12='false';assert.equal(context.formatTime(Date.parse('2026-11-09T01:00:00Z')),'18:00:00');
console.log('PASS: local midnight/noon and evening AM/PM, plus 24-hour switch.');
