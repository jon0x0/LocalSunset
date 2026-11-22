const assert=require('node:assert/strict'),G=require('../prototypes/atmosphere/gpu-terrain-geometry.js');
const base={size:3,span:4000,axis:[-2000,0,2000],heights:Array(9).fill(2000)};
assert.equal(G.sample(base,100,200),2000);
const detail={size:3,span:2000,axis:[-1000,0,1000],heights:[2000,2000,2000,2000,2300,2000,2000,2000,2000]};
const merged=G.combine(base,detail);assert.equal(merged.size,5);assert.equal(G.sample(merged,0,0),2300);assert.equal(G.sample(merged,2000,2000),2000);
const b=G.buffers(base,2003);assert.equal(b.positions.length,27);assert.equal(b.positions[4*3+1],-3);assert.ok(b.positions[0*3+1]<-3,'Earth curvature lowers distant terrain');
assert.ok(b.indices instanceof Uint32Array);for(const i of b.indices)assert.ok(i<9);
const north=G.sunDirection(0,0),east=G.sunDirection(0,90);assert.equal(north[2],-1);assert.equal(east[0],1);
const flat={size:3,span:4000,heights:Array(9).fill(2000)},tri=G.buffers(flat,2003);for(let i=0;i<tri.indices.length;i+=3){const [a,b,c]=Array.from(tri.indices.slice(i,i+3)).map(j=>Array.from(tri.positions.slice(j*3,j*3+3)));const up=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);assert.ok(up>0,'terrain triangles face upward');}
console.log('GPU terrain: fine-patch merge, interpolation, ENU axes, curvature, observer height, winding and Sun direction passed');

assert.equal(tri.indices.length,24,'continuous heightfield has no artificial hole around observer');
for(const size of [512,1024,2048,4096]){const b=G.shadowSettings(size);assert.equal(b.texel,88000/size);assert.ok(b.normalBias>=.5);assert.ok(b.bias<0);}
assert.ok(G.shadowSettings(512).normalBias>G.shadowSettings(4096).normalBias,'coarser maps need greater receiver bias');

const fs=require('node:fs'),vm=require('node:vm');
const gpuSource=fs.readFileSync('prototypes/atmosphere/gpu-terrain.js','utf8');
let disposed=0;const old={geometry:{dispose(){}},material:{dispose(){}},customDepthMaterial:{dispose(){disposed++;}}};
const mock={G:{combine:()=>({size:3,source:'fixture'}),sample:()=>2000,shadowSettings:()=>({texel:86})},terrainMaterial:()=>({}),baseMesh:{},detailMesh:null,terrain:old,scene:{remove(){},add(){}},THREE:{DoubleSide:2,FrontSide:0,RGBADepthPacking:3201,MeshStandardMaterial:class{},Color:class{setRGB(){return this;}},Mesh:class{},MeshDepthMaterial:class{constructor(options){Object.assign(this,options);}}},$:id=>id==='surface'?{value:'solid'}:{},state:{observer:2003},geometry:()=>({}),backendName:'WebGL 2',camera:{},renderer:{shadowMap:{},compileAsync:()=>Promise.resolve()},sun:{shadow:{mapSize:{x:1024},camera:{left:-44000,right:44000,top:44000,bottom:-44000}}},dirty:false,buildGeneration:0,preparing:false,tellParent(){},rejectGPU(){},Promise};
vm.createContext(mock);vm.runInContext(gpuSource.slice(gpuSource.indexOf('function rebuild(){'),gpuSource.indexOf('function loadMesh(')),mock);mock.rebuild();
assert.equal(disposed,1,'rebuild releases old depth material');
assert.equal(mock.terrain.customDepthMaterial.polygonOffset,true);
assert.equal(mock.terrain.customDepthMaterial.polygonOffsetFactor,1,'caster uses slope-dependent depth offset');
assert.equal(mock.terrain.customDepthMaterial.side,0,'open heightfields cast front faces');
console.log('GPU shadow caster uses slope bias and releases old depth materials');


const focused=G.shadowSettings(2048,16000,3000);assert.ok(focused.texel<8);assert.ok(focused.normalBias<1,'focused map avoids tens of metres of receiver offset');

// Fixed surface orientation: increasing irradiance must not dim the light.
let previous=0;for(let y=0;y<=1;y+=.001){const output=y*G.sunStrength([y,y,y]);assert.ok(output>=previous);assert.ok(output<4);previous=output;}
const spectral=require('../prototypes/atmosphere/spectral-sky.js');previous=0;
for(let altitude=0;altitude<=70;altitude+=.25){const rgb=spectral.directLight(altitude,2200,.12),y=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2],output=y*G.sunStrength(rgb);assert.ok(output>=previous-1e-9,'spectral sunrise-to-daylight response has no artificial brightness reversal');previous=output;}
