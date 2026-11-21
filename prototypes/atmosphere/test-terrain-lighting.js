const assert=require('node:assert/strict'),G=require('./terrain-light-geometry.js');
const mesh={size:7,span:6000,heights:Array(49).fill(2000)};
assert.deepEqual(G.normal(mesh,3,3),[-0,-0,1]);
assert.ok(Math.abs(G.direct(mesh,3,3,30,90)-.5)<1e-6);
assert.equal(G.direct(mesh,3,3,-10,90),0);
mesh.heights[3*7+5]=4000;
assert.ok(G.direct(mesh,3,3,5,90,false)>0,'unobstructed direct lighting on flat source');
assert.equal(G.direct(mesh,3,3,5,90,true),0,'separate eastern ridge casts shadow');
assert.ok(G.direct(mesh,3,3,5,270,true)>0,'western sun not blocked by eastern ridge');
const point=G.vertex(mesh,3,6,2003,0,10,300,800);assert.ok(Math.abs(point.x-400)<1e-6);
console.log('Terrain normals, cosine incidence, Earth shadow, cast-shadow toggle and projection passed');

// Eastern ridge hides the valley while a high western summit already sees sunrise.
const sunrise={size:9,span:8000,heights:Array(81).fill(2000)};
for(let y=0;y<9;y++){sunrise.heights[y*9+1]=3400;sunrise.heights[y*9+6]=2600;}
const summit=G.illumination(sunrise,1,4,1,90),valley=G.illumination(sunrise,4,4,1,90);
assert.ok(summit.visibility>.99,'high western ridge gets first light');assert.equal(valley.visibility,0,'valley remains behind the eastern ridge');
assert.ok(G.illumination(sunrise,4,4,35,90).visibility>.99,'rising sunline eventually reaches valley');
const triangle=[{x:0,y:0,clearance:1},{x:10,y:0,clearance:-1},{x:0,y:10,clearance:-1}];
const lit=G.sunPolygon(triangle);assert.equal(lit.length,3);assert.ok(lit.some(v=>v.x===5&&v.y===0));assert.ok(lit.some(v=>v.x===0&&v.y===5));
assert.ok(lit.every(v=>v.clearance>=0),'sunline clips across triangle instead of lighting all of it');
console.log('First light on summit, descending sunrise boundary, and sub-triangle sunline clipping passed');

const axis=Array.from({length:193},(_,i)=>{const d=i-96,a=Math.abs(d);return Math.sign(d)*(a<=64?a*125:8000+(a-64)*687.5);});
const adaptive={size:193,span:60000,axis,heights:axis.flatMap(y=>axis.map(x=>2000+x*.02))};
for(const x of [20,32,96,160,180]){const n=G.normal(adaptive,x,96);assert.ok(Math.abs(n[0]/n[2]+.02)<1e-10,'nonuniform mesh preserves physical slope');}
const projected=G.vertex(adaptive,97,96,2000,90,10,300,800);assert.equal(projected,null,'near-eye mesh samples excluded consistently');
console.log('Adaptive near/far mesh normals and camera exclusion passed');

const earth=G.material([1,1,1],1,1,1,0),shadow=G.material([1,1,1],1,0,1,0),warm=G.material([.3,.1,.01],1,1,1,0);
assert.ok(earth[0]>earth[2]*1.4,'neutral sunlight retains non-white terrain reflectance');
assert.ok(Math.max(...earth)<.6,'high illumination does not clip terrain to white');
assert.ok(warm[0]/warm[1]>earth[0]/earth[1],'warm sunlight changes reflected hue');
assert.deepEqual(shadow,G.material([0,0,0],1,1,1,0),'opaque cloud removes direct beam, retaining ambient light');
assert.ok(Math.max(...G.material([10,10,10],1,1,1,1))<.04,'haze does not bleach distant terrain');
console.log('Earth reflectance, warm light, cloud-blocked illumination and non-white tone mapping passed');
