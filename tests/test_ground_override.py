import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch, Mock
import numpy as np
import app as server
import cache_store
from terrain import Terrain, R


class GroundOverrideTests(unittest.TestCase):
    def test_lower_observer_ignores_bad_nearby_dem(self):
        def sample(lat, lon):
            distance=R*np.hypot(np.radians(lat), np.radians(lon))
            return np.where(distance < 95, 500.0, 0.0)
        provider=Terrain(0,0,10,'global')
        with patch.object(provider,'sample',side_effect=sample):
            clear=provider.horizon(0,0,2,5,ground_override=400)
            blocked=provider.horizon(0,0,2,5,ground_override=400,near_distance=50)
        self.assertEqual(clear['dem_ground_m'],500)
        self.assertEqual(clear['ground_m'],400)
        self.assertEqual(clear['observer_m'],402)
        self.assertEqual(clear['near_m'],100)
        self.assertLess(max(clear['horizon']),0)
        self.assertGreater(min(blocked['horizon']),45)

    def test_job_identity_and_override_reach_tracer(self):
        client=server.app.test_client()
        provider=Mock();provider.horizon.return_value={'ground_m':400,'observer_m':402}
        inputs=dict(lat=10,lon=20,height=2,radius=5,zoom=10,source='global',date='2026-01-01')
        with tempfile.TemporaryDirectory() as folder, patch.object(cache_store,'ROOT',Path(folder)), patch.object(server,'jobs',{}), patch.object(server.pool,'submit',side_effect=lambda fn:fn()), patch.object(server,'Terrain',return_value=provider), patch.object(server,'calculate_day',return_value={'terrain':provider.horizon.return_value}):
            normal=client.post('/api/calculate',json=inputs)
            manual=client.post('/api/calculate',json=dict(inputs,ground=400))
            closer=client.post('/api/calculate',json=dict(inputs,ground=400,near=50))
            self.assertEqual(manual.status_code,202)
            self.assertEqual(len({normal.json['id'],manual.json['id'],closer.json['id']}),3)
            self.assertEqual(provider.horizon.call_args_list[1].kwargs,{'ground_override':400,'near_distance':100})
            self.assertEqual(provider.horizon.call_args_list[2].kwargs,{'ground_override':400,'near_distance':50})
            self.assertEqual(client.post('/api/calculate',json=dict(inputs,ground=400,near=1)).status_code,400)
            self.assertEqual(client.post('/api/calculate',json=dict(inputs,ground=-13000)).status_code,400)

    def test_saved_override_and_below_sea_level(self):
        client=server.app.test_client()
        with tempfile.TemporaryDirectory() as folder, patch.object(server,'locations_path',Path(folder)/'locations.json'):
            response=client.post('/api/locations',json=dict(name='Synthetic place',lat=0,lon=0,height=2,ground=-20,near=75))
            self.assertEqual(response.status_code,200)
            point=client.get('/api/locations').json[0]
            self.assertEqual(point['ground'],-20)
            self.assertEqual(point['near'],75)
