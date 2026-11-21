"""Prepare a small observed GOES cloud region; run with the optional netCDF4 dependency.
Coordinates are used locally to crop full CONUS products, never sent to NOAA.
"""
import argparse,json,math,xml.etree.ElementTree as ET
from datetime import datetime,timezone,timedelta
from pathlib import Path
import requests
import numpy as np
from netCDF4 import Dataset

CACHE=Path(__file__).resolve().parents[2]/'.cache/satellite'
NS={'s':'http://s3.amazonaws.com/doc/2006-03-01/'}

def product(kind,target):
 target=target.astimezone(timezone.utc)
 for ago in range(3):
  hour=target-timedelta(hours=ago)
  prefix=f'ABI-L2-{kind}C/{hour:%Y/%j/%H}/'
  response=requests.get('https://noaa-goes19.s3.amazonaws.com/',params={'list-type':'2','prefix':prefix},timeout=30);response.raise_for_status()
  keys=[e.text for e in ET.fromstring(response.content).findall('s:Contents/s:Key',NS)]
  eligible=[]
  for key in keys:
   stamp=key.split('_s')[1].split('_')[0][:13]
   when=datetime.strptime(stamp,'%Y%j%H%M%S').replace(tzinfo=timezone.utc)
   if when<=target:eligible.append((when,key))
  if eligible:
   when,key=max(eligible);CACHE.mkdir(parents=True,exist_ok=True);path=CACHE/Path(key).name
   if not path.exists():
    r=requests.get('https://noaa-goes19.s3.amazonaws.com/'+key,timeout=90);r.raise_for_status();path.write_bytes(r.content)
   return path,when,key
 raise ValueError('No recent '+kind+' satellite product available')

def sample(path,name,lats,lons,heights):
 with Dataset(path) as ds:
  v=ds.variables;proj=v['goes_imager_projection'];a=proj.semi_major_axis;b=proj.semi_minor_axis;H=proj.perspective_point_height+a
  lat=np.radians(lats);dlon=np.radians(lons-proj.longitude_of_projection_origin);e2=1-b*b/(a*a);N=a/np.sqrt(1-e2*np.sin(lat)**2)
  radial=(N+heights)*np.cos(lat);sx=H-radial*np.cos(dlon);sy=radial*np.sin(dlon);sz=(N*(1-e2)+heights)*np.sin(lat)
  # GOES ABI uses an x-sweep instrument: scan axes are not geographic angles.
  x=np.arcsin(sy/np.sqrt(sx*sx+sy*sy+sz*sz));y=np.arctan2(sz,sx);gx=np.asarray(v['x'][:]);gy=np.asarray(v['y'][:])
  ix=np.rint((x-gx[0])/(gx[1]-gx[0])).astype(int);iy=np.rint((y-gy[0])/(gy[1]-gy[0])).astype(int)
  valid=(ix>=0)&(ix<len(gx))&(iy>=0)&(iy<len(gy))
  image=np.ma.filled(v[name][:],np.nan) if v[name].dtype.kind=='f' else np.ma.filled(v[name][:].astype(float),np.nan)
  out=image[np.clip(iy,0,len(gy)-1),np.clip(ix,0,len(gx)-1)].astype(float);out[~valid]=np.nan
  if name in ('HT','COD') and 'DQF' in v:
   quality=np.ma.filled(v['DQF'][:],255);out[quality[np.clip(iy,0,len(gy)-1),np.clip(ix,0,len(gx)-1)]!=0]=np.nan
  return out

def prepare(lat,lon,target,radius=220,size=96):
 if not (20<=lat<=55 and -125<=lon<=-65):raise ValueError('First experiment supports the contiguous US only')
 if not (32<=size<=192 and 50<=radius<=400):raise ValueError('Invalid region size')
 mask,when,key=product('ACM',target);top,top_time,top_key=product('ACHA',when+timedelta(minutes=5))
 if abs((top_time-when).total_seconds())>900:raise ValueError('Cloud mask and height observations differ by more than 15 minutes')
 south=lat-radius/111.2;north=lat+radius/111.2;west=lon-radius/(111.2*math.cos(math.radians(lat)));east=2*lon-west
 lons,lats=np.meshgrid(np.linspace(west,east,size),np.linspace(south,north,size));zeros=np.zeros_like(lats)
 ht=sample(top,'HT',lats,lons,zeros);ht=sample(top,'HT',lats,lons,np.nan_to_num(ht))
 cloud=sample(mask,'BCM',lats,lons,np.nan_to_num(ht))
 optical=np.full_like(ht,np.nan);optical_source=None
 try:
  cod,cod_time,cod_key=product('COD',when+timedelta(minutes=5))
  if abs((cod_time-when).total_seconds())<=900:
   optical=sample(cod,'COD',lats,lons,np.nan_to_num(ht));optical_source=cod_key
 except (ValueError,requests.RequestException):pass
 # Missing retrievals stay unknown; never silently invent a cloud height.
 cells=[]
 for c,h,o in zip(cloud.ravel(),ht.ravel(),optical.ravel()):
  cells.append([None if not np.isfinite(c) else int(c),None if not np.isfinite(h) or h<0 or h>25000 else round(float(h)),None if not np.isfinite(o) or o<0 or o>1000 else round(float(o),2)])
 return dict(schema='localsunset-satellite-v1',observedAt=when.isoformat(),heightObservedAt=top_time.isoformat(),source='NOAA GOES-19 ABI',products=[key,top_key,optical_source],bounds=[west,south,east,north],width=size,height=size,cells=cells)

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--lat',type=float,required=True);p.add_argument('--lon',type=float,required=True);p.add_argument('--time',help='UTC ISO timestamp; default latest');p.add_argument('--radius',type=float,default=220);p.add_argument('--size',type=int,default=96);p.add_argument('--output',type=Path,default=Path(__file__).with_name('satellite-region.json'));args=p.parse_args()
 target=datetime.fromisoformat(args.time.replace('Z','+00:00')) if args.time else datetime.now(timezone.utc)
 if target.tzinfo is None:p.error('--time must include a timezone')
 data=prepare(args.lat,args.lon,target,args.radius,args.size);args.output.write_text(json.dumps(data,separators=(',',':')),encoding='utf-8');print('Prepared',data['observedAt'],len(data['cells']),'cells;',args.output.stat().st_size,'bytes')
