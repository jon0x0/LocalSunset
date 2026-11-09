var fs=require('fs'),vm=require('vm'),assert=require('assert');
var source=fs.readFileSync('static/keystone.js','utf8'),context={};vm.createContext(context);
vm.runInContext(source.slice(0,source.indexOf('(function(){')),context);
function check(corners,w,h){
 var m=context.projectorMatrix(corners,w,h),names=['tl','tr','br','bl'];
 [[0,0],[w,0],[w,h],[0,h]].forEach(function(p,i){
  var den=m[3]*p[0]+m[7]*p[1]+1;
  var x=(m[0]*p[0]+m[4]*p[1]+m[12])/den,y=(m[1]*p[0]+m[5]*p[1]+m[13])/den;
  var c=corners[names[i]],expectedX=(i===1||i===2?1-c.x/100:c.x/100)*w,expectedY=(i>=2?1-c.y/100:c.y/100)*h;
  assert.ok(Math.abs(x-expectedX)<1e-7);assert.ok(Math.abs(y-expectedY)<1e-7);
 });
}
check({tl:{x:0,y:0},tr:{x:0,y:0},br:{x:0,y:0},bl:{x:0,y:0}},1600,1200);
check({tl:{x:12,y:4},tr:{x:3,y:8},br:{x:20,y:2},bl:{x:1,y:11}},1600,1200);
check({tl:{x:25,y:25},tr:{x:25,y:25},br:{x:25,y:25},bl:{x:25,y:25}},1920,1080);
console.log('PASS: identity, asymmetric four-corner warp, aspect ratio and maximum insets map every corner exactly.');

var base={tl:{x:3,y:4},tr:{x:5,y:6},br:{x:2,y:3},bl:{x:1,y:1}};
var positive=context.projectorTaper(base,10,7),negative=context.projectorTaper(base,-10,-7);
assert.equal(positive.tl.x-base.tl.x,10);assert.equal(positive.tr.x-base.tr.x,10);
assert.equal(positive.tl.y-base.tl.y,7);assert.equal(positive.bl.y-base.bl.y,7);
assert.equal(negative.br.x-base.br.x,10);assert.equal(negative.bl.x-base.bl.x,10);
assert.equal(negative.tr.y-base.tr.y,7);assert.equal(negative.br.y-base.br.y,7);
var limited=context.projectorTaper(base,25,25);
assert.equal(limited.tl.x-base.tl.x,limited.tr.x-base.tr.x);assert.equal(limited.tr.x,25);
assert.equal(base.tl.x,3);
console.log('PASS: signed taper moves paired corners equally in both directions, including range limits.');
