var assert=require('assert'),fs=require('fs'),vm=require('vm'),countdown=require('../static/countdown.js');
var event=Date.parse('2026-11-09T00:00:00Z'),result={sunset:{utc:new Date(event).toISOString()}};
assert.equal(countdown(result,event-61000,'sunset').value,'00:01:01');
assert.equal(countdown(result,event,'sunset').value,'00:00:00');
assert.equal(countdown(result,event+3661000,'sunset').value,'01:01:01');
assert.equal(countdown(result,event+3661000,'sunset').past,true);
assert.equal(countdown(result,event-1,'sunset').past,false);
assert.equal(countdown({sunrise:result.sunset},event+2000,'sunrise').value,'00:00:02');
var nodes={eventMode:{value:'sunset'}};function node(id){return nodes[id]||(nodes[id]={setAttribute:function(){}});}
var now=Date.parse('2026-11-09T02:00:00Z');function ClockDate(value){return new Date(value);}ClockDate.now=function(){return now;};ClockDate.parse=Date.parse;
var context={controllerPage:true,document:{body:{dataset:{clock12:'false'}}},$:node,Date:ClockDate,Intl:Intl,sunsetCountdown:countdown,result:{timezone:'America/Denver',sunset:{utc:'2026-11-09T00:00:00Z'},timeline:[{t:event}]},currentTime:event,realTimeView:false,formatTime:function(){return 'SIMULATED';},localDate:function(){return 'Nov 8';}};
vm.createContext(context);var source=fs.readFileSync('static/app.js','utf8');
vm.runInContext(source.slice(source.indexOf('function formatClock('),source.indexOf('function refreshTimeLabels(')),context);
vm.runInContext(source.slice(source.indexOf('function updateCountdown(){'),source.indexOf('\nupdateCountdown();',source.indexOf('function updateCountdown(){'))),context);
context.renderClock=function(id,text){node(id).textContent=text;};
context.updateCountdown();assert.equal(nodes.projectionCurrentTime.textContent,'19:00:00');assert.equal(nodes.currentLocalTime.textContent,'19:00:00');assert.equal(nodes.projectionCountdown.textContent,'02:00:00');assert.equal(nodes.projectionCountdownLabel.textContent,'SINCE SUNSET');assert.equal(context.currentTime,event);
now+=1000;context.updateCountdown();assert.equal(nodes.projectionCurrentTime.textContent,'19:00:01');assert.equal(nodes.projectionCountdown.textContent,'02:00:01');
console.log('PASS: countdown becomes elapsed count-up; prominent clock uses location timezone and advances independently of simulation.');

context.controllerPage=false;context.document={body:{dataset:{clock12:'false'},classList:{contains:function(){return true;}}}};context.realTimeView=false;context.playing=true;now=event-1000;context.updateCountdown();assert.equal(context.realTimeView,true);assert.equal(context.playing,false);
console.log('PASS: sky-only receiver forces wall-clock mode rather than playback.');
