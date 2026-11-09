// Projector layout must never turn a control page into a remote receiver.
var fs=require('fs'),vm=require('vm'),assert=require('assert');
var source=fs.readFileSync('static/app.js','utf8');
function check(query,expected){
 var context={URLSearchParams:URLSearchParams,window:{location:{search:query,href:'http://localhost/'+query}},document:{body:{classList:{toggle:function(){}}},fullscreenElement:null},history:{replaceState:function(){}},URL:URL,displayParams:new URLSearchParams(query),followsRemoteDisplay:false,draw:function(){}};
 vm.createContext(context);
 vm.runInContext(source.slice(0,source.indexOf('let hdmiTimer')),context);
 vm.runInContext(source.slice(source.indexOf('function setProjector('),source.indexOf('async function projectorFullscreen')),context);
 vm.runInContext('setProjector(true);',context);
 assert.equal(context.followsRemoteDisplay,expected,query);
 vm.runInContext('setProjector(false);setProjector(true);',context);
 assert.equal(context.followsRemoteDisplay,expected,query+' repeated');
}
check('',false);check('?projector=1',false);check('?projector=1&auto=1&pi=1',true);
assert.ok(source.indexOf('if(controllerPage||!(followsRemoteDisplay')>=0);
console.log('PASS: projector layout retains controller ownership, including reload; only auto kiosk follows remote configuration.');
