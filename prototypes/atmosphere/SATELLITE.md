# Experimental satellite clouds

This is a local, opt-in reconstruction experiment, not a validated cloud forecast.
It uses NOAA GOES-19 CONUS binary cloud mask (ACM/BCM), retrieved cloud-top
height (ACHA/HT), and cloud optical depth (COD) when valid. It downloads public
regional products and crops locally: the observer coordinates are not sent to NOAA.
The compact JSON snapshot is private local data, excluded from release packaging.

Install optional preprocessing dependencies:

    .venv/Scripts/python -m pip install -r prototypes/atmosphere/requirements-satellite.txt

Prepare a snapshot (example uses general Idledale coordinates):

    .venv/Scripts/python prototypes/atmosphere/prepare_satellite.py --lat 39.67 --lon -105.24

For historical reconstruction add `--time 2026-11-20T23:40:00Z`.
Default region radius is 220 km, sampled onto a 96 x 96 grid. Native satellite
products may be much coarser; this grid does not imply higher measurement resolution.
The CLI downloads several full CONUS products, potentially tens of MB. Only the
small output JSON goes to the browser. Archive support depends on NOAA availability.

Build and serve the candidate:

    python prototypes/atmosphere/build_candidate.py
    python prototypes/atmosphere/serve_candidate.py --port 5176

Open http://127.0.0.1:5176/prototypes/atmosphere/candidate/ and expand
**Experimental satellite clouds** below the color graph. Select **Load regional
snapshot**, or import the generated JSON file on a phone or another browser.
Enable **Atmospheric sky** to see this layer. Nothing is deployed by this workflow.

The renderer projects a georeferenced cloud field onto a curved Earth shell,
iterates against the retrieved top height, and approximates the visible cloud
level using half the adjustable assumed thickness. The preprocessor samples the
satellite fixed grid at cloud height for approximate parallax correction.
It does not reconstruct cloud sides, overlapping layers, or true cloud bases.
Missing heights fall back to the existing illustrative forecast sky, not an
invented retrieved height. Missing optical depth uses assumed tau=2, explicitly
reported in the controls. DQF-degraded retrievals are discarded.

The snapshot is static: it is applied only within +/-60 minutes of observation,
and only in its geographic region. This limit is a guardrail, not a skill estimate.
No advection, growth/decay, model profiles, radar, retrieved phase, or multiple
scattering is implemented yet. The color peak graph remains the forecast-based
model and is not claimed to include the satellite reconstruction. Atmospheric
extinction and twilight lighting are simplified. This experiment should first be
validated against time-matched ground photographs, including clear and multilayer
scenes, before use for viewing-window recommendations.

Sources:
- https://www.star.nesdis.noaa.gov/goesr/product_cp_cloud.php
- https://www.ncei.noaa.gov/products/goes-terrestrial-weather-abi-glm
- https://noaa-goes19.s3.amazonaws.com/


Cloud-base profile experiment
-----------------------------
Load a snapshot, then select **Load cloud-base profile**. This requests hourly
relative humidity, temperature and geopotential height on 13 pressure levels from
Open-Meteo using the current location rounded to 0.01 degree. It is a user-triggered
request, separate from the ordinary weather checkbox. Heights below model ground are excluded. The GFS endpoint now supplies 37 pressure
levels, sampled every 25 hPa from 1000 to 100 hPa; this does not imply native-level
resolution. Murphy & Koop (2005) liquid-water/ice saturation pressures convert RH
assuming provider RH is liquid-water-relative (a remaining convention uncertainty).
Water candidates require RH >=95%; ice candidates require RHi >=100%. Ice-only
intervals containing temperatures warmer than -38 C are phase-ambiguous and not
used automatically. Saturation supports a possible cloud, not proof of cloud or
ice nucleation. Boundaries are interpolated; gaps >2 km, unbounded intervals and
unsupported satellite-top matches cannot supply bases. Sampling uncertainty is
not a confidence interval. One column is limited to 50 km and +/-90 minutes.
Unsupported bases stay unknown; the renderer uses explicitly assumed manual
thickness. Native cloud liquid/ice mixing ratios are not available through this
endpoint and have not been integrated. Diagnostics show maximum water/ice RH even
when no candidate exists. The icing-sensor thesis algorithm is not integrated.

Sources:
- https://www.eol.ucar.edu/data-software/conventions-and-standards/water-vapor-pressure-formulations
- https://open-meteo.com/en/docs/gfs-api

Atmospheric sky integration runs in a Web Worker so ray integration cannot block
browser controls. Jobs are coalesced to the latest requested view; the previous
image remains visible while a new one is computed. No main-thread integration
fallback is used if workers fail. The basic sky remains available instead.

Event alignment: **Load imagery for selected event** now retrieves a NOAA region
for the astronomical sunrise/sunset time of the calculated location/date via the
local `/satellite-region` service. The server crops locally and rounds coordinates.
Changing event/location/date invalidates the old imagery and requests a matching
region while enabled. Future events retrieve latest available imagery, explicitly
labeled observation-only; imagery farther than 60 minutes from the event is not
applied. Imported snapshots must match event time and cover the location. Profiles
are selected nearest the resulting observation, and stale request completions are
rejected if event or imagery changes. Static hosting has no retrieval service;
use an event-matched imported snapshot there. No future cloud advection is implied.

The local server now fetches event-specific imagery through `/satellite-region`.
Changing event/date/location disables mismatched imagery and requests a replacement
while enabled. Profile results are discarded if their snapshot or event changed
in flight. Future events can only use latest observations within the one-hour
guard; no satellite forecast/advection is implied. Static hosting still requires
an imported snapshot matching the event and region. Dates/times show location zone.

Spectral twilight is a separate opt-in sky-view experiment. It samples 16 bands
from 400 to 700 nm with a 5778 K solar spectrum and converts using the Wyman et al.
(2013) CIE fits. Rayleigh/aerosol extinction is evaluated at each wavelength.
Ozone uses an assumed column (default 300 DU), a normalized layer centered at 25 km,
and a broad Gaussian Chappuis envelope peaking near 603 nm. This is a deliberately
coarse absorption approximation, not laboratory-resolved spectroscopy or measured
ozone. RGB conversion clips out-of-gamut negative components; display tone mapping
is approximate. Cloud lighting adds attenuated direct sunlight to four sampled
single-scattered sky directions, with approximate angular factors. This includes
sky-to-cloud illumination but is not a general multiple-scattering solution.
Clear-air multiple scattering, cloud self-shadowing and refraction remain absent.
The graph and peak timing retain the original model for comparison.

Automatic view following supersedes the earlier event-only request behavior:
enabled mode follows realtime/selected simulation time, debounced 800 ms and grouped
into five-minute slots. Historical slots fetch observations at/before slot start;
future slots use latest available observations. Old slots never render against a
new requested slot. Failed slots retry after five minutes; disabling stops queued
requests and ignores pending responses. The local server caches compact regions.

Wind projection uses GFS pressure-level wind speeds in m/s and meteorological
from-directions, interpolated as horizontal vectors versus altitude. Rendering
backtraces the sightline/cloud intersection into the observation grid, for 0–30
minutes after observation. A single profile applies only within 50 km; outside
that radius or missing wind/height coverage, the satellite estimate is unavailable
and the usual illustrative sky is retained. This is not a circulation simulation:
no observed optical flow, spatial wind grid, growth/decay or terrain-wave physics.
The display reports observation time and offset. No imagery beyond the 30-minute
limit is represented as a forecast. The graph remains the original model.

Visual comparison: spectral mode is now enabled by default in the local experiment
and remembered across reloads. Wind projection no longer discards distant observed
clouds: outside wind coverage it retains their observed positions and labels this
mixed behavior. With wind disabled, still imagery is available within 60 minutes
of observation, explicitly not a forecast. Wind mode retains its 30-minute limit.

Acquisition now runs on the one-second display update as well as drawing, covering
playback, scrubbing, realtime and projector mode. Source keys use the available
observation time, so future views check new observations as the wall clock advances.
One imagery request runs at a time and catches up afterward; clock changes no longer
discard a still-useful result. Missing profiles retry independently after five
minutes. The auto-download checkbox is remembered in that browser.

Presentation now retains the previous sky while imagery or matching profiles load,
with an explicit updating label. The renderer does not present a new unadvected
snapshot and then immediately replace it with the wind-projected version. An
older in-flight response that needs catch-up stays withheld until the current
source is ready. Profile failures eventually release the frame with labeled
assumptions rather than holding forever.

Loading transitions retain a previous frame only for 15 seconds, within two
minutes of simulated time and 0.25 degree solar altitude. Otherwise the current
atmospheric background is rendered while cloud data is pending, preventing a
night frame from persisting into sunrise. Loading text remains visible in
projector sky-only mode. Pi deployments expose ephemeral render-health metrics
(time, solar altitude, mean pixel level and loading state), without coordinates.
