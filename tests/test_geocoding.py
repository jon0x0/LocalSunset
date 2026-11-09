import unittest
from unittest.mock import patch, Mock
import requests
import geocoding as geo
from app import app


def response(data, status=200):
    return Mock(status_code=status, json=lambda: data, raise_for_status=lambda: None)


class GeocodingTests(unittest.TestCase):
    def setUp(self):
        geo.zip_places.cache_clear()

    def test_zip_recognition_preserves_leading_zero_and_extension(self):
        self.assertEqual(geo.inline_zip('123 Main St, 02108-1234'),'02108-1234')
        self.assertEqual(geo.inline_zip('123 Main St 80302 USA'),'80302')
        self.assertEqual(geo.inline_zip('12345 Main Street'),'')
        self.assertTrue(geo.valid_zip('02108'))
        self.assertFalse(geo.valid_zip('2108'))

    def test_street_plus_zip_no_city(self):
        match=dict(matchedAddress='1777 BROADWAY, BOULDER, CO, 80302',coordinates={'x':-105.2793,'y':40.0156},
                   addressComponents={'city':'BOULDER','state':'CO','zip':'80302'})
        with patch.object(geo.requests,'get',return_value=response({'result':{'addressMatches':[match]}})) as get:
            results=geo.search_address('1777 Broadway','80302-1234')
        self.assertEqual(results[0]['city'],'BOULDER')
        self.assertEqual(results[0]['postcode'],'80302')
        self.assertEqual(get.call_args.kwargs['params']['address'],'1777 Broadway, 80302-1234')
        self.assertEqual(get.call_count,1)

    def test_wrong_zip_match_rejected(self):
        match=dict(matchedAddress='Wrong address',coordinates={'x':0,'y':0},addressComponents={'zip':'10001'})
        with patch.object(geo.requests,'get',return_value=response({'result':{'addressMatches':[match]}})):
            self.assertEqual(geo.census_search('1777 Broadway','80302'),[])

    def test_zip_city_lookup_and_cache(self):
        data={'places':[{'place name':'Boston','state abbreviation':'MA','latitude':'42.35','longitude':'-71.06'}]}
        with patch.object(geo.requests,'get',return_value=response(data)) as get:
            client=app.test_client()
            result=client.get('/api/zip/02108-1234')
            self.assertEqual(result.json['places'][0]['city'],'Boston')
            self.assertEqual(client.get('/api/zip/02108').status_code,200)
            self.assertEqual(get.call_count,1)
            self.assertTrue(get.call_args.args[0].endswith('/02108'))

    def test_zip_only_labeled_as_area_center(self):
        places={'places':[{'city':'Boulder','state':'CO','lat':40,'lon':-105}]}
        with patch.object(geo,'zip_places',return_value=places),patch.object(geo,'census_search') as census:
            results=geo.search_address('80302')
        self.assertIn('area center',results[0]['name'])
        census.assert_not_called()

    def test_census_failure_uses_validated_street_fallback(self):
        with patch.object(geo,'census_search',side_effect=requests.Timeout),patch.object(geo,'zip_places',return_value=None),patch.object(geo,'photon_search',return_value=[{'name':'Matched street'}]):
            self.assertEqual(geo.search_address('123 Main Street','80302')[0]['name'],'Matched street')

    def test_photon_does_not_substitute_zip_centroid(self):
        features=[{'properties':{'name':'Boulder','countrycode':'US','postcode':'80302'},'geometry':{'coordinates':[-105,40]}},
                  {'properties':{'housenumber':'1777','street':'Broadway','countrycode':'US','postcode':'80302'},'geometry':{'coordinates':[-105.2793,40.0156]}}]
        with patch.object(geo.requests,'get',return_value=response({'features':features})):
            matches=geo.photon_search('1777 Broadway','80302')
        self.assertEqual(len(matches),1)
        self.assertIn('1777 Broadway',matches[0]['name'])

    def test_bad_or_conflicting_zip_rejected(self):
        client=app.test_client()
        self.assertEqual(client.get('/api/zip/1234').status_code,400)
        self.assertEqual(client.get('/api/search?q=1777+Broadway&zip=abc').status_code,400)
        self.assertEqual(client.get('/api/search?q=1777+Broadway+80302&zip=10001').status_code,400)


if __name__=='__main__':
    unittest.main()
