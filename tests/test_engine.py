import unittest
from datetime import date, datetime, timezone
from unittest.mock import patch
import tempfile
from pathlib import Path
import numpy as np
import astronomy
from terrain import Terrain, RasterTerrain, destination, pixels
from solar import calculate_day, disk_clearance


def flat_profile(angle=0):
    return dict(observer_m=0, ground_m=0, horizon=[angle]*1440, radius_km=60)


class EngineTests(unittest.TestCase):
    def test_destination_wraps_antimeridian(self):
        lat, lon = destination(0,179.9,90,50000)
        self.assertAlmostEqual(float(lat),0,places=8)
        self.assertLess(lon,-179)

    def test_exact_pole_has_all_longitudes(self):
        lat,lon=destination(90,0,np.arange(0,360,45),50000)
        self.assertLess(float(np.ptp(lat)),1e-8)
        self.assertEqual(len(np.unique(np.round(lon))),8)

    def test_local_geotiff_and_missing_coverage(self):
        import rasterio
        from rasterio.transform import from_origin
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'test.tif'
            with rasterio.open(path,'w',driver='GTiff',width=32,height=32,count=1,dtype='float32',
                               crs='EPSG:4326',transform=from_origin(-106,41,.1,.1),nodata=-9999) as dem:
                dem.write(np.full((32,32),1234,dtype=np.float32),1)
            terrain=RasterTerrain(path,40,-105)
            self.assertAlmostEqual(float(terrain.sample(40,-105)),1234)
            with self.assertRaisesRegex(ValueError,'cover'):
                terrain.sample(0,0)

    def test_elevation_interpolation_across_tile_seam(self):
        terrain = Terrain(0,0,9,'global')
        def tile(x,y):
            return np.tile((np.arange(256)+int(x)*256)[None,:], (256,1))
        with patch.object(terrain,'tile',side_effect=tile):
            value = terrain.sample(0,0)
        self.assertAlmostEqual(float(value),float(pixels(0,0,9)[0])-.5)

    def test_disk_side_can_remain_visible(self):
        profile=np.zeros(1440)
        profile[1080]=2
        self.assertGreater(disk_clearance(270,.1,.27,profile),0)
        self.assertLess(disk_clearance(270,-.4,.27,np.zeros(1440)),0)

    def test_flat_horizon_agrees_with_reference_set(self):
        result=calculate_day(0,0,date(2026,3,20),'UTC',flat_profile())
        reference=astronomy.SearchRiseSet(astronomy.Body.Sun,astronomy.Observer(0,0,0),
                                         astronomy.Direction.Set,astronomy.Time('2026-03-20T00:00:00Z'),1)
        predicted=datetime.fromisoformat(result['sunset']['utc'])
        ref=datetime.fromisoformat(str(reference).replace('Z','+00:00'))
        self.assertLess(abs((predicted-ref).total_seconds()),120)
        self.assertEqual([e['kind'] for e in result['events']],['appearance','disappearance'])
        rise_reference=astronomy.SearchRiseSet(astronomy.Body.Sun,astronomy.Observer(0,0,0),
                                              astronomy.Direction.Rise,astronomy.Time('2026-03-20T00:00:00Z'),1)
        rise=datetime.fromisoformat(result['sunrise']['utc'])
        rise_ref=datetime.fromisoformat(str(rise_reference).replace('Z','+00:00'))
        self.assertLess(abs((rise-rise_ref).total_seconds()),120)

    def test_ridge_advances_sunset(self):
        level=calculate_day(40,-105,date(2026,11,7),'America/Denver',flat_profile())
        ridge=calculate_day(40,-105,date(2026,11,7),'America/Denver',flat_profile(10))
        self.assertLess(ridge['sunset']['utc'],level['sunset']['utc'])
        self.assertGreater(ridge['sunrise']['utc'],level['sunrise']['utc'])
        self.assertEqual(ridge['sunrise'],next(e for e in ridge['events'] if e['kind']=='appearance'))
        self.assertIn('-07:00',ridge['sunset']['local'])

    def test_polar_day_and_night(self):
        for day,expected in [(date(2026,6,21),'sun_visible_all_day'),(date(2026,12,21),'sun_hidden_all_day')]:
            result=calculate_day(89,0,day,'UTC',flat_profile())
            self.assertIsNone(result['sunset'])
            self.assertIsNone(result['sunrise'])
            self.assertEqual(result['status'],expected)

    def test_dst_day_length(self):
        for day,hours in [(date(2026,3,8),23),(date(2026,11,1),25)]:
            r=calculate_day(40,-105,day,'America/Denver',flat_profile())
            self.assertEqual((r['timeline'][-1]['t']-r['timeline'][0]['t'])/3600000,hours)


if __name__=='__main__':
    unittest.main()
