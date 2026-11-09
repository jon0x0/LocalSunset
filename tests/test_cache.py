from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch,Mock
import cache_store
import app as server

class CacheTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)/'cache'
        self.patches=[patch.object(cache_store,'ROOT',self.root),patch.object(server,'jobs',{})]
        for p in self.patches:p.start()
        self.client=server.app.test_client()
    def tearDown(self):
        for p in reversed(self.patches):p.stop()
        self.temp.cleanup()
    def test_private_disk_roundtrip_and_corruption(self):
        identity=['synthetic',1]
        cache_store.write('results',identity,{'result':'ok'})
        self.assertEqual(cache_store.read('results',identity),{'result':'ok'})
        self.assertEqual(cache_store.stats()['files'],1)
        self.assertIsNone(cache_store.read('results',['different']))
        next((self.root/'results').iterdir()).write_bytes(b'broken')
        self.assertIsNone(cache_store.read('results',identity))
    def test_completed_results_survive_job_memory_and_horizons_reuse_across_dates(self):
        terrain={'ground_m':1,'observer_m':3,'horizon':[0]*4}
        provider=Mock();provider.horizon.return_value=terrain
        inputs=dict(lat=10,lon=20,height=2,radius=10,zoom=10,source='global',date='2026-01-01')
        with patch.object(server.pool,'submit',side_effect=lambda fn:fn()),patch.object(server,'Terrain',return_value=provider) as factory,patch.object(server,'calculate_day',return_value={'timezone':'UTC','terrain':terrain}) as calculate:
            first=self.client.post('/api/calculate',json=inputs)
            self.assertEqual(self.client.get('/api/jobs/'+first.json['id']).json['status'],'done')
            server.jobs.clear()
            second=self.client.post('/api/calculate',json=inputs)
            self.assertEqual(self.client.get('/api/jobs/'+second.json['id']).json['message'],'Loaded cached calculation')
            self.assertEqual(calculate.call_count,1)
            self.client.post('/api/calculate',json=dict(inputs,date='2026-01-02'))
            self.assertEqual(calculate.call_count,2)
            self.assertEqual(factory.call_count,1)
            self.assertEqual(provider.horizon.call_count,1)
    def test_clear_cache_does_not_delete_settings_and_refuses_active_work(self):
        settings=Path(self.temp.name)/'locations.json';settings.write_text('private saved places')
        cache_store.write('results',['sample'],{'x':1})
        server.jobs['active']={'status':'running'}
        self.assertEqual(self.client.delete('/api/cache').status_code,409)
        self.assertEqual(cache_store.stats()['files'],1)
        server.jobs.clear()
        self.assertEqual(self.client.delete('/api/cache').status_code,200)
        self.assertEqual(cache_store.stats()['files'],0)
        self.assertEqual(settings.read_text(),'private saved places')
    def test_cache_clear_rejects_escape(self):
        with patch.object(cache_store,'KINDS',('..',)):
            with self.assertRaises(ValueError):cache_store.clear()
    def test_local_dem_fingerprint_changes_when_file_changes(self):
        dem=Path(self.temp.name)/'dem.tif';dem.write_bytes(b'1')
        with patch.dict('os.environ',{'LOCAL_DEM':str(dem)}):
            before=cache_store.dem_identity();dem.write_bytes(b'longer')
            self.assertNotEqual(before,cache_store.dem_identity())
