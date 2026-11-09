import os
import unittest
from unittest.mock import patch
from app import app
from serve import parser


class DisplayModeTests(unittest.TestCase):
    def test_pi_profile_has_bounded_defaults(self):
        with patch.dict(os.environ,{'LOCAL_SUNSET_PI':'1'}):
            response=app.test_client().get('/')
            html=response.get_data(as_text=True)
            self.assertIn('data-low-power="true"',html)
            self.assertIn('value="10" selected>Fast',html)
            self.assertIn('id="radius" type="number" min="5" max="200" value="30"',html)

    def test_normal_profile_and_projector_controls(self):
        with patch.dict(os.environ,{'LOCAL_SUNSET_PI':'0'}):
            response=app.test_client().get('/')
            html=response.get_data(as_text=True)
            self.assertNotIn('data-low-power="true"',html)
            for element in ('projectorToggle','projectorExit','projectorFullscreen','projectionSunrise','projectionSunset'):
                self.assertIn(f'id="{element}"',html)
            response.close()

    def test_local_date_includes_location_zone(self):
        response=app.test_client().get('/api/today?lat=40&lon=-105')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json['timezone'],'America/Denver')
        self.assertRegex(response.json['date'],r'^\d{4}-\d{2}-\d{2}$')
        self.assertEqual(app.test_client().get('/api/today?lat=nan&lon=0').status_code,400)

    def test_headless_pi_projector_flags(self):
        args=parser().parse_args(['--pi','--projector','--auto','--no-browser'])
        self.assertTrue(args.pi and args.projector and args.auto and args.no_browser)
        self.assertEqual(args.host,'127.0.0.1')

    def test_health(self):
        self.assertEqual(app.test_client().get('/api/health').json,{'status':'ok'})


if __name__=='__main__':
    unittest.main()
