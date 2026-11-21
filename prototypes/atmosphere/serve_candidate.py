"""Local prototype HTTP server with an allowlisted public-data proxy."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
import requests
import argparse
import json, math, threading
from datetime import datetime, timezone
SATELLITE_LOCK=threading.Lock()
SATELLITE_CACHE={}

ROOT = Path(__file__).resolve().parents[2]
HOSTS = {'api.zippopotam.us','photon.komoot.io','geocoding-api.open-meteo.com',
         'api.open-meteo.com','geocoding.geo.census.gov','elevation.nationalmap.gov',
         's3.amazonaws.com','gis.ngdc.noaa.gov'}

class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT),**kwargs)
 def end_headers(self):
  if urlsplit(self.path).path!='/prototype-data': self.send_header('Cache-Control','no-store')
  super().end_headers()
 def do_GET(self):
  route=urlsplit(self.path)
  if route.path=='/satellite-region':
   try:
    q=parse_qs(route.query);lat=round(float(q['lat'][0]),2);lon=round(float(q['lon'][0]),2)
    target=datetime.fromisoformat(q['time'][0].replace('Z','+00:00'))
    if not math.isfinite(lat+lon) or not -70<=lat<=70 or not -180<=lon<=180 or target.tzinfo is None:raise ValueError('Invalid region/time')
    now=datetime.now(timezone.utc);target=min(target,now);key=(lat,lon,int(target.timestamp()//300))
    from prepare_satellite import prepare
    with SATELLITE_LOCK:
     if key not in SATELLITE_CACHE:
      data=prepare(lat,lon,target)
      if abs((datetime.fromisoformat(data['observedAt'])-target).total_seconds())>5400:raise ValueError('No satellite observation within 90 minutes of requested time')
      if len(SATELLITE_CACHE)>=8:SATELLITE_CACHE.pop(next(iter(SATELLITE_CACHE)))
      SATELLITE_CACHE[key]=data
     payload=json.dumps(SATELLITE_CACHE[key],separators=(',',':')).encode()
    self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(payload)));self.end_headers();self.wfile.write(payload)
   except Exception as exc:
    message='Satellite retrieval unavailable: '+(str(exc) if isinstance(exc,(ValueError,KeyError,ImportError)) else 'provider/network failure')
    payload=json.dumps({'error':message}).encode();self.send_response(503);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(payload)
   return
  if route.path!='/prototype-data':
   if 'If-Modified-Since' in self.headers: del self.headers['If-Modified-Since']
   return super().do_GET()
  target=parse_qs(route.query).get('url',[''])[0];parts=urlsplit(target)
  if parts.scheme!='https' or parts.hostname not in HOSTS or parts.username or parts.password or parts.port not in (None,443):
   self.send_error(400,'Unsupported public-data provider');return
  if parts.hostname=='s3.amazonaws.com' and not parts.path.startswith('/elevation-tiles-prod/terrarium/'):
   self.send_error(400,'Unsupported terrain path');return
  try:
   r=requests.get(target,timeout=35,allow_redirects=False,headers={'User-Agent':'LocalSunset-local-prototype/0.1'})
   if 300<=r.status_code<400: self.send_error(502,'Provider redirect is not supported');return
   self.send_response(r.status_code)
   self.send_header('Content-Type',r.headers.get('Content-Type','application/octet-stream'))
   self.send_header('Content-Length',str(len(r.content)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(r.content)
  except requests.RequestException: self.send_error(502,'Public-data provider unavailable; retained scene is unchanged')
 def log_message(self,fmt,*args):
  # Do not log query strings containing selected addresses or coordinates.
  pass

if __name__=='__main__':
 parser=argparse.ArgumentParser(description='Serve the isolated atmospheric candidate')
 parser.add_argument('--host',default='127.0.0.1')
 parser.add_argument('--port',type=int,default=5175)
 args=parser.parse_args()
 print('Candidate listening on '+args.host+':'+str(args.port),flush=True)
 ThreadingHTTPServer((args.host,args.port),Handler).serve_forever()
