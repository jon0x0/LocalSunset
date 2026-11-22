# Local Sunset

Terrain-aware sunrise, sunset and realtime sky for a browser, desktop or Raspberry Pi projector.

## Physics and data

Local Sunset combines astronomical solar positioning with a spherical atmospheric model to simulate sunrise, sunset and twilight. It calculates wavelength-dependent Rayleigh scattering by air molecules, directional scattering by aerosols, and Beer–Lambert attenuation along the incoming sunlight and viewing paths. Spectral mode samples 16 wavelength bands from 400–700 nm and includes approximate ozone absorption, helping reproduce warm direct sunlight and pink or purple twilight. Aerosol optical depth and ozone are assumed model parameters, not live measurements. Cloud lighting combines direct sunlight with diffuse sky illumination. Elevation data supplies the skyline and terrain-adjusted sunrise/set times; terrain lighting additionally models slope orientation, mountain shadows and a moving sunline as peaks become illuminated before valleys. Assumed earth/vegetation reflectance and highlight compression preserve surface color. Reflectance, exposure, haze and cloud attenuation remain approximate; full atmospheric multiple scattering, detailed cloud interiors and actual snow-covered surfaces are not reconstructed.

When enabled, the app downloads [NOAA GOES-19](https://noaa-goes19.s3.amazonaws.com/) satellite cloud masks, cloud-top heights and optical depth, then projects that geographic cloud field into the observer’s sky view using cloud altitude, Earth curvature and satellite parallax correction. [Open-Meteo](https://open-meteo.com/en/docs) supplies local forecasts for cloud cover, temperature, wind and precipitation, plus atmospheric humidity, temperature and wind profiles used to estimate cloud bases and advect clouds toward the selected time. Wind projection extends up to 90 minutes after observation, with reduced confidence beyond 30 minutes; it does not predict cloud growth or decay. Historical satellite requests select observations at or before the requested time, while future views use the latest available observation. Missing satellite geometry falls back to illustrative forecast-based clouds or the atmosphere alone; the local forecast is not an archived observation of the historical sky. Terrain downloads and calculations are cached. **About this image** identifies observation times, assumptions, loading state and the data sources used for the displayed frame.

[Try the browser edition](https://jon0x0.github.io/LocalSunset/) · [Detailed physics, data sources and limitations](https://jon0x0.github.io/LocalSunset/about.html)

## Run

Python 3.10+ is required. Install dependencies in a virtual environment:

```sh
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
python -m pip install -r requirements.txt
python serve.py
```

Open http://127.0.0.1:5000 . Choose a place using address search, street + US ZIP, or coordinates. The application starts without a preset location. Ground elevation is sampled automatically; entered height is above ground. Save locations on your own installation for later use.

**Use my location** requests one fresh high-accuracy browser/device fix only when clicked, with reported accuracy. Choose temporary permission if offered; permission lifetime is controlled by your browser. Phones may use GPS together with Wi-Fi/cellular sources; the web API cannot force or identify GPS. No continuous tracking or automatic startup location request is made. Existing last-location startup behavior is retained. Device altitude is not used: ground elevation still comes from the DEM, with the existing manual override. Review the coordinates and trace, or explicitly save a named place. Geolocation requires HTTPS (or localhost); plain HTTP LAN access to the Pi cannot request phone location. Use an HTTPS reverse proxy for the Pi or use address/coordinate input.

Raspberry Pi installation and HDMI kiosk instructions: [raspi/README.md](raspi/README.md).

## Browser-only website

A separate static edition runs terrain decoding/tracing, sunrise/sunset solving, time-zone lookup and rendering entirely in the browser. No Python API, account or API key is required. Build it with:

```sh
python tools/build_browser.py
```

Upload the contents of `dist/browser/` to any static HTTPS host (including GitHub Pages), or deploy `dist/localsunset-browser.zip`. For a local preview, run `python -m http.server 5173 --directory dist/browser` and open http://localhost:5173 . Opening index.html through file:// is unsupported.

See [browser edition instructions](web/README.md) for caching, provider requirements and limits. The existing Python/Pi edition remains available for remote HDMI control and local DEM files.

For GitHub Pages, create a public repository named **LocalSunset**, push the clean source to `main`, and select **Settings → Pages → Source: GitHub Actions**. The included **Publish LocalSunset** workflow tests and builds only the static browser edition for the website. Its **LocalSunset-downloads** artifact includes both the browser ZIP and the Raspberry Pi source ZIP. Python/Pi server code stays in the repository and is not served by Pages. No deployment secrets are required.

## Terrain and precision

US locations automatically try USGS 3DEP, with global AWS Terrarium fallback. Above the Web Mercator polar limit, the server uses a NOAA polar mosaic. A georeferenced local raster in meters can be supplied through `LOCAL_DEM`. Pixel spacing and source resolution differ; higher detail and range cost memory/time. Begin with Fast/Standard and a moderate range on a Pi.

The horizon includes Earth curvature, observer height and sampled bare-earth elevation. Astronomy Engine supplies the solar coordinates, refraction and disk radius. Events search for the first visible and last hidden solar disk rays. Results are displayed to the second, but DEM resolution, atmosphere, horizon sampling and unmodeled vegetation/buildings/clouds prevent guaranteed second-level observational accuracy. Extremely short visibility windows may be missed. Marine and polar coverage have additional DEM limitations.

You can override your ground elevation, including with a value below the DEM lookup. Height above ground is added to that value to obtain observer elevation. With an override, nearby DEM samples inside a configurable exclusion radius (100 m by default; 50–1000 m allowed) do not block the Sun. Terrain beyond that radius keeps its DEM elevations. Clearing the override restores automatic ground elevation and normal nearby sampling. Overrides and exclusion distances are saved per location and synchronized with the Pi display; cached horizons/results distinguish these settings.

## Display

- Sunrise and sunset predictions, current local time, countdown/count-up, 12/24-hour formats.
- Realtime follows current time and clear-sky solar brightness; manual time slider/playback explores the selected date.
- After two hours without user input, unattended mode follows the current local date and realtime sky, centering/counting down to whichever sunrise or sunset occurs next. After sunset it can track tomorrow's sunrise while retaining today's sky; the date advances at local midnight. Last location, manual elevation/exclusion radius, terrain detail, appearance, FOV and alignment are retained. Activity on connected Pi control pages resets the projector's timer. New input stops automatic event following. Cached terrain is reused; updates retain the last good scene until ready. At polar sites the next-event search can take longer and looks up to 370 local dates ahead.
- Drag-pan 360 degrees; adjustable 30-120 degree horizontal FOV.
- Projector layout, optional text-free Sky only, and live network controls.
- Four-corner keystone, paired signed taper, saved default/restore, and reset.
- Atmospheric sun glow and optional generic decorative trees. Trees are off by default and never affect computed event times. No photographed or location-specific tree landmarks are included.
- 5,070 HYG v4.1 stars and Astronomy Engine positions for Mercury through Neptune, with proper motion, annual parallax/aberration, precession/nutation and atmospheric refraction. Terrain hides occulted objects. Optional names stay hidden in Sky only mode. Visibility/color/size are modeled from magnitude, twilight and approximate extinction, not live measured sky brightness. The Moon, Milky Way and deep-sky imagery are not currently rendered.

Use P for projector layout, F for fullscreen and Escape to exit. Sky only can be disabled remotely or with Escape. Desktop-to-projector relay can be configured with `python serve.py --display-server http://projector.local:5000`; that target is local runtime configuration, not committed source.

## Caching and Clear cache

Private runtime data lives under `.cache/` and is excluded from Git/releases:

- Downloaded terrain tiles are reused across locations/dates that share coverage.
- Traced horizons are reused for the same observer/terrain settings, including across dates and restarts.
- Completed daily results are reused for the same inputs across server restarts.
- Browser storage retains the last valid scene/view so updates and reconnects do not blank the display.

Open **Cache** for usage and **Clear cache**. Choose this browser, server terrain/calculations, or both. Clearing retains the current displayed image, saved places, projector defaults and appearance settings. Browser scene writes resume on the next successful trace. A running/queued calculation blocks clearing server caches. Other browsers' local storage is separate. A changed local raster file invalidates its derived cache keys.

## Privacy and Git

Saved places, cached areas/results, local photos/attachments, network credentials, display targets, local calibration and deployment records are runtime/private data and are ignored by Git. Never commit `.cache`, `.local-private`, saved location/config files or personal screenshots. Public files are explicitly listed by `tools/public_files.py`; release ZIPs use the same allowlist.

```sh
python tools/audit_public.py
python tools/package_pi.py
```

The audit checks public files against local saved location names/coordinates and the local relay host, as well as private paths/images. It is an additional check, not a guarantee against every possible personal detail. Inspect staged changes before pushing. The release archive contains audited source only, not your runtime cache/settings.

Address/geocoding requests are sent to the configured providers; terrain requests reveal the requested map areas to elevation providers. Saved locations and caches remain on the installation unless you export or publish them. Network settings apply to every device able to reach that installation. Authentication is enabled for network mode by default; `--no-auth` explicitly allows all reachable LAN devices to configure it.

## Data and software attribution

Elevation: [USGS 3DEP](https://www.usgs.gov/3d-elevation-program), [Mapzen/AWS Terrarium](https://github.com/tilezen/joerd), [NOAA](https://www.ncei.noaa.gov/products/etopo-global-relief-model). Address search: [Photon/OpenStreetMap](https://photon.komoot.io), [US Census](https://geocoding.geo.census.gov), [Zippopotam.us](https://api.zippopotam.us).

Stars: HYG v4.1 by David Nash / Astronomy Nexus, CC BY-SA 4.0. Astronomy Engine v2.1.19: MIT. See [third-party notices](static/THIRD-PARTY.md) and the bundled engine license. The adapted catalog remains under its stated share-alike license. No license for the original application source has been selected by its owner.

## Tests

```sh
python -m unittest discover -s tests -v
```

JavaScript regression scripts are in `tests/`; run them from the repository root using a modern Node.js runtime. Tests use synthetic or public reference coordinates, never installation-saved places. Astronomy fixtures cross-check the JavaScript renderer against Python Astronomy Engine.


## Atmospheric sky and viewing forecast

The browser edition includes an offline spherical single-scattering atmosphere, terrain-aware sky preview, swipe/slider timeline, modeled color peak and configurable viewing window. Optional Open-Meteo forecasts add illustrative cloud layers, temperature and wind for the selected time, with remembered opt-in and automatic refresh. Terrain downloads can be disabled while retaining required point ground elevation. The linked About page explains physics, metrics, data attribution and model limitations. Existing browser saved places and the two-hour return to realtime are retained. The atmospheric build sources are explicitly included in the public release allowlist; no private device configuration is published.
