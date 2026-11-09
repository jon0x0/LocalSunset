import tempfile
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch
import app as server

class CalibrationTests(TestCase):
    def setUp(self):
        self.folder=tempfile.TemporaryDirectory()
        self.path=Path(self.folder.name)/'alignment.json'
        self.mock=patch.object(server,'calibration_path',self.path);self.mock.start()
        self.client=server.app.test_client()
    def tearDown(self):
        self.mock.stop();self.folder.cleanup()
    def test_default_and_persistent_roundtrip(self):
        data=self.client.get('/api/projector-calibration').json
        self.assertEqual(data['revision'],0)
        data['corners']['tl']={'x':12.3,'y':8.5};data['grid']=True
        result=self.client.put('/api/projector-calibration',json=data)
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json['revision'],1)
        self.assertEqual(self.client.get('/api/projector-calibration').json,result.json)
        self.assertTrue(self.path.exists())
        self.assertEqual(result.json['corners']['br'],{'x':0,'y':0})
    def test_invalid_geometry_never_replaces_good_settings(self):
        data=self.client.get('/api/projector-calibration').json
        self.client.put('/api/projector-calibration',json=data)
        for value in (-1,26,'bad',float('nan')):
            data['corners']['tl']['x']=value
            self.assertEqual(self.client.put('/api/projector-calibration',json=data).status_code,400)
        data['corners']['tl']['x']=0;data['enabled']='false'
        self.assertEqual(self.client.put('/api/projector-calibration',json=data).status_code,400)
        self.assertEqual(self.client.get('/api/projector-calibration').json['revision'],1)

    def test_live_preview_does_not_write_disk_and_final_commit_persists_fov(self):
        data=self.client.get('/api/projector-calibration').json
        data.update(preview=True,fov=95)
        data['corners']['tl']['x']=7.2
        preview=self.client.put('/api/projector-calibration',json=data)
        self.assertEqual(preview.status_code,200)
        self.assertFalse(self.path.exists())
        self.assertEqual(self.client.get('/api/projector-calibration').json['fov'],95)
        data['preview']=False
        final=self.client.put('/api/projector-calibration',json=data)
        self.assertEqual(final.status_code,200)
        self.assertTrue(self.path.exists())
        import json
        stored=json.loads(self.path.read_text())
        self.assertEqual(stored['fov'],95)
        self.assertEqual(stored['corners']['tl']['x'],7.2)
        for fov in (29,121,float('nan')):
            data['fov']=fov
            self.assertEqual(self.client.put('/api/projector-calibration',json=data).status_code,400)

    def test_saved_default_survives_reset_and_server_restart(self):
        data=self.client.get('/api/projector-calibration').json
        data.update(action='save_default',fov=88)
        data['corners']['tl']['x']=8
        saved=self.client.put('/api/projector-calibration',json=data)
        self.assertEqual(saved.status_code,200)
        self.assertEqual(saved.json['default']['corners']['tl']['x'],8)
        data.update(action='update',fov=75)
        data['corners']['tl']['x']=0
        self.client.put('/api/projector-calibration',json=data)
        server.calibration_live.pop(str(self.path),None)
        current=self.client.get('/api/projector-calibration').json
        self.assertEqual(current['corners']['tl']['x'],0)
        self.assertEqual(current['default']['corners']['tl']['x'],8)
        current.update(action='restore_default')
        restored=self.client.put('/api/projector-calibration',json=current)
        self.assertEqual(restored.status_code,200)
        self.assertEqual(restored.json['corners']['tl']['x'],8)
        self.assertEqual(restored.json['fov'],88)
        self.assertFalse(restored.json['grid'])
    def test_restore_without_default_is_explicit_error(self):
        data=self.client.get('/api/projector-calibration').json
        data['action']='restore_default'
        self.assertEqual(self.client.put('/api/projector-calibration',json=data).status_code,400)

    def test_stream_delivers_initial_and_live_preview_without_polling(self):
        import json
        response=self.client.get('/api/projector-calibration/events',buffered=False)
        try:
            initial=next(response.response).decode()
            self.assertTrue(initial.startswith('data: '))
            data=self.client.get('/api/projector-calibration').json
            data.update(preview=True)
            data['corners']['tr']['x']=4.2
            self.client.put('/api/projector-calibration',json=data)
            update=json.loads(next(response.response).decode()[6:])
            self.assertEqual(update['corners']['tr']['x'],4.2)
            self.assertFalse(self.path.exists())
        finally:
            response.close()
