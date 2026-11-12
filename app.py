from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
from zoneinfo import ZoneInfo
from pathlib import Path
from threading import Lock, local, Condition
import json
import math
import os
import uuid
import time
from urllib.parse import urlsplit
import requests
from flask import Flask, jsonify, request, send_from_directory, Response
from timezonefinder import TimezoneFinder
from terrain import Terrain, RasterTerrain, polar_terrain
from solar import calculate_day
import cache_store
from geocoding import search_address, zip_places, valid_zip, inline_zip
from network_access import protect, trusted_local_request

ROOT = Path(__file__).parent
app = Flask(__name__, static_folder='static')
app.config['MAX_CONTENT_LENGTH'] = 32768
finder = TimezoneFinder(in_memory=False)
pool = ThreadPoolExecutor(max_workers=1)
jobs, lock = {}, Lock()
locations_path = ROOT/'locations.json'
display_config_path = ROOT/'.display-config.json'
display_view=dict(revision=0,view=None)
display_ack=dict(revision=0,updated_ms=0)
activity_path=ROOT/'.activity-state.json'
try:
    activity_last_ms=float(json.loads(activity_path.read_text())['last_input_ms'])
except (OSError,ValueError,KeyError,TypeError):
    activity_last_ms=time.time()*1000
activity_saved_ms=0
relay_state=local()


def display_relay(endpoint):
    target=app.config.get('DISPLAY_SERVER_URL','').rstrip('/')
    if not target: return None
    if target==request.host_url.rstrip('/'):
        return jsonify(error='Display relay cannot point to itself.'),400
    try:
        if not hasattr(relay_state,'session'):relay_state.session=requests.Session()
        upstream=relay_state.session.request(request.method,target+endpoint,
                                  json=request.get_json() if request.method in ('POST','PUT','PATCH') else None,
                                  headers={key:request.headers[key] for key in ('If-Match','X-Display-Intent') if key in request.headers},timeout=15)
        return Response(upstream.content,status=upstream.status_code,mimetype='application/json',
                        headers={'Cache-Control':'no-store'})
    except requests.RequestException:
        return jsonify(error='Cannot reach the HDMI display server. Check the Pi connection.'),502


@app.get('/api/display-target')
def display_target():
    return jsonify(url=app.config.get('DISPLAY_SERVER_URL') or request.host_url.rstrip('/'))


@app.route('/api/display-ack',methods=['GET','POST'])
def display_confirmation():
    global display_ack
    if request.method=='POST':
        try:revision=int(number(request.get_json(),'revision',1,1e12))
        except (ValueError,KeyError,TypeError) as exc:return jsonify(error=str(exc)),400
        if trusted_local_request():
            with lock:
                if revision<=display_view['revision']:
                    display_ack=dict(revision=revision,updated_ms=time.time()*1000)
    with lock:return jsonify(display_ack)


@app.route('/api/display-view',methods=['GET','PUT'])
def display_orientation():
    relayed=display_relay('/api/display-view')
    if relayed is not None:return relayed
    global display_view
    if request.method=='PUT':
        try:
            data=request.get_json()
            view=dict(time_ms=number(data,'time_ms',-62135596800000,253402300799999),
                      azimuth=number(data,'azimuth',0,360),
                      config_revision=int(number(data,'config_revision',1,1e12)))
            if data.get('event') not in ('sunrise','sunset'):raise ValueError('Invalid event')
            view['event']=data['event']
            for key in ('playing','live'):
                if not isinstance(data.get(key),bool):raise ValueError(f'Invalid {key}')
                view[key]=data[key]
        except (ValueError,KeyError,TypeError) as exc:return jsonify(error=str(exc)),400
        with lock:
            current=json.loads(display_config_path.read_text()) if display_config_path.exists() else {'revision':0}
            if view['config_revision']!=current['revision']:
                return jsonify(error='Display configuration changed. Send the current settings first.'),409
            view['updated_ms']=time.time()*1000
            display_view=dict(revision=display_view['revision']+1,view=view)
    with lock:
        response=jsonify(display_view)
        response.headers['Cache-Control']='no-store'
        return response


@app.before_request
def access_control():
    blocked=protect(app)
    if blocked is not None:return blocked
    if app.config.get('DISPLAY_SERVER_URL') and request.path.startswith('/api/') and request.path!='/api/display-target':
        return display_relay(request.full_path.rstrip('?'))


@app.route('/api/display-config',methods=['GET','PUT'])
def display_configuration():
    relayed=display_relay('/api/display-config')
    if relayed is not None:return relayed
    if request.method=='PUT':
        try:
            data=request.get_json()
            settings=dict(name=str(data.get('name','Remote location')).strip()[:120],
                          lat=number(data,'lat',-90,90),lon=number(data,'lon',-180,180),
                          height=number(data,'height',0,10000),radius=number(data,'radius',5,200),
                          zoom=int(number(data,'zoom',9,13)))
            for key,choices,default in [('source',('auto','global','usgs'),'auto'),('event',('sunrise','sunset'),'sunset')]:
                if data.get(key,default) not in choices:
                    raise ValueError(f'Invalid {key}')
                settings[key]=data.get(key,default)
            for key in ('today','live','projector'):
                if not isinstance(data.get(key,True),bool):
                    raise ValueError(f'{key} must be true or false')
                settings[key]=data.get(key,True)
            settings['date']=date.fromisoformat(data['date']).isoformat()
            if data.get('ground') is not None:
                settings['ground']=number(data,'ground',-12000,10000)
                settings['near']=number(data,'near',50,1000) if data.get('near') is not None else 100
        except (KeyError,TypeError,ValueError) as exc:
            return jsonify(error=str(exc)),400
    with lock:
        current=json.loads(display_config_path.read_text(encoding='utf-8')) if display_config_path.exists() else dict(revision=0,config=None)
        if request.method=='PUT':
            expected=request.headers.get('If-Match')
            if expected is None and request.headers.get('X-Display-Intent')!='select':
                return jsonify(error='Refresh this control page, then select Project selected location.'),409
            if expected is not None:
                try:expected=int(expected.strip('"'))
                except ValueError:return jsonify(error='Invalid display revision.'),400
                if expected!=current['revision']:
                    return jsonify(error='The projected location changed elsewhere. Use Project selected location to switch it.'),409
            current=dict(revision=current['revision']+1,config=settings)
            temporary=display_config_path.with_suffix('.tmp')
            temporary.write_text(json.dumps(current,indent=2),encoding='utf-8')
            temporary.replace(display_config_path)
        response=jsonify(current)
        response.headers['Cache-Control']='no-store'
        return response


scene_style_path = ROOT/'.scene-style.json'


@app.route('/api/scene-style', methods=['GET', 'PUT'])
def scene_style():
    if request.method == 'PUT':
        try:
            data = request.get_json()
            settings = {key: data.get(key, default) for key, default in [('rays', True), ('trees', False), ('sky_only', False), ('clock12', False), ('sky_labels', False)]}
            if any(not isinstance(value, bool) for value in settings.values()):
                raise ValueError('Rays, trees, and sky-only must be true or false')
            settings['strength'] = number(data, 'strength', 0, 100)
        except (KeyError, TypeError, ValueError) as exc:
            return jsonify(error=str(exc)), 400
    with lock:
        current = json.loads(scene_style_path.read_text(encoding='utf-8')) if scene_style_path.exists() else dict(
            revision=0, rays=True, trees=False, sky_only=False, clock12=False, sky_labels=False, strength=65)
        if request.method == 'PUT':
            current = dict(settings, revision=current['revision'] + 1)
            temporary = scene_style_path.with_suffix('.tmp')
            temporary.write_text(json.dumps(current, indent=2), encoding='utf-8')
            temporary.replace(scene_style_path)
    return jsonify(current)


calibration_path = ROOT/'.projector-calibration.json'
calibration_live = {}
calibration_changed = Condition(lock)


@app.route('/api/projector-calibration', methods=['GET', 'PUT'])
def projector_calibration():
    # Projector geometry belongs to the device, independently of saved locations.
    if request.method == 'PUT':
        try:
            data = request.get_json()
            settings = {key: data.get(key, False) for key in ('enabled', 'grid')}
            if any(not isinstance(value, bool) for value in settings.values()):
                raise ValueError('Enabled and grid must be true or false')
            preview = data.get('preview', False)
            if not isinstance(preview, bool):
                raise ValueError('Preview must be true or false')
            settings['fov'] = number(data, 'fov', 30, 120) if 'fov' in data else 75
            action = data.get('action', 'update')
            if action not in ('update', 'save_default', 'restore_default'):
                raise ValueError('Invalid calibration action')
            settings['corners'] = {}
            for corner in ('tl', 'tr', 'br', 'bl'):
                point = data['corners'][corner]
                settings['corners'][corner] = {axis: number(point, axis, 0, 25) for axis in ('x', 'y')}
        except (KeyError, TypeError, ValueError) as exc:
            return jsonify(error=str(exc)), 400
    with lock:
        cache_key = str(calibration_path)
        current = calibration_live.get(cache_key)
        if current is None:
            current = json.loads(calibration_path.read_text(encoding='utf-8')) if calibration_path.exists() else dict(
                revision=0, enabled=True, grid=False, fov=75,
                corners={corner: dict(x=0, y=0) for corner in ('tl', 'tr', 'br', 'bl')})
        current.setdefault('fov', 75)
        if request.method == 'PUT':
            defaults = current.get('default')
            if action == 'restore_default':
                if defaults is None:
                    return jsonify(error='No default alignment has been saved yet.'), 400
                settings = dict(defaults, grid=False)
                preview = False
            if action == 'save_default':
                defaults = {key: settings[key] for key in ('enabled', 'fov', 'corners')}
                preview = False
            current = dict(settings, revision=current['revision'] + 1)
            if defaults is not None:
                current['default'] = defaults
            if not preview:
                temporary = calibration_path.with_suffix('.tmp')
                temporary.write_text(json.dumps(current, indent=2), encoding='utf-8')
                temporary.replace(calibration_path)
        calibration_live[cache_key] = current
        if request.method == 'PUT':
            calibration_changed.notify_all()
    return jsonify(current)


@app.get('/api/projector-calibration/events')
def calibration_events():
    # The Pi kiosk receives updates directly; polling remains a reconnect fallback.
    def events():
        previous = -1
        while True:
            with calibration_changed:
                state = calibration_live.get(str(calibration_path))
                if state is None:
                    state = json.loads(calibration_path.read_text(encoding='utf-8')) if calibration_path.exists() else dict(
                        revision=0, enabled=True, grid=False, fov=75,
                        corners={name: dict(x=0, y=0) for name in ('tl','tr','br','bl')})
                if state['revision'] == previous:
                    calibration_changed.wait(timeout=10)
                    state = calibration_live.get(str(calibration_path), state)
                payload = json.dumps(state) if state['revision'] != previous else None
                previous = state['revision']
            yield ('data: ' + payload + '\n\n') if payload else ': keepalive\n\n'
    return Response(events(), mimetype='text/event-stream', headers={'Cache-Control':'no-store', 'X-Accel-Buffering':'no'})


@app.after_request
def fresh_application(response):
    if request.path == '/' or request.path.startswith('/static/') or request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store, max-age=0'
    return response


@app.get('/')
def index():
    if os.environ.get('LOCAL_SUNSET_PI') == '1':
        html = (ROOT/'static/index.html').read_text(encoding='utf-8')
        html = html.replace('<body>', '<body data-low-power="true">')
        html = html.replace('value="11" selected', 'value="11"').replace('value="10">Fast', 'value="10" selected>Fast')
        html = html.replace('id="radius" type="number" min="5" max="200" value="60"',
                            'id="radius" type="number" min="5" max="200" value="30"')
        return Response(html, mimetype='text/html')
    return send_from_directory(app.static_folder, 'index.html')


@app.get('/api/health')
def health():
    return jsonify(status='ok')


@app.route('/api/activity',methods=['GET','POST'])
def user_activity():
    global activity_last_ms,activity_saved_ms
    with lock:
        now=time.time()*1000
        if request.method=='POST':
            activity_last_ms=now
            if now-activity_saved_ms>=15000:
                temporary=activity_path.with_suffix('.tmp')
                temporary.write_text(json.dumps(dict(last_input_ms=now)))
                temporary.replace(activity_path)
                activity_saved_ms=now
        return jsonify(last_input_ms=activity_last_ms,idle_ms=max(0,now-activity_last_ms))


@app.get('/api/today')
def local_today():
    try:
        lat = number(request.args,'lat',-90,90)
        lon = number(request.args,'lon',-180,180)
        zone = finder.timezone_at(lat=lat,lng=lon) or 'UTC'
        return jsonify(date=datetime.now(ZoneInfo(zone)).date().isoformat(),timezone=zone)
    except (ValueError, KeyError, TypeError) as exc:
        return jsonify(error=str(exc)),400


def number(data, name, minimum, maximum):
    v = float(data[name])
    if not math.isfinite(v) or not minimum <= v <= maximum:
        raise ValueError(f'{name} must be between {minimum} and {maximum}')
    return v


@app.post('/api/calculate')
def calculate():
    try:
        data = request.get_json()
        lat, lon = number(data, 'lat', -90, 90), number(data, 'lon', -180, 180)
        height = number(data, 'height', 0, 10000)
        ground = number(data,'ground',-12000,10000) if data.get('ground') is not None else None
        near = (number(data,'near',50,1000) if data.get('near') is not None else 100) if ground is not None else 0
        radius = number(data, 'radius', 5, 200)
        zoom = int(number(data, 'zoom', 9, 13))
        day = date.fromisoformat(data['date'])
        source = data.get('source','auto')
        if source not in ('auto','global','usgs'):
            raise ValueError('Unknown elevation source')
        zone = finder.timezone_at(lat=lat, lng=lon) or 'UTC'
        signature=(lat,lon,height,radius,zoom,source,day.isoformat())
        if ground is not None:signature+=(ground,near)
        dem=cache_store.dem_identity()
        identity=[signature,dem]
        with lock:
            for existing_id,existing in jobs.items():
                if existing.get('signature')==signature and existing.get('cache_identity',identity)==identity and existing['status'] in ('queued','running','done'):
                    return jsonify(id=existing_id),202
            # The single worker serializes terrain work. Different locations queue
            # instead of rejecting the newer selection and leaving old results visible.
            for expired in [key for key, value in jobs.items() if value['status'] in ('done','error')][:-6]:
                jobs.pop(expired)
            cached=cache_store.read('results',identity)
            if cached is not None:
                job_id=uuid.uuid4().hex
                jobs[job_id]=dict(status='done',message='Loaded cached calculation',signature=signature,cache_identity=identity,result=cached)
                return jsonify(id=job_id),202
            job_id = uuid.uuid4().hex
            jobs[job_id] = dict(status='queued', message='Waiting for terrain',signature=signature,cache_identity=identity)
        def work():
            job = jobs[job_id]
            try:
                job.update(status='running', message='Downloading and tracing terrain. First visits may take several minutes.')
                local_dem = os.environ.get('LOCAL_DEM')
                terrain_key=[lat,lon,height,radius,zoom,source,dem]
                if ground is not None:terrain_key.extend([ground,near])
                terrain=cache_store.read('horizons',terrain_key)
                if terrain is None:
                    provider = (RasterTerrain(local_dem,lat,lon) if local_dem else
                                polar_terrain(lat,lon,radius) if abs(lat)>80 else
                                Terrain(lat,lon,zoom,source))
                    terrain = provider.horizon(lat, lon, height, radius, lambda message: job.update(message=message),**({'ground_override':ground,'near_distance':near} if ground is not None else {}))
                    cache_store.write('horizons',terrain_key,terrain)
                job['message'] = 'Finding solar disk intersections and local sunset…'
                result = calculate_day(lat, lon, day, zone, terrain)
                cache_store.write('results',identity,result)
                job.update(status='done', result=result, message='Ready')
            except Exception as exc:
                app.logger.exception('Calculation failed')
                job.update(status='error', error=str(exc), message='Calculation failed; no result was substituted.')
        pool.submit(work)
        return jsonify(id=job_id), 202
    except (ValueError, KeyError, TypeError) as exc:
        return jsonify(error=str(exc)), 400


@app.route('/api/cache',methods=['GET','DELETE'])
def runtime_cache():
    with lock:
        busy=any(job['status'] in ('queued','running') for job in jobs.values())
        if request.method=='DELETE':
            if busy:return jsonify(error='A calculation is running. Clear cache after it finishes.'),409
            try:cache_store.clear()
            except (OSError,ValueError) as exc:return jsonify(error=str(exc)),400
            jobs.clear()
        return jsonify(**cache_store.stats(),busy=busy)


@app.get('/api/jobs/<job_id>')
def job_status(job_id):
    with lock:
        job = jobs.get(job_id)
        return (jsonify(job), 200) if job else (jsonify(error='Job not found'), 404)


@app.get('/api/search')
def search():
    query = request.args.get('q','').strip()[:200]
    zip_code = request.args.get('zip','').strip()
    if len(query) < 3:
        return jsonify(error='Enter at least three characters'), 400
    if zip_code and not valid_zip(zip_code):
        return jsonify(error='Use a five-digit US ZIP or ZIP+4 (for example, 80302 or 80302-1234).'), 400
    detected = inline_zip(query)
    if zip_code and detected and zip_code[:5] != detected[:5]:
        return jsonify(error='The address ZIP and ZIP field disagree. Please correct one of them.'), 400
    try:
        return jsonify(search_address(query,zip_code))
    except (requests.RequestException, ValueError, KeyError) as exc:
        return jsonify(error=f'Address search unavailable: {exc}. You can still enter coordinates.'), 502


@app.get('/api/zip/<zip_code>')
def zip_lookup(zip_code):
    if not valid_zip(zip_code):
        return jsonify(error='Enter a five-digit US ZIP or ZIP+4.'), 400
    try:
        result = zip_places(zip_code[:5])
        return (jsonify(result),200) if result else (jsonify(error='ZIP not found. You can still search the full address.'),404)
    except (requests.RequestException, ValueError, KeyError):
        return jsonify(error='ZIP city lookup is temporarily unavailable. Street address search still works.'),502


@app.route('/api/locations', methods=['GET','POST'])
def locations():
    with lock:
        saved = json.loads(locations_path.read_text('utf-8')) if locations_path.exists() else []
        if request.method == 'POST':
            try:
                data = request.get_json()
                item = dict(name=str(data['name']).strip()[:120], lat=number(data,'lat',-90,90),
                            lon=number(data,'lon',-180,180), height=number(data,'height',0,10000))
                if data.get('ground') is not None:
                    item['ground']=number(data,'ground',-12000,10000)
                    item['near']=number(data,'near',50,1000) if data.get('near') is not None else 100
                if not item['name']:
                    raise ValueError('Enter a location name')
                saved = [s for s in saved if s['name'] != item['name']] + [item]
                temp = locations_path.with_suffix('.tmp')
                temp.write_text(json.dumps(saved, indent=2), encoding='utf-8')
                temp.replace(locations_path)
            except (ValueError, KeyError, TypeError) as exc:
                return jsonify(error=str(exc)), 400
        return jsonify(saved)


@app.delete('/api/locations/<name>')
def delete_location(name):
    with lock:
        saved = json.loads(locations_path.read_text('utf-8')) if locations_path.exists() else []
        temp = locations_path.with_suffix('.tmp')
        temp.write_text(json.dumps([s for s in saved if s['name'] != name], indent=2), encoding='utf-8')
        temp.replace(locations_path)
    return jsonify(ok=True)


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=int(os.environ.get('PORT','5000')), threaded=True)
