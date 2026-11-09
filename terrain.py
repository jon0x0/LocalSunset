"""Automatic, disk-cached terrain acquisition and spherical horizon tracing."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from io import BytesIO
import math
import threading
import uuid
import numpy as np
import requests
from PIL import Image

R = 6371008.8
USGS = 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage'
CACHE = Path(__file__).parent / '.cache' / 'terrain'
CACHE.mkdir(parents=True, exist_ok=True)
_locks = [threading.Lock() for _ in range(64)]


def destination(lat, lon, az, distance):
    p, l, a, d = np.radians(lat), np.radians(lon), np.radians(az), np.asarray(distance) / R
    # Cartesian tangent basis remains well defined at the exact geographic poles.
    north = (-np.sin(p)*np.cos(l), -np.sin(p)*np.sin(l), np.cos(p))
    east = (-np.sin(l), np.cos(l), 0)
    origin = (np.cos(p)*np.cos(l), np.cos(p)*np.sin(l), np.sin(p))
    x,y,z = [origin[i]*np.cos(d)+(north[i]*np.cos(a)+east[i]*np.sin(a))*np.sin(d) for i in range(3)]
    return np.degrees(np.arctan2(z,np.hypot(x,y))), (np.degrees(np.arctan2(y,x))+180)%360-180


def pixels(lat, lon, zoom):
    n = 256 * 2**zoom
    lat = np.clip(lat, -85.0511287, 85.0511287)
    return (np.asarray(lon)+180)/360*n, (1-np.arcsinh(np.tan(np.radians(lat)))/np.pi)/2*n


class Terrain:
    def __init__(self, lat, lon, zoom=11, source='auto'):
        self.zoom = zoom
        # USGS service also covers Alaska, Hawaii, Puerto Rico and US territories;
        # attempt it for these bounds, with explicit per-tile fallback if unavailable.
        in_us = ((24 <= lat <= 50 and -126 <= lon <= -66) or
                 (50 <= lat <= 72 and -180 <= lon <= -129) or
                 (18 <= lat <= 23 and -161 <= lon <= -154) or
                 (17 <= lat <= 19 and -68 <= lon <= -64))
        self.source = 'usgs' if source == 'usgs' or (source == 'auto' and in_us) else 'global'
        self.used = set()
        self.tiles = {}

    def tile(self, x, y):
        n = 2**self.zoom
        x, y = int(x) % n, max(0, min(n-1, int(y)))
        key = (x, y)
        if key in self.tiles:
            return self.tiles[key]
        name = f'{self.source}-{self.zoom}-{x}-{y}'
        path = CACHE / (name+'.npz')
        with _locks[hash(name) % len(_locks)]:
            if path.exists():
                with np.load(path, allow_pickle=False) as data:
                    heights, actual = data['heights'].copy(), str(data['source'])
            else:
                actual = self.source
                try:
                    if actual != 'usgs':
                        raise ValueError('global requested')
                    extent = 20037508.342789244
                    size = 2*extent/n
                    west, north = -extent+x*size, extent-y*size
                    params = dict(f='image', bbox=f'{west},{north-size},{west+size},{north}',
                                  bboxSR=3857, imageSR=3857, size='256,256', format='tiff',
                                  pixelType='F32', noData=-999999, interpolation='RSP_BilinearInterpolation',
                                  renderingRule='{"rasterFunction":"None"}')
                    response = requests.get(USGS, params=params, timeout=60)
                    response.raise_for_status()
                    heights = np.array(Image.open(BytesIO(response.content)), dtype=np.float32)
                    if heights.shape != (256, 256) or np.any(~np.isfinite(heights)) or np.any(heights < -12000):
                        raise ValueError('USGS no-data or invalid tile')
                except (requests.RequestException, ValueError, OSError):
                    actual = 'global'
                    response = requests.get(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{self.zoom}/{x}/{y}.png', timeout=45)
                    response.raise_for_status()
                    rgb = np.array(Image.open(BytesIO(response.content)).convert('RGB'), dtype=np.float32)
                    heights = rgb[:,:,0]*256 + rgb[:,:,1] + rgb[:,:,2]/256 - 32768
                temp = path.with_name(path.stem+'-'+uuid.uuid4().hex+'.npz')
                np.savez_compressed(temp, heights=heights, source=actual)
                temp.replace(path)
        self.used.add(actual)
        self.tiles[key] = heights
        return heights

    def sample(self, lat, lon):
        px, py = pixels(lat, lon, self.zoom)
        # DEM pixels describe cell centers. Interpolate across tile seams.
        px, py = np.broadcast_arrays(np.asarray(px)-0.5, np.asarray(py)-0.5)
        shape = px.shape
        px, py = px.ravel(), py.ravel()
        ix, iy = np.floor(px).astype(int), np.floor(py).astype(int)
        out = np.zeros(px.shape)
        for dx, dy, weight in [(0,0,(1-(px-ix))*(1-(py-iy))), (1,0,(px-ix)*(1-(py-iy))),
                               (0,1,(1-(px-ix))*(py-iy)), (1,1,(px-ix)*(py-iy))]:
            gx, gy = ix+dx, iy+dy
            keys = np.stack((gx//256, gy//256), axis=1)
            unique = np.unique(keys, axis=0)
            with ThreadPoolExecutor(max_workers=6) as pool:
                list(pool.map(lambda k: self.tile(*k), unique))
            for tx, ty in unique:
                mask = (keys[:,0] == tx) & (keys[:,1] == ty)
                out[mask] += self.tile(tx,ty)[gy[mask] % 256, gx[mask] % 256] * weight[mask]
        return out.reshape(shape)

    def horizon(self, lat, lon, height, radius_km=60, progress=lambda message: None):
        ground = float(self.sample(lat, lon))
        observer = ground+height
        azimuths = np.arange(0, 360, .25)
        # Dense nearby samples; at distance, step by at most one terrain pixel.
        spacing = getattr(self, 'spacing', 156543.03 * math.cos(math.radians(lat)) / 2**self.zoom)
        if not hasattr(self, 'spacing') and math.pi*(radius_km*1000/(spacing*256))**2 > 512:
            raise ValueError('This detail/range combination would download too many tiles. Reduce range or terrain detail (especially near the poles).')
        distances = np.unique(np.concatenate((np.geomspace(2, 1000, 100),
                                               np.arange(1000, radius_km*1000+spacing, spacing))))
        angle = distances/R
        # Beyond DEM radius assume sea-level sphere, include observer's sea horizon.
        dip = -math.degrees(math.acos(R/(R+max(0,observer))))
        profiles, layer_chunks = [], [[], [], []]
        # Bound temporary array memory for Raspberry Pi; cache only needed DEM tiles.
        for index, chunk in enumerate(np.array_split(azimuths, 30)):
            progress(f'Tracing terrain horizon: {index+1}/30 sectors. Elevation tiles are cached automatically.')
            lat2, lon2 = destination(lat, lon, chunk[:,None], distances[None,:])
            heights = self.sample(lat2, lon2)
            vertical = (R+heights)*np.cos(angle)-(R+observer)
            horizontal = (R+heights)*np.sin(angle)
            angles = np.degrees(np.arctan2(vertical, horizontal))
            profiles.extend(np.maximum(angles.max(axis=1), dip).tolist())
            for i, limit in enumerate((2000, 10000, radius_km*1000+spacing)):
                layer_chunks[i].extend(np.maximum(angles[:,distances <= limit].max(axis=1), dip).tolist())
        return dict(ground_m=ground, observer_m=observer, azimuths=azimuths.tolist(),
                    horizon=profiles, layers=layer_chunks, sources=sorted(self.used),
                    pixel_m=round(spacing,1), radius_km=radius_km)


class RasterTerrain(Terrain):
    """A user-provided georeferenced DEM, read in bounded raster windows."""
    def __init__(self, path, lat, lon, source='local GeoTIFF'):
        import rasterio
        from rasterio.warp import transform
        self.path, self.zoom = path, 11
        self.used = {source}
        with rasterio.open(path) as dem:
            if not dem.crs:
                raise ValueError('DEM needs a coordinate reference system')
            self.crs, self.affine, self.nodata = dem.crs, dem.transform, dem.nodata
            self.width, self.height = dem.width, dem.height
            if dem.crs.is_geographic:
                self.spacing = abs(dem.transform.e)*111195
            else:
                self.spacing = max(abs(dem.transform.a),abs(dem.transform.e))*dem.crs.linear_units_factor[1]
            self.spacing = max(2,self.spacing)

    def sample(self, lat, lon):
        import rasterio
        from rasterio.warp import transform
        from rasterio.windows import Window
        lat, lon = np.broadcast_arrays(lat,lon)
        x,y = transform('EPSG:4326',self.crs,lon.ravel().tolist(),lat.ravel().tolist())
        inv = ~self.affine
        x,y = np.asarray(x),np.asarray(y)
        px,py = inv.a*x+inv.b*y+inv.c, inv.d*x+inv.e*y+inv.f
        px,py = px-.5,py-.5
        ix,iy = np.floor(px).astype(int),np.floor(py).astype(int)
        if np.any(ix<0) or np.any(iy<0) or np.any(ix+1>=self.width) or np.any(iy+1>=self.height):
            raise ValueError('DEM does not cover the entire terrain search area. Choose a larger DEM or smaller range.')
        out = np.zeros(px.shape)
        # Read only blocks touched by this group of rays, never the entire GeoTIFF.
        keys = np.stack((ix//256,iy//256),axis=1)
        with rasterio.open(self.path) as dem:
            for bx,by in np.unique(keys,axis=0):
                mask=(keys[:,0]==bx)&(keys[:,1]==by)
                block=dem.read(1,window=Window(bx*256,by*256,min(257,self.width-bx*256),min(257,self.height-by*256)),masked=True)
                rx,ry=ix[mask]-bx*256,iy[mask]-by*256
                dx,dy=px[mask]-ix[mask],py[mask]-iy[mask]
                values=(block[ry,rx]*(1-dx)*(1-dy)+block[ry,rx+1]*dx*(1-dy)+
                        block[ry+1,rx]*(1-dx)*dy+block[ry+1,rx+1]*dx*dy)
                if np.any(np.ma.getmaskarray(values)) or np.any(~np.isfinite(values)):
                    raise ValueError('DEM contains missing terrain in the search area')
                if 'NOAA polar mosaic' in self.used:
                    # NOAA includes ocean bathymetry. The observer stands on the
                    # water/ice surface, rather than on the Arctic seafloor.
                    values = np.maximum(values, 0)
                out[mask]=values
        return out.reshape(lat.shape)


def polar_terrain(lat, lon, radius_km):
    """NOAA's global elevation mosaic, exported in a polar projection."""
    import hashlib
    from rasterio.warp import transform
    crs = 3413 if lat>=0 else 3031
    x,y=transform('EPSG:4326',f'EPSG:{crs}',[lon],[lat])
    # 2x range accounts for projection scale and interpolation margins.
    extent=max(10000,radius_km*2000)
    box=(x[0]-extent,y[0]-extent,x[0]+extent,y[0]+extent)
    signature=hashlib.sha256(repr((crs,box)).encode()).hexdigest()[:24]
    path=CACHE/f'noaa-polar-{signature}.tif'
    if not path.exists():
        params=dict(f='image',bbox=','.join(map(str,box)),bboxSR=crs,imageSR=crs,
                    size='2048,2048',format='tiff',pixelType='F32',noData=-999999,
                    renderingRule='{"rasterFunction":"None"}',interpolation='RSP_BilinearInterpolation')
        response=requests.get('https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_global_mosaic/ImageServer/exportImage',params=params,timeout=120)
        response.raise_for_status()
        temp=path.with_suffix('.tmp')
        temp.write_bytes(response.content)
        # Validate before retaining the download in the reusable cache.
        import rasterio
        with rasterio.open(temp) as dem:
            if dem.count!=1 or not dem.crs:
                raise ValueError('NOAA returned an invalid polar terrain raster')
        temp.replace(path)
    return RasterTerrain(path,lat,lon,'NOAA polar mosaic')
