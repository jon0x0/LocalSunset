// Run with node tests/test_saved_selection.js. No browser or network required.
var fs=require('fs'),vm=require('vm'),assert=require('assert');
var source=fs.readFileSync('static/app.js','utf8');
var nodes={saved:{value:'First point'},syncHDMI:{checked:true},remoteProjector:{checked:true}};
['lat','lon','height','groundOverride','groundClearance','zip','zipCity','search','placeTitle','projectLocation'].forEach(function(id){nodes[id]={};});
var calls=[];
var context={
    saved:[{name:'Second point',lat:20,lon:30,height:2,ground:100,near:75},{name:'First point',lat:40,lon:50,height:3}],
    controllerPage:true,zipRequest:0,zipTimer:null,zipFromMatch:false,realTimeView:false,hdmiBlocked:false,
    $:function(id){return nodes[id];},invalidateResult:function(){},updatePlaceTitle:function(){},clearTimeout:function(){},status:function(){}
};
context.calculateCurrent=function(){calls.push({name:context.currentName,lat:nodes.lat.value,lon:nodes.lon.value});};
vm.createContext(context);
var start=source.indexOf("$('saved').onchange=");
var end=source.indexOf("$('remove').onclick",start);
vm.runInContext(source.slice(start,end),context);
nodes.saved.onchange({type:'change'});
assert.deepEqual(calls[0],{name:'First point',lat:40,lon:50});
nodes.saved.value='Second point';nodes.saved.onchange({type:'change'});
assert.deepEqual(calls[1],{name:'Second point',lat:20,lon:30});
assert.equal(nodes.groundOverride.value,100);assert.equal(nodes.groundClearance.value,75);
// Startup may fill the form without generating an unintended selection command.
nodes.saved.value='First point';nodes.saved.onchange();assert.equal(calls.length,2);
assert.equal(nodes.groundOverride.value,'');assert.equal(nodes.groundClearance.value,100);
nodes.syncHDMI.checked=false;nodes.projectLocation.onclick();
assert.equal(nodes.syncHDMI.checked,true);assert.equal(calls[2].name,'First point');
console.log('PASS: named saved points select/project correctly even after list reordering; startup does not steal selection.');
