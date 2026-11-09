var fs=require('fs'),vm=require('vm'),assert=require('assert');
var source=fs.readFileSync('static/scene-effects.js','utf8'),context={Image:function(){}};vm.createContext(context);
vm.runInContext(source.slice(0,source.indexOf('(function(){'))+';this.fx=SceneEffects;',context);
var horizon=Array(1440).fill(5);
assert.equal(context.fx.visibleFraction({az:240,alt:4,radius:.27},horizon),0);
assert.equal(context.fx.visibleFraction({az:240,alt:6,radius:.27},horizon),1);
assert.ok(Math.abs(context.fx.visibleFraction({az:240,alt:5,radius:.27},horizon)-.5)<1e-10);
assert.equal(context.fx.horizonAt(360,horizon),5);
console.log('PASS: glow visibility follows terrain occultation; no rays after the disk is hidden.');

var tree={height:.66,widthDegrees:36};
var close=context.fx.foregroundSize(tree,1600/30,1600,1200);
var normal=context.fx.foregroundSize(tree,1600/75,1600,1200);
var wide=context.fx.foregroundSize(tree,1600/120,1600,1200);
assert.ok(Math.abs(normal.height-1200*.66)<1e-8);
assert.ok(Math.abs(close.height/wide.height-4)<1e-8);
assert.ok(Math.abs(close.width/wide.width-4)<1e-8);
assert.ok(Math.abs(close.height/close.width-wide.height/wide.width)<1e-8);
console.log('PASS: foreground trees shrink uniformly as FOV widens; reference size and aspect ratio preserved.');

