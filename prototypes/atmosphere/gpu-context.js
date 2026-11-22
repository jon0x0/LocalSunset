/* Prefer a compatible WebGL 2 context; never require MSAA or a discrete GPU. */
(function(root){
 function create(document){
  const failures=[];
  for(const powerPreference of ['default','low-power']){
   const canvas=document.createElement('canvas');let message='';
   canvas.addEventListener('webglcontextcreationerror',event=>{message=event.statusMessage||'';});
   const settings={alpha:true,antialias:false,depth:true,stencil:false,powerPreference,preserveDrawingBuffer:false,failIfMajorPerformanceCaveat:false};
   try{const context=canvas.getContext('webgl2',settings);if(context)return {canvas,context,settings};}catch(e){message=e.message||String(e);}
   if(message)failures.push(message);
  }
  const reason=failures.at(-1)||'The browser did not provide a reason.';
  const advice=/FEATURE_FAILURE_EGL_POT|Exhausted GL driver/i.test(reason)?'Firefox could not initialize a graphics backend. Test Open GPU directly; if it also fails, restart Firefox or try Chrome/Edge. ':'Close other 3D test tabs and reload. ';
  throw Error('WebGL 2 context could not start. '+advice+reason);
 }
 async function createRenderer({document,navigator,secure,webGL,loadWebGPU}){
  let gpuError='';
  if(secure&&navigator?.gpu){
   let renderer;
   try{const engine=await loadWebGPU();renderer=new engine.WebGPURenderer({alpha:true,antialias:false});await renderer.init();
    if(!renderer.backend?.isWebGPUBackend)throw Error('WebGPU initialization selected a non-WebGPU backend');
    return {renderer,engine,api:'WebGPU'};
   }catch(error){gpuError=error.message||String(error);try{renderer?.dispose();}catch(e){}}
  }
  try{const gpu=create(document);return {renderer:new webGL.WebGLRenderer({canvas:gpu.canvas,context:gpu.context,alpha:true,antialias:false}),engine:webGL,api:'WebGL 2'};}
  catch(error){throw Error(error.message+(gpuError?' WebGPU also failed: '+gpuError:!secure?' WebGPU requires HTTPS or localhost; try the desktop localhost test link.':''));}
 }
 const api={create,createRenderer};root.TerrainGPUContext=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
