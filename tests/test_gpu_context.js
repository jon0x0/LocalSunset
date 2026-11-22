const assert=require('node:assert/strict'),G=require('../prototypes/atmosphere/gpu-context.js');
const attempts=[],context={};let count=0;
const document={createElement:()=>({addEventListener(){},getContext(type,settings){assert.equal(type,'webgl2');attempts.push(settings);return ++count===1?null:context;}})};
const result=G.create(document);assert.equal(result.context,context);assert.equal(attempts[0].powerPreference,'default');assert.equal(attempts[1].powerPreference,'low-power');assert.ok(attempts.every(a=>!a.antialias&&!a.stencil&&!a.failIfMajorPerformanceCaveat),'compatibility request must not force MSAA, stencil or a discrete GPU');
assert.throws(()=>G.create({createElement:()=>({addEventListener(){},getContext:()=>null})}),/WebGL 2 context could not start/);
console.log('GPU context negotiation: compatible defaults, low-power retry, no forced MSAA and explicit failure passed');

(async()=>{
 let glTried=false;class GPU{constructor(){this.backend={isWebGPUBackend:true};}async init(){this.initialized=true;}}
 const chosen=await G.createRenderer({document:{createElement(){glTried=true;throw Error('WebGL must not be attempted when WebGPU works');}},navigator:{gpu:{}},secure:true,webGL:{},loadWebGPU:async()=>({WebGPURenderer:GPU})});
 assert.equal(chosen.api,'WebGPU');assert.equal(chosen.renderer.initialized,true);assert.equal(glTried,false);
 let gpuLoaded=false;class GL{constructor(options){this.options=options;}}
 const fallback=await G.createRenderer({document:{createElement:()=>({addEventListener(){},getContext:()=>context})},navigator:{gpu:{}},secure:false,webGL:{WebGLRenderer:GL},loadWebGPU:async()=>{gpuLoaded=true;}});
 assert.equal(fallback.api,'WebGL 2');assert.equal(gpuLoaded,false,'plain HTTP does not attempt secure-context WebGPU');
 console.log('Backend selection prefers working WebGPU without touching broken WebGL; HTTP retains WebGL fallback');
})().catch(e=>{console.error(e);process.exitCode=1;});
