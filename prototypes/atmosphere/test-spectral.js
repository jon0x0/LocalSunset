const assert=require('node:assert/strict'),S=require('./spectral-sky.js');
global.SpectralSky=S;const M=require('./model.js');
const luminance=v=>.2126*v[0]+.7152*v[1]+.0722*v[2];
for(const sun of [-18,-6,-4,0,10])for(const aod of [0,.12,3])for(const du of [0,300,600]){
 const rgb=S.radiance(10,30,sun,aod,2000,{ozoneDU:du});assert.ok(rgb.every(v=>Number.isFinite(v)&&v>=0));
}
assert.ok(S.ozone(603,300)>S.ozone(440,300));assert.equal(S.ozone(603,0),0);
const no=S.radiance(10,0,-3,.12,2000,{ozoneDU:0}),yes=S.radiance(10,0,-3,.12,2000,{ozoneDU:300});assert.ok(luminance(yes)<luminance(no),'absorption reduces radiometric luminance');
assert.ok(luminance(S.radiance(45,90,10))>luminance(S.radiance(45,90,-18)));
assert.deepEqual(M.radiance(10,30,-3,.12,2000,{spectral:true,ozoneDU:300}),S.radiance(10,30,-3,.12,2000,{ozoneDU:300}));
assert.deepEqual(M.radiance(10,30,-3,.12,2000,{spectral:false}),M.radiance(10,30,-3,.12,2000));
assert.ok(S.cloudLight(-4,8000,.12,{ozoneDU:300}).every(v=>Number.isFinite(v)&&v>=0));
console.log('Spectral finite radiance, ozone extinction, twilight shadow, cloud light and legacy-mode parity passed');
