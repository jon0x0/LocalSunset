"""Build a self-contained static site; no Python/API process is needed to use it."""
from pathlib import Path
import hashlib,json,shutil
from zipfile import ZipFile,ZIP_DEFLATED
from public_files import ROOT
from audit_public import audit
output=ROOT/'dist/browser'
if output.is_symlink() or not output.resolve().is_relative_to((ROOT/'dist').resolve()):raise SystemExit('Unsafe build output path')
if output.exists():shutil.rmtree(output)
output.mkdir(parents=True,exist_ok=True)
# Reuse the tested atmospheric composition, then flatten it for static hosting.
import runpy
from public_files import ATMOSPHERE,public_files
atmosphere=ROOT/'prototypes/atmosphere'
audit(public_files())
composition=runpy.run_path(str(atmosphere/'build_candidate.py'))
for name in composition['shared']+composition['owned']+['index.html','proxy.js','about.html']:
 target=output/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(atmosphere/'candidate'/name,target)
runtime=[name for name in ATMOSPHERE if name.endswith(('.js','.css')) and not name.startswith('test-')]+['terrain-80228.json','gpu-terrain.html']
for name in runtime:shutil.copyfile(atmosphere/name,output/name)
for path in output.rglob('*'):
 if path.suffix not in ('.html','.js','.css'):continue
 text=path.read_text(encoding='utf-8-sig')
 if path.name in ('gpu-terrain.js','gpu-terrain.html'):
  text=text.replace('../../web/vendor/','./vendor/').replace('../../static/vendor/','./vendor/').replace('candidate/terrain-worker.js','./terrain-worker.js').replace('href="candidate/"','href="./"')
 text=text.replace('../','./') if path.suffix=='.html' else text
 if path.name=='browser-api.js':text=text.replace('localsunset.atmosphere.candidate.','localsunset.').replace("if(false&&'serviceWorker'", "if('serviceWorker'")
 else:text=text.replace('localsunset.atmosphere.candidate.','localsunset.browser.')
 if path.name=='candidate-ui.js':
  text=text.replace("fetch('../terrain-80228.json')","fetch('./terrain-80228.json')")
  text=text.replace('syncTerrainVisibility();initializeCandidate();',"syncTerrainVisibility();(async()=>{await loadSaved();if(!result&&saved.length){$('saved').value=saved[saved.length-1].name;$('saved').onchange();await calculateToday();}else await initializeCandidate();})();")
 if path.name=='index.html':
  text=text.replace('<body data-browser-edition="true">','<body data-browser-edition="true" data-satellite-provider="browser">')
  text=text.replace('Local Sunset · Atmospheric candidate','Local Sunset').replace('<p class="candidate-banner">LOCAL PROTOTYPE · PRODUCTION UNCHANGED</p>','').replace('LOCAL CANDIDATE · BARE-EARTH TERRAIN','MODELED ATMOSPHERE · BARE-EARTH TERRAIN')
 path.write_text(text,encoding='utf-8')
files=sorted(p.relative_to(output).as_posix() for p in output.rglob('*') if p.is_file())
assets=['./'+name for name in files]+['./']
version=hashlib.sha256(b''.join((output/name[2:]).read_bytes() for name in assets if name!='./')).hexdigest()[:16]
sw="const CACHE='localsunset-shell-"+version+"',ASSETS="+json.dumps(assets)+";\n"
sw+="self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'})))).then(()=>self.skipWaiting())));\n"
sw+="self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('localsunset-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));\n"
sw+="self.addEventListener('fetch',event=>{if(event.request.method==='GET'&&new URL(event.request.url).origin===self.location.origin)event.respondWith(caches.open(CACHE).then(async cache=>{const cached=()=>cache.match(event.request,{ignoreSearch:true});if(event.request.mode==='navigate'){try{const response=await fetch(event.request,{cache:'no-cache'});if(response.ok){await cache.put(event.request,response.clone());return response;}return (await cached())||response;}catch(error){const response=await cached();if(response)return response;throw error;}}return (await cached())||fetch(event.request).then(response=>{if(response.ok)cache.put(event.request,response.clone());return response;});}));});\n"
(output/'sw.js').write_text(sw,encoding='utf-8')
with ZipFile(ROOT/'dist/localsunset-browser.zip','w',ZIP_DEFLATED) as archive:
 for name in files+['sw.js']:archive.write(output/name,name)
print('Static site:',output);print('Deploy ZIP:',ROOT/'dist/localsunset-browser.zip');print('No personal locations, photos, cache or API server bundled.')
