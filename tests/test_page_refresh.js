const fs=require('fs'),vm=require('vm'),assert=require('assert');
const line=fs.readFileSync('tools/build_browser.py','utf8').split('\n').find(s=>s.startsWith('sw+="self.addEventListener(\'fetch\''));
const script=JSON.parse(line.slice(4)),handlers={};let networkCalls=0,offline=false,bad=false,stored;
const old={body:'old page'},fresh={ok:true,body:'new page',clone(){return this;}},cache={match:async()=>old,put:async(key,value)=>{stored=value;}};
vm.runInNewContext(script,{CACHE:'test',URL,self:{location:{origin:'https://example.org'},addEventListener:(name,fn)=>handlers[name]=fn},caches:{open:async()=>cache},fetch:async(request,options)=>{networkCalls++;assert.equal(options?.cache,'no-cache');if(offline)throw Error('offline');return bad?{ok:false}:fresh;}});
function request(mode){let response;handlers.fetch({request:{method:'GET',url:'https://example.org/LocalSunset/',mode},respondWith:value=>response=value});return response;}
(async()=>{
 assert.equal(await request('navigate'),fresh);assert.equal(stored,fresh);assert.equal(networkCalls,1);
 offline=true;assert.equal(await request('navigate'),old);
 offline=false;bad=true;assert.equal(await request('navigate'),old);
 const calls=networkCalls;assert.equal(await request('cors'),old);assert.equal(networkCalls,calls);
 console.log('PASS: page navigations fetch fresh HTML; offline/error loads retain cached page; assets still reuse cache.');
})().catch(error=>{console.error(error);process.exitCode=1;});
