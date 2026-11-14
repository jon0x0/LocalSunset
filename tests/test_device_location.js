var fs=require('fs'),vm=require('vm'),assert=require('assert');
var source=fs.readFileSync('static/app.js','utf8');
var block=source.slice(source.indexOf("$('useLocation').onclick="),source.indexOf('function trailingZip'));
function setup(secure=true){
 var nodes={},request,calls=0;
 for(var id of ['useLocation','locationHint','lat','lon','groundOverride','saved','zip','zipCity','results','search'])nodes[id]={value:'previous',replaceChildren(){}};
 var context={window:{isSecureContext:secure},navigator:{geolocation:{getCurrentPosition(success,error,options){calls++;request={success,error,options};}}},locationGeneration:0,searchRequest:0,zipRequest:0,zipFromMatch:false,zipTimer:null,calculationPending:false,$:id=>nodes[id],clearTimeout(){},invalidateResult(){context.locationGeneration++;},updatePlaceTitle(){},status(){}};
 vm.runInNewContext(block,context);
 return {nodes,context,get request(){return request;},get calls(){return calls;}};
}
var test=setup();assert.equal(test.calls,0);test.nodes.useLocation.onclick();
assert.equal(test.calls,1);assert.equal(test.request.options.enableHighAccuracy,true);assert.equal(test.request.options.maximumAge,0);
test.request.success({coords:{latitude:12.123456789123,longitude:45.123456789123,accuracy:8.2,altitude:999}});
assert.equal(test.nodes.lat.value,'12.123456789123');assert.equal(test.nodes.lon.value,'45.123456789123');assert.equal(test.nodes.groundOverride.value,'');assert.match(test.nodes.locationHint.textContent,/±9 m/);
test=setup();test.nodes.useLocation.onclick();test.request.error({code:1});assert.equal(test.nodes.lat.value,'previous');assert.equal(test.nodes.useLocation.disabled,false);
test=setup();test.nodes.useLocation.onclick();test.context.locationGeneration++;test.request.success({coords:{latitude:10,longitude:20}});assert.equal(test.nodes.lat.value,'previous');
test=setup();test.nodes.useLocation.onclick();test.context.searchRequest++;test.request.success({coords:{latitude:10,longitude:20}});assert.equal(test.nodes.lat.value,'previous');
test=setup(false);test.nodes.useLocation.onclick();assert.equal(test.calls,0);assert.match(test.nodes.locationHint.textContent,/HTTPS/);
console.log('PASS: location is click-only, high-accuracy, full-precision, secure-context aware; denied/stale fixes preserve selection.');
