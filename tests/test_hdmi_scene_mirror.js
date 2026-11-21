const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const src=fs.readFileSync('static/app.js','utf8');
const fields={eventMode:{value:'sunrise'},spectralEnabled:{checked:true,dispatchEvent(){}},candidateAod:{value:'.12',dispatchEvent(){}}};
const view={config_revision:4,time_ms:12345,azimuth:281,event:'sunset',playing:false,live:false,sky:{spectralEnabled:false,candidateAod:.25}};
const c={result:{},remoteApplying:false,lastDisplayRevision:4,hdmiViewRevision:0,lastHDMIAck:0,Date,Event:class{},document:{body:{classList:{contains:()=>true}},addEventListener(){}},$:id=>fields[id],api:async url=>url==='/api/display-view'?{revision:3,view}:{},jsonOptions:x=>x,syncEventControls(){},setTime(t){c.time=t;},updatePlay(){},draw(){},updateCountdown(){},queueHDMI(){}};
vm.createContext(c);
vm.runInContext(src.slice(src.indexOf('const mirroredSkyChecks'),src.indexOf('function queueHDMI')),c);
vm.runInContext(src.slice(src.indexOf('async function followHDMIView'),src.indexOf("$('syncHDMI').checked=controllerPage")),c);
(async()=>{await c.followHDMIView();assert.equal(c.time,12345,'Sky only is a layout and cannot force realtime');assert.equal(c.realTimeView,false);assert.equal(c.viewAzimuth,281);assert.equal(fields.eventMode.value,'sunset');assert.equal(fields.spectralEnabled.checked,false);assert.equal(fields.candidateAod.value,.25);assert.equal(c.captureSkyOptions().candidateAod,.25);console.log('HDMI follows preview time, direction, event and atmosphere even in Sky only mode');})().catch(e=>{console.error(e);process.exitCode=1;});
