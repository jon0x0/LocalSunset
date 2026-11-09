import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch
import app as server


class AppTests(unittest.TestCase):
    def setUp(self):
        self.client=server.app.test_client()

    def test_interface_and_assets(self):
        for path in ('/','/static/app.js','/static/style.css'):
            response=self.client.get(path)
            self.assertEqual(response.status_code,200)
            response.close()

    def test_assets_and_api_are_not_cached(self):
        for path in ('/', '/static/app.js', '/api/health'):
            response = self.client.get(path)
            self.assertIn('no-store', response.headers['Cache-Control'])
            response.close()

    def test_different_locations_queue_with_correct_identity(self):
        with patch.object(server, 'jobs', {}), patch.object(server.pool, 'submit') as submit:
            first = dict(lat=10, lon=20, height=2, radius=30, zoom=10,
                         source='auto', date='2026-11-08')
            second = dict(first, lat=-10, lon=-20, height=3)
            a = self.client.post('/api/calculate', json=first)
            b = self.client.post('/api/calculate', json=second)
            self.assertEqual(a.status_code, 202)
            self.assertEqual(b.status_code, 202)
            self.assertNotEqual(a.json['id'], b.json['id'])
            for response, settings in ((a, first), (b, second)):
                job = self.client.get('/api/jobs/' + response.json['id']).json
                self.assertEqual(job['signature'][:3], [settings['lat'], settings['lon'], settings['height']])
            duplicate = self.client.post('/api/calculate', json=second)
            self.assertEqual(duplicate.json['id'], b.json['id'])
            self.assertEqual(submit.call_count, 2)

    def test_invalid_location_rejected(self):
        response=self.client.post('/api/calculate',json={'lat':91,'lon':0,'height':1.7,'date':'2026-11-07','radius':60,'zoom':11})
        self.assertEqual(response.status_code,400)
        self.assertIn('lat',response.json['error'])

    def test_saved_locations_persist_and_delete(self):
        with tempfile.TemporaryDirectory() as folder,patch.object(server,'locations_path',Path(folder)/'locations.json'):
            response=self.client.post('/api/locations',json={'name':'Test place','lat':40,'lon':-105,'height':1.7})
            self.assertEqual(response.status_code,200)
            self.assertEqual(self.client.get('/api/locations').json[0]['name'],'Test place')
            self.assertEqual(self.client.delete('/api/locations/Test%20place').status_code,200)
            self.assertEqual(self.client.get('/api/locations').json,[])

    def test_photon_response_mapping(self):
        with patch.object(server.requests,'get') as get:
            get.return_value.json.return_value={'features':[{'geometry':{'coordinates':[-105,40]},'properties':{'name':'Boulder','country':'USA'}}]}
            response=self.client.get('/api/search?q=Boulder')
            self.assertEqual(response.status_code,200)
            self.assertEqual(response.json[0]['name'],'Boulder, USA')
            self.assertEqual(response.json[0]['lat'],40)
            self.assertEqual(response.json[0]['lon'],-105)
            self.assertIn('LocalSunset',get.call_args.kwargs['headers']['User-Agent'])


if __name__=='__main__':
    unittest.main()
