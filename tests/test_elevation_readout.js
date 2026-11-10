const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('static/app.js','utf8'),output={};
const context=vm.createContext({$:()=>output,result:null,resultDirty:true});
vm.runInContext(source.slice(source.indexOf('function updateGroundLookup()'),source.indexOf('function updatePlaceTitle()')),context);
context.updateGroundLookup();assert(output.textContent.includes('Trace this location'));
context.result={terrain:{ground_m:1000,observer_m:1001.7}};context.resultDirty=false;context.updateGroundLookup();
assert(output.textContent.includes('1000.0 m (3281 ft)'));assert(output.textContent.includes('1001.7 m (3286 ft)'));
context.resultDirty=true;context.updateGroundLookup();assert(!output.textContent.includes('1000.0'));
console.log('PASS: looked-up ground and observer elevations show meters/feet, and changed selections cannot show stale elevation.');
