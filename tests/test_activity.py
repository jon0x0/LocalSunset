from pathlib import Path
import tempfile
from unittest.mock import patch
import unittest
import app as server


class ActivityTests(unittest.TestCase):
    def test_shared_user_activity_and_reads_do_not_reset_timer(self):
        a=server.app.test_client();b=server.app.test_client()
        with tempfile.TemporaryDirectory() as folder,patch.object(server,'activity_path',Path(folder)/'activity.json'),patch.object(server,'activity_last_ms',1000000),patch.object(server,'activity_saved_ms',0),patch.object(server.time,'time',return_value=1000) as clock:
            self.assertEqual(a.post('/api/activity',json={}).json['idle_ms'],0)
            self.assertTrue(server.activity_path.exists())
            clock.return_value=8201
            self.assertEqual(b.get('/api/activity').json['idle_ms'],7201000)
            self.assertEqual(a.get('/api/activity').json['last_input_ms'],1000000)
            b.post('/api/activity',json={})
            self.assertEqual(a.get('/api/activity').json['idle_ms'],0)
