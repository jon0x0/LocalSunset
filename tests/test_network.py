import base64
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch
from werkzeug.security import generate_password_hash
import app as server
from network_access import configure


class NetworkTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.password_hash=generate_password_hash('test-only-network-password')

    def setUp(self):
        self.folder=tempfile.TemporaryDirectory()
        self.config_path=Path(self.folder.name)/'display.json'
        self.paths=patch.object(server,'display_config_path',self.config_path)
        self.paths.start()
        self.settings=patch.dict(server.app.config,dict(NETWORK_AUTH_REQUIRED=True,NETWORK_USERNAME='admin',
            NETWORK_PASSWORD_HASH=self.password_hash,SECRET_KEY='test-only-session-key',SESSION_COOKIE_SAMESITE='Strict'))
        self.settings.start()
        self.client=server.app.test_client()

    def tearDown(self):
        self.settings.stop();self.paths.stop();self.folder.cleanup()

    def remote(self,path,**kwargs):
        return self.client.get(path,base_url='http://pi.local:5000',environ_overrides={'REMOTE_ADDR':'192.168.1.20'},**kwargs)

    def test_remote_requires_password(self):
        response=self.remote('/api/display-config')
        self.assertEqual(response.status_code,401)
        self.assertIn('Basic',response.headers['WWW-Authenticate'])
        self.assertEqual(self.remote('/').status_code,401)
        self.assertEqual(self.remote('/api/health').status_code,200)

    def test_explicit_password_free_lan_mode(self):
        with patch.dict(server.app.config,{'NETWORK_AUTH_REQUIRED':False}):
            self.assertEqual(self.remote('/api/display-config').status_code,200)
            response=self.client.put('/api/display-config',json={},headers={'Origin':'http://attacker.invalid'})
            self.assertEqual(response.status_code,403)

    def test_password_login_and_authenticated_session(self):
        credential=base64.b64encode(b'admin:test-only-network-password').decode()
        self.assertEqual(self.remote('/api/display-config',headers={'Authorization':'Basic '+credential}).status_code,200)
        # Subsequent requests use the signed HttpOnly session, not another costly hash check.
        with patch('network_access.check_password_hash',side_effect=AssertionError('should use session')):
            self.assertEqual(self.remote('/api/display-config').status_code,200)

    def test_local_kiosk_bypass_and_rebinding_host(self):
        self.assertEqual(self.client.get('/api/display-config',base_url='http://127.0.0.1:5000').status_code,200)
        self.assertEqual(self.client.get('/api/display-config',base_url='http://attacker.invalid:5000').status_code,401)

    def test_cross_origin_change_rejected_even_locally(self):
        response=self.client.put('/api/display-config',json={},headers={'Origin':'http://attacker.invalid'})
        self.assertEqual(response.status_code,403)

    def test_display_configuration_persistence_and_validation(self):
        data=dict(name='Public test site',lat=40,lon=-105,height=1.7,radius=30,zoom=10,source='auto',
                  event='sunrise',today=True,live=True,projector=True,date='2026-11-08')
        first=self.client.put('/api/display-config',json=data,headers={'X-Display-Intent':'select'})
        self.assertEqual(first.status_code,200)
        self.assertEqual(first.json['revision'],1)
        self.assertTrue(self.config_path.exists())
        self.assertEqual(self.client.get('/api/display-config').json['config']['event'],'sunrise')
        self.assertEqual(self.client.put('/api/display-config',json=data,headers={'X-Display-Intent':'select'}).json['revision'],2)
        data['lat']=100
        self.assertEqual(self.client.put('/api/display-config',json=data,headers={'X-Display-Intent':'select'}).status_code,400)
        self.assertEqual(self.client.get('/api/display-config').json['revision'],2)

    def test_multiple_displays_share_matching_calculation(self):
        data=dict(lat=40,lon=-105,height=1.7,radius=30,zoom=10,source='auto',date='2026-11-08')
        signature=(40.,-105.,1.7,30.,10,'auto','2026-11-08')
        with patch.dict(server.jobs,{'existing':dict(status='running',signature=signature)},clear=True):
            with patch.object(server.pool,'submit') as submit:
                response=self.client.post('/api/calculate',json=data)
                self.assertEqual(response.status_code,202)
                self.assertEqual(response.json['id'],'existing')
                submit.assert_not_called()

    def test_network_binding_refuses_missing_password_setup(self):
        with self.assertRaisesRegex(ValueError,'Set a network password'):
            configure(server.app,True,Path(self.folder.name)/'nonexistent.json')


if __name__=='__main__':
    unittest.main()
