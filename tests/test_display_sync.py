import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch,Mock
import app as server


class DisplaySyncTests(unittest.TestCase):
    def setUp(self):
        self.folder=tempfile.TemporaryDirectory()
        self.file=Path(self.folder.name)/'display.json'
        self.paths=patch.object(server,'display_config_path',self.file);self.paths.start()
        self.settings=patch.dict(server.app.config,{'DISPLAY_SERVER_URL':'','NETWORK_AUTH_REQUIRED':False});self.settings.start()
        self.state=patch.object(server,'display_view',dict(revision=0,view=None));self.state.start()
        self.client=server.app.test_client()
        data=dict(name='Test',lat=40,lon=-105,height=1.7,radius=30,zoom=10,source='auto',event='sunset',
                  today=False,live=False,projector=True,date='2026-11-08')
        self.client.put('/api/display-config',json=data,headers={'X-Display-Intent':'select'})

    def tearDown(self):
        self.state.stop();self.settings.stop();self.paths.stop();self.folder.cleanup()

    def test_time_direction_playback_round_trip_without_disk_writes(self):
        before=self.file.read_bytes()
        data=dict(config_revision=1,time_ms=1794168000000,azimuth=359.5,event='sunrise',playing=True,live=False)
        response=self.client.put('/api/display-view',json=data)
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json['revision'],1)
        current=self.client.get('/api/display-view').json['view']
        for key,value in data.items():self.assertEqual(current[key],value)
        self.assertGreater(current['updated_ms'],0)
        self.assertEqual(before,self.file.read_bytes())

    def test_stale_location_view_rejected(self):
        data=dict(config_revision=2,time_ms=1000,azimuth=50,event='sunset',playing=False,live=False)
        self.assertEqual(self.client.put('/api/display-view',json=data).status_code,409)
        self.assertIsNone(self.client.get('/api/display-view').json['view'])

    def test_old_controller_cannot_restore_previous_saved_point(self):
        first=self.client.get('/api/display-config').json['config']
        second={**first,'name':'Second saved point','lat':39}
        changed=self.client.put('/api/display-config',json=second,headers={'X-Display-Intent':'select'})
        self.assertEqual(changed.json['revision'],2)
        stale=self.client.put('/api/display-config',json=first,headers={'If-Match':'1'})
        self.assertEqual(stale.status_code,409)
        # Cached controllers without the explicit selection protocol cannot steal it either.
        self.assertEqual(self.client.put('/api/display-config',json=first).status_code,409)
        current=self.client.get('/api/display-config').json
        self.assertEqual(current['config']['name'],'Second saved point')
        self.assertEqual(current['revision'],2)

    def test_only_local_hdmi_receiver_confirms_a_view(self):
        with patch.object(server,'display_ack',dict(revision=0,updated_ms=0)):
            data=dict(config_revision=1,time_ms=1000,azimuth=50,event='sunset',playing=False,live=False)
            self.client.put('/api/display-view',json=data)
            self.client.post('/api/display-ack',json={'revision':1},environ_overrides={'REMOTE_ADDR':'192.168.1.20'})
            self.assertEqual(self.client.get('/api/display-ack').json['revision'],0)
            self.client.post('/api/display-ack',json={'revision':1})
            self.assertEqual(self.client.get('/api/display-ack').json['revision'],1)

    def test_invalid_direction_and_event_rejected(self):
        data=dict(config_revision=1,time_ms=1000,azimuth=999,event='sunset',playing=False,live=False)
        self.assertEqual(self.client.put('/api/display-view',json=data).status_code,400)
        data.update(azimuth=50,event='moonrise')
        self.assertEqual(self.client.put('/api/display-view',json=data).status_code,400)

    def test_desktop_controls_relay_to_pi(self):
        upstream=Mock(content=b'{"revision":3,"view":null}',status_code=200)
        connection=Mock()
        connection.request.return_value=upstream
        with patch.dict(server.app.config,{'DISPLAY_SERVER_URL':'http://projector.local:5000'}),patch.object(server,'relay_state',Mock(session=connection)):
            result=self.client.get('/api/display-view')
            self.assertEqual(result.json['revision'],3)
            self.assertEqual(connection.request.call_args.args,('GET','http://projector.local:5000/api/display-view'))
            self.assertEqual(self.client.get('/api/display-target').json['url'],'http://projector.local:5000')


if __name__=='__main__':unittest.main()
