import tempfile
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch
import app as server
class SceneStyleTests(TestCase):
    def test_persistent_optional_trees_and_validation(self):
        with tempfile.TemporaryDirectory() as folder,patch.object(server,'scene_style_path',Path(folder)/'style.json'):
            client=server.app.test_client();default=client.get('/api/scene-style').json
            self.assertFalse(default['trees']);self.assertTrue(default['rays'])
            state=client.put('/api/scene-style',json=dict(trees=True,rays=True,strength=80,sky_only=True,clock12=True))
            self.assertEqual(state.status_code,200)
            self.assertTrue(state.json['sky_only'])
            self.assertTrue(state.json['clock12'])
            self.assertEqual(client.get('/api/scene-style').json,state.json)
            for data in [dict(trees='yes',strength=65),dict(strength=101),dict(strength=-1),dict(strength=65,sky_only='yes'),dict(strength=65,clock12='yes')]:
                self.assertEqual(client.put('/api/scene-style',json=data).status_code,400)
            self.assertEqual(client.get('/api/scene-style').json['revision'],1)
