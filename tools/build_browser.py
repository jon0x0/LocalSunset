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
shared=['app.js','idle-mode.js','cache-controls.js','celestial-sky.js','countdown.js','keystone.js','scene-effects.js','star-catalog.js','style.css','THIRD-PARTY.md','vendor/astronomy.browser.min.js','vendor/ASTRONOMY-LICENSE.md']
owned=['browser-api.js','cache-db.js','terrain-core.js','solar-core.js','terrain-worker.js','README.md','BROWSER-THIRD-PARTY.md','vendor/geotiff.js','vendor/GEOTIFF-LICENSE.md','vendor/proj4.js','vendor/PROJ4-LICENSE.md','vendor/tz.js','vendor/TZ-LOOKUP-LICENSE.md']
sources=[ROOT/'static'/name for name in shared]+[ROOT/'web'/name for name in owned]+[ROOT/'static/index.html']
audit(sources)
for name in shared:
 text=(ROOT/'static'/name).read_text(encoding='utf-8-sig').replace('/static/','./').replace('localsunset.','localsunset.browser.')
 if name=='style.css':text='\n'.join(line for line in text.splitlines() if not line.startswith('@import'))
 if name=='keystone.js':text=text.replace("if(!controllerPage&&typeof EventSource", "if(!controllerPage&&document.body.dataset.browserEdition!=='true'&&typeof EventSource")
 if name=='cache-controls.js':text=text.replace('server','browser terrain')
 target=output/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(text,encoding='utf-8')
for name in owned:
 target=output/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((ROOT/'web'/name).read_bytes().replace(b'\r\n',b'\n'))
html=(ROOT/'static/index.html').read_text(encoding='utf-8').replace('/static/','./').replace('<body>','<body data-browser-edition="true">')
html=html.replace('<script src="./vendor/astronomy.browser.min.js">','<script src="./vendor/tz.js"></script><script src="./cache-db.js"></script><script src="./browser-api.js"></script><script src="./vendor/astronomy.browser.min.js">')
html=html.replace('value="11" selected','value="11"').replace('value="10">Fast','value="10" selected>Fast').replace('id="radius" type="number" min="5" max="200" value="60"','id="radius" type="number" min="5" max="200" value="30"')
html=html.replace('This browser + server terrain/calculations','This browser: scene + terrain/calculations').replace('Server terrain and calculations only','Cached terrain and calculations only')
html=html.replace('</footer>','<br>Place fallback: <a href="https://open-meteo.com/">Open-Meteo geocoding</a></footer>')
html=html.replace('</head>','<style>[data-browser-edition] .hdmi-sync,[data-browser-edition] #projectLocation,[data-browser-edition] #projectionLocation{display:none!important}</style></head>')
(output/'index.html').write_text(html,encoding='utf-8')
assets=sorted(['./'+name for name in shared+owned]+['./index.html','./'])
version=hashlib.sha256(b''.join((output/name[2:]).read_bytes() for name in assets if name!='./')).hexdigest()[:16]
sw="const CACHE='localsunset-shell-"+version+"',ASSETS="+json.dumps(assets)+";\n"
sw+="self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'})))).then(()=>self.skipWaiting())));\n"
sw+="self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('localsunset-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));\n"
sw+="self.addEventListener('fetch',event=>{if(event.request.method==='GET'&&new URL(event.request.url).origin===self.location.origin)event.respondWith(caches.open(CACHE).then(async cache=>{const cached=()=>cache.match(event.request,{ignoreSearch:true});if(event.request.mode==='navigate'){try{const response=await fetch(event.request,{cache:'no-cache'});if(response.ok){await cache.put(event.request,response.clone());return response;}return (await cached())||response;}catch(error){const response=await cached();if(response)return response;throw error;}}return (await cached())||fetch(event.request).then(response=>{if(response.ok)cache.put(event.request,response.clone());return response;});}));});\n"
(output/'sw.js').write_text(sw,encoding='utf-8')
with ZipFile(ROOT/'dist/localsunset-browser.zip','w',ZIP_DEFLATED) as archive:
 for name in sorted(set(shared+owned+['index.html','sw.js'])):archive.write(output/name,name)
print('Static site:',output);print('Deploy ZIP:',ROOT/'dist/localsunset-browser.zip');print('No personal locations, photos, cache or API server bundled.')
