import json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import app as server

class ManagedPlaces(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.path=Path(self.temp.name)/'locations.json'
        self.original=[dict(name='One',lat=40,lon=-105,height=2,ground=2100,near=75,note='preserved'),dict(name='Two',lat=41,lon=-104,height=3)]
        self.path.write_text(json.dumps(self.original),encoding='utf-8')
        self.patch=patch.object(server,'locations_path',self.path);self.patch.start();self.client=server.app.test_client()
    def tearDown(self):self.patch.stop();self.temp.cleanup()
    def test_order_rename_add_and_delete_preserve_metadata(self):
        edited=[self.original[1],dict(self.original[0],name='Renamed'),dict(name='Manual',lat=42,lon=-103,height=1.7)]
        response=self.client.put('/api/locations',json=dict(expected=self.original,locations=edited))
        self.assertEqual(response.status_code,200);self.assertEqual(response.json,edited)
        response=self.client.put('/api/locations',json=dict(expected=edited,locations=[edited[1]]))
        self.assertEqual(response.status_code,200);self.assertEqual(response.json,[edited[1]])
    def test_stale_or_invalid_write_never_changes_file(self):
        before=self.path.read_bytes()
        self.assertEqual(self.client.put('/api/locations',json=dict(expected=[],locations=[])).status_code,409)
        for edited in [[dict(self.original[0],lat=100)],[self.original[0],self.original[0]]]:
            self.assertEqual(self.client.put('/api/locations',json=dict(expected=self.original,locations=edited)).status_code,400)
        self.assertEqual(self.path.read_bytes(),before)

if __name__=='__main__':unittest.main()
