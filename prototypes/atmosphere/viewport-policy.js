(function(root){
 function policy(width,height){
  const compact=width<=760||(width<=1100&&height<=540),landscape=compact&&width>height;
  return {compact,profile:landscape?'phone-landscape':compact?'phone-portrait':'desktop',minimum:landscape?140:180,
   maximum:landscape?Math.max(140,height-140):1400,
   initial:landscape?Math.max(140,Math.min(320,height-150)):compact?Math.max(240,Math.min(360,height*.36)):360};
 }
 root.SkyViewportPolicy={policy};if(typeof module!=='undefined')module.exports={policy};
})(typeof globalThis!=='undefined'?globalThis:this);
