"""Topocentric solar disk visibility over a sampled terrain horizon."""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import math
import astronomy
import numpy as np


def sun_at(instant, observer):
    t = astronomy.Time(instant.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%fZ'))
    equ = astronomy.Equator(astronomy.Body.Sun, t, observer, True, True)
    hor = astronomy.Horizon(t, observer, equ.ra, equ.dec, astronomy.Refraction.Normal)
    radius = math.degrees(math.asin(695700/(equ.dist*149597870.7)))
    return hor.azimuth, hor.altitude, radius


def disk_clearance(az, alt, radius, profile):
    # A ridge can obscure the upper center while the edge of the disk remains visible.
    offsets = np.linspace(-radius, radius, 65)
    sample_az = (az+offsets/max(.01, math.cos(math.radians(alt)))) % 360
    horizon = np.interp(sample_az, np.arange(len(profile)+1)*360/len(profile),
                        np.r_[profile, profile[0]])
    return float(np.max(alt + np.sqrt(np.maximum(0,radius**2-offsets**2)) - horizon))


def calculate_day(lat, lon, date, zone, terrain, progress=lambda s: None):
    tz = ZoneInfo(zone)
    start = datetime.combine(date, datetime.min.time(), tzinfo=tz).astimezone(timezone.utc)
    end = datetime.combine(date+timedelta(days=1), datetime.min.time(), tzinfo=tz).astimezone(timezone.utc)
    observer = astronomy.Observer(lat, lon, terrain['observer_m'])
    profile = np.asarray(terrain['horizon'])
    def evaluate(t):
        az, alt, radius = sun_at(t, observer)
        return disk_clearance(az, alt, radius, profile), az, alt, radius
    events, timeline = [], []
    t, previous = start, evaluate(start)[0]
    step = timedelta(seconds=15)
    count = 0
    while t <= end:
        clearance, az, alt, radius = evaluate(t)
        if t > start and (previous > 0) != (clearance > 0):
            lo, hi = t-step, t
            initial_visible = previous > 0
            while (hi-lo).total_seconds() > .125:
                mid = lo+(hi-lo)/2
                if (evaluate(mid)[0] > 0) == initial_visible:
                    lo = mid
                else:
                    hi = mid
            event = lo+(hi-lo)/2
            events.append(dict(kind='disappearance' if initial_visible else 'appearance',
                               utc=event.isoformat(), local=event.astimezone(tz).isoformat(),
                               azimuth=evaluate(event)[1]))
        if count % 2 == 0:
            timeline.append(dict(t=t.timestamp()*1000, az=az, alt=alt, radius=radius, visible=clearance > 0))
        previous = clearance
        t += step
        count += 1
    losses = [e for e in events if e['kind'] == 'disappearance']
    appearances = [e for e in events if e['kind'] == 'appearance']
    return dict(timezone=zone, events=events, sunrise=appearances[0] if appearances else None,
                sunset=losses[-1] if losses else None,
                status='events' if events else ('sun_visible_all_day' if previous > 0 else 'sun_hidden_all_day'),
                timeline=timeline, terrain=terrain,
                assumptions=['Standard atmospheric refraction; no live weather.',
                             'Bare-earth terrain only: buildings, vegetation and clouds excluded.',
                             '15-second event search, 0.125-second root refinement; tiny visibility windows may be missed.',
                             '65 solar disk slices; terrain horizon sampled every 0.25 degrees.',
                             f'Terrain beyond {terrain["radius_km"]} km is assumed at sea level.',
                             'Displayed seconds are numerical precision, not guaranteed observational accuracy.'])
