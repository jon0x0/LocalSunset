"""Address search with US ZIP inference and street-level match validation."""
from functools import lru_cache
import os
import re
import requests

HEADERS = {'User-Agent': 'LocalSunset/0.1 (personal terrain sunset planner)'}
ZIP_PATTERN = r'\d{5}(?:-\d{4})?'


def valid_zip(value):
    return bool(re.fullmatch(ZIP_PATTERN, value))


def inline_zip(query):
    # Only consider a trailing postal token, never a five-digit house number.
    match = re.search(r'(?:^|[\s,])('+ZIP_PATTERN+r')(?:\s*,?\s*(?:USA|US|United States))?\s*$', query, re.I)
    return match.group(1) if match else ''


@lru_cache(maxsize=1024)
def zip_places(zip5):
    response = requests.get(f'https://api.zippopotam.us/us/{zip5}', headers=HEADERS, timeout=15)
    if response.status_code == 404:
        return None
    response.raise_for_status()
    data = response.json()
    return dict(zip=zip5, places=[dict(city=p['place name'], state=p['state abbreviation'],
                                     lat=float(p['latitude']), lon=float(p['longitude']))
                                 for p in data['places']])


def census_search(query, zip_code):
    address = query if inline_zip(query) else f'{query}, {zip_code}'
    response = requests.get('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress',
                            params={'address':address, 'benchmark':'Public_AR_Current', 'format':'json'},
                            headers=HEADERS, timeout=20)
    response.raise_for_status()
    results = []
    for match in response.json()['result']['addressMatches']:
        parts = match.get('addressComponents', {})
        postcode = str(parts.get('zip', ''))
        if postcode[:5] != zip_code[:5]:
            continue
        results.append(dict(name=match['matchedAddress'], lat=match['coordinates']['y'],
                            lon=match['coordinates']['x'], city=parts.get('city',''),
                            state=parts.get('state',''), postcode=postcode,
                            source='US Census · interpolated street address'))
    return results


def photon_search(query, zip_code='', places=None):
    params = {'q':query, 'limit':6}
    if zip_code and places:
        p = places['places'][0]
        params['q'] = f'{query}, {p["city"]}, {p["state"]}, {zip_code[:5]}, USA'
        params.update(lat=p['lat'], lon=p['lon'])
    response = requests.get(os.environ.get('GEOCODER_URL','https://photon.komoot.io/api/'),
                            params=params, headers=HEADERS, timeout=20)
    response.raise_for_status()
    results = []
    house = re.match(r'^\s*(\d+[A-Za-z]?(?:-\d+)?)\b',query)
    for feature in response.json()['features']:
        p = feature['properties']
        postcode = str(p.get('postcode',''))
        if zip_code:
            if p.get('countrycode','').upper() != 'US' or postcode[:5] != zip_code[:5]:
                continue
            # Never substitute a city or ZIP centroid for a street address.
            if house and str(p.get('housenumber','')).upper() != house.group(1).upper():
                continue
        street = ' '.join(str(p[k]) for k in ('housenumber','street') if p.get(k))
        fields = [p.get('name'),street,p.get('city'),p.get('state'),postcode,p.get('country')]
        name = ', '.join(dict.fromkeys(str(v) for v in fields if v))
        results.append(dict(name=name, lat=feature['geometry']['coordinates'][1],
                            lon=feature['geometry']['coordinates'][0], city=p.get('city',''),
                            state=p.get('state',''), postcode=postcode,
                            housenumber=str(p.get('housenumber','')),
                            source='Photon / OpenStreetMap'))
    return results


def search_address(query, zip_code=''):
    explicit_zip = bool(zip_code)
    zip_code = zip_code or inline_zip(query)
    if zip_code and not explicit_zip and not re.match(r'^\s*\d',query):
        # "Paris 75001" is a global place query, not a US street address.
        return photon_search(query)
    errors = []
    if zip_code:
        # ZIP-only queries intentionally return clearly labeled area centers.
        zip_only = bool(re.fullmatch(ZIP_PATTERN,query.strip()))
        if not zip_only:
            try:
                matches = census_search(query,zip_code)
                if matches:
                    return matches
            except (requests.RequestException, ValueError, KeyError) as exc:
                errors.append(exc)
        try:
            places = zip_places(zip_code[:5])
        except (requests.RequestException, ValueError, KeyError) as exc:
            places = None
            errors.append(exc)
        if zip_only and places:
            return [dict(name=f'ZIP {zip_code[:5]} · {p["city"]}, {p["state"]} (area center)',
                         postcode=zip_code[:5], source='Zippopotam.us · ZIP area center', **p)
                    for p in places['places']]
        try:
            matches = photon_search(query,zip_code,places)
            if matches:
                return matches
        except (requests.RequestException, ValueError, KeyError) as exc:
            errors.append(exc)
        # Five-digit postal codes also exist internationally. A dedicated US
        # ZIP field is authoritative; an inferred token may be international.
        if not explicit_zip:
            # An international five-digit postcode must remain searchable even
            # when it happens to be a valid US ZIP. Keep street matches precise.
            house = re.match(r'^\s*(\d+[A-Za-z]?(?:-\d+)?)\b',query)
            return [r for r in photon_search(query) if r['postcode'][:5] == zip_code[:5]
                    and (not house or r['housenumber'].upper() == house.group(1).upper())]
        if errors:
            raise requests.RequestException('Address providers could not complete this lookup. Please retry.')
        return []
    return photon_search(query)
