const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('static/app.js','utf8'),nodes={};
function node(){return {value:'',children:[],append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},addEventListener(){},reportValidity(){return true;}};}
for(const id of ['search','zip','calculate','calculateForm','searchForm','results','saved','lat','lon','groundOverride','zipCity','zipHint'])nodes[id]=node();
let lookups=0,calculations=0,rows=[],deferred=null;
const context={$:id=>nodes[id],document:{createElement:node},calculationPending:false,currentName:'Selected point',zipFromMatch:false,searchRequest:0,zipRequest:0,zipTimer:null,locationGeneration:0,clearTimeout(){},status(){},updatePlaceTitle(){},invalidateResult(){context.locationGeneration++;},api:async()=>{lookups++;return deferred?await deferred:rows;},calculateCurrent:async()=>{calculations++;return true;}};
vm.createContext(context);vm.runInContext(source.slice(source.indexOf('let applyingLocation='),source.indexOf('async function calculateCurrent()')),context);
(async()=>{
 nodes.search.value='Selected point';await context.applyLocation();assert.equal(lookups,0);assert.equal(calculations,1,'selected location applies without geocoding again');
 nodes.search.value='';nodes.lat.value=40;nodes.lon.value=-105;await context.applyLocation();assert.equal(calculations,2,'manual coordinates use the calculation path');
 nodes.search.value='New point';rows=[{name:'Matched point',lat:41,lon:-104,postcode:'80228'}];await context.applyLocation();assert.equal(lookups,1);assert.equal(calculations,3);assert.equal(nodes.lat.value,41,'unique address applies immediately');
 await context.applyLocation();assert.equal(lookups,1,'repeat Apply reuses resolved address');assert.equal(calculations,4);
 nodes.search.value='Ambiguous point';rows=[{name:'First match',lat:42,lon:-103},{name:'Second match',lat:43,lon:-102}];await context.applyLocation();assert.equal(calculations,4,'ambiguous matches require explicit choice');assert.equal(nodes.results.children.length,2);
 await nodes.results.children[1].onclick();assert.equal(calculations,5);assert.equal(nodes.lat.value,43,'choosing a match applies it without another Trace step');
 nodes.search.value='Slow point';let resolve;deferred=new Promise(r=>resolve=r);const pending=context.applyLocation();await context.applyLocation();assert.equal(lookups,3,'duplicate clicks do not create duplicate lookups');context.locationGeneration++;resolve([{name:'Obsolete match',lat:44,lon:-101}]);await pending;assert.equal(calculations,5,'obsolete address response cannot apply to a changed location');assert.equal(nodes.calculate.disabled,false);
 console.log('Apply location: selected/manual inputs, unique and ambiguous matches, duplicate and stale requests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
