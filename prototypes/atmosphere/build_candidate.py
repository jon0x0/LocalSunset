"""Build the full-control local candidate without touching production assets."""
from pathlib import Path
import shutil

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = HERE / 'candidate'
OUT.mkdir(exist_ok=True)
shared = ['app.js','idle-mode.js','cache-controls.js','celestial-sky.js','countdown.js','keystone.js','scene-effects.js','star-catalog.js','style.css','THIRD-PARTY.md','vendor/astronomy.browser.min.js','vendor/ASTRONOMY-LICENSE.md']
owned = ['browser-api.js','cache-db.js','terrain-core.js','solar-core.js','terrain-worker.js','vendor/geotiff.js','vendor/proj4.js','vendor/tz.js','BROWSER-THIRD-PARTY.md','vendor/GEOTIFF-LICENSE.md','vendor/PROJ4-LICENSE.md','vendor/TZ-LOOKUP-LICENSE.md']
for group, folder in [(shared, 'static'), (owned, 'web')]:
 for name in group:
  text = (ROOT / folder / name).read_text(encoding='utf-8-sig').replace('/static/','./').replace('localsunset.', 'localsunset.atmosphere.candidate.')
  if name == 'style.css': text='\n'.join(line for line in text.splitlines() if not line.startswith('@import'))
  if name == 'cache-db.js': text=text.replace('localsunset-browser-cache-v1','localsunset-atmosphere-candidate-cache-v1')
  if name == 'keystone.js': text=text.replace("if(!controllerPage&&typeof EventSource", "if(!controllerPage&&document.body.dataset.browserEdition!=='true'&&typeof EventSource")
  if name == 'browser-api.js':
   text=text.replace('if(JSON.stringify(job.signature)===JSON.stringify(signature)', 'if(!job.terrainDisabled&&JSON.stringify(job.signature)===JSON.stringify(signature)')
   text=text.replace("if(path==='/api/calculate'){", "if(path==='/api/calculate'){if(!TerrainOption.enabled){zone(body.lat,body.lon);await TerrainOption.resolveGround(body);const id='flat-'+(++serial),signature=[body.lat,body.lon,body.height,body.radius,body.zoom,body.source,body.date];if(body.ground!=null)signature.push(body.ground,body.near??100);jobs.set(id,{id,terrainDisabled:true,status:'done',message:'Unobstructed sky calculated using ground elevation; no surrounding terrain trace.',result:TerrainOption.calculate(body),signature});return {id};}")
   text=text.replace("if('serviceWorker'in navigator)", "if(false&&'serviceWorker'in navigator)")
   # The local candidate server also proxies the existing Census JSONP lookup.
   text=text.replace("script.src='https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?'+new URLSearchParams({address,benchmark:'Public_AR_Current',format:'jsonp',callback:name});", "script.src=CandidateProxy.url('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?'+new URLSearchParams({address,benchmark:'Public_AR_Current',format:'jsonp',callback:name}));")
  if name == 'terrain-worker.js': text="importScripts('proxy.js');\n"+text
  if name == 'app.js':
   text='\n'.join(line+"\n if(typeof CandidateAtmosphere!=='undefined')CandidateAtmosphere.refreshProjector();" if line.lstrip().startswith("$('projectionClock').textContent=") else line for line in text.split('\n'))
   text=text.replace('cacheWritesEnabled=true;result=state.result;', 'TerrainOption.remember(input,state.result.terrain);cacheWritesEnabled=true;result=state.result;')
   text=text.replace('function updateGroundLookup(){', "function updateGroundLookup(){if(result&&!resultDirty&&result.terrain.disabled){$('groundLookup').textContent='Ground elevation: '+result.terrain.ground_m.toFixed(1)+' m · '+result.terrain.ground_source+'. Observer: '+result.terrain.observer_m.toFixed(1)+' m.';return;}")
   text=text.replace('result=cached.result;renderedKey=cached.key;', 'result=TerrainOption.enabled?cached.result:TerrainOption.calculate(input);renderedKey=cached.key;')
   text=text.replace("status('Starting terrain analysis…')", "status(TerrainOption.enabled?'Starting terrain analysis…':'Calculating unobstructed sky…')")
   text=text.replace('Terrain loaded and cached. Drag the view to look around; scroll to change time.', 'Sky ready. Drag the view to look around; scroll to change time.')
   text=text.replace("'COUNTDOWN TO LOCAL '+mode.toUpperCase()", "'COUNTDOWN TO LOCAL TERRAIN '+mode.toUpperCase()")
   text=text.replace("(state.past?'TIME SINCE ':'TIME UNTIL ')+$('eventMode').value.toUpperCase()", "(state.past?'TIME SINCE LOCAL TERRAIN ':'TIME UNTIL LOCAL TERRAIN ')+$('eventMode').value.toUpperCase()")
   text=text.replace("(state.past?'SINCE ':'UNTIL ')+$('eventMode').value.toUpperCase()", "(state.past?'SINCE LOCAL TERRAIN ':'UNTIL LOCAL TERRAIN ')+$('eventMode').value.toUpperCase()")
   text=text.replace('scale=w/fov,base=h*.64;', "scale=w/fov,base=typeof CandidateSkyViewport==='undefined'||document.body.classList.contains('projector')?h*.64:CandidateSkyViewport.base(h,scale,focus,result.terrain.horizon);")
   text=text.replace('Use Project selected location to show it on HDMI.', 'Trace sunrise and sunset to update this candidate.')
   anchor=' const layers=result.terrain.layers;'
   assert anchor in text
   text=text.replace(anchor," if(typeof CandidateAtmosphere!=='undefined')CandidateAtmosphere.renderSky(ctx,{sun,focus,scale,base,w,h});\n"+anchor)
   text=text.replace(" $('sunPosition').textContent="," if(typeof CandidateAtmosphere!=='undefined')CandidateAtmosphere.drawCompass(focus,fov);\n $('sunPosition').textContent=")
   text=text.replace('function showResult(preserveView=false){','function showResult(preserveView=false){if(typeof CandidateAtmosphere!==\'undefined\')CandidateAtmosphere.invalidate();')
  target=OUT/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(text,encoding='utf-8')
html=(ROOT/'static/index.html').read_text(encoding='utf-8').replace('/static/','./').replace('<body>','<body data-browser-edition="true">')
html=html.replace('COUNTDOWN TO LOCAL SUNSET','COUNTDOWN TO LOCAL TERRAIN SUNSET').replace('>UNTIL SUNSET<','>UNTIL LOCAL TERRAIN SUNSET<')
html=html.replace('<title>Local Sunset · Beyond the horizon</title>','<title>Local Sunset · Atmospheric candidate</title>')
html=html.replace('<script src="./countdown.js">','<script src="proxy.js"></script><script src="./vendor/tz.js"></script><script src="./cache-db.js"></script><script src="../terrain-option.js"></script><script src="./browser-api.js"></script><script src="../model.js?v=weather-wind-3"></script><script src="./countdown.js">')
html=html.replace('<script src="./app.js">', '<script src="./solar-core.js"></script><script src="./app.js">')
html=html.replace('</body>', '<script src="../peak-analysis.js"></script><script src="../candidate-layout.js"></script><script src="../viewport-policy.js"></script><script src="../sky-resize.js"></script><script src="../chart-markers.js"></script><script src="../sky-countdown.js"></script><script src="../forecast-refresh.js"></script><script src="../candidate-ui.js"></script></body>')
html=html.replace('</footer>', '<br>Point ground elevation: <a href="https://open-meteo.com/en/docs/elevation-api">Open-Meteo</a> / Copernicus DEM GLO-90.</footer>')
html=html.replace('</head>', '<link rel="stylesheet" href="../candidate.css"></head>')
html=html.replace('<section class="transport">', (HERE/'candidate-panel.html').read_text(encoding='utf-8')+'<section class="transport">')
html=html.replace('SIMULATED CLEAR SKY · BARE-EARTH TERRAIN','LOCAL CANDIDATE · BARE-EARTH TERRAIN')
html=html.replace('<div class="brand">', '<p class="candidate-banner">LOCAL PROTOTYPE · PRODUCTION UNCHANGED</p><div class="brand">')
html=html.replace('value="11" selected','value="11"').replace('value="10">Fast','value="10" selected>Fast')
html=html.replace('</head>', '<style>[data-browser-edition] .hdmi-sync,[data-browser-edition] #projectLocation,[data-browser-edition] #projectionLocation{display:none!important}</style></head>')
(OUT/'index.html').write_text(html,encoding='utf-8')
html=html.replace('</footer>', '<p><a href="about.html">About · Physics, algorithms &amp; data</a></p></footer>')
(OUT/'index.html').write_text(html,encoding='utf-8')
shutil.copyfile(HERE/'about.html', OUT/'about.html')
shutil.copyfile(HERE/'proxy.js', OUT/'proxy.js')
print('Built isolated candidate:',OUT)
