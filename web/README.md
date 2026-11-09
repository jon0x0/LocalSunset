# Local Sunset: browser edition

This static website performs terrain and solar calculations in a Web Worker. Host the generated files over HTTPS, or HTTP on localhost. Use a current Chrome, Edge, Firefox or Safari with Web Workers, IndexedDB, OffscreenCanvas and WebAssembly support. No application server or credentials are needed.

From the source repository, run `python tools/build_browser.py`. Publish the contents of `dist/browser` (not its parent) on a static host, including under a GitHub Pages project path. `dist/localsunset-browser.zip` contains the same files. Python is only a build/optional preview tool; visitors do not need it. Keep the worker and vendor paths intact.

## Terrain and search

US locations try USGS 3DEP elevation TIFFs. Global AWS Terrarium tiles provide fallback. Latitudes above 80 degrees use a projected NOAA mosaic. Ground elevation, observer height, Earth curvature and the terrain horizon feed the solar disk visibility calculation. Requested resolution cannot improve the underlying DEM. Buildings, trees and clouds are excluded from timing. The optional decorative trees are generic and off by default.

Enter coordinates, a place name, or a street address and US ZIP. City/state autofill from ZIP. US Census supplies street matches; Photon/OpenStreetMap supplies worldwide search. City/ZIP centers are explicitly approximate. Review each suggested address. Address availability varies by provider.

First visits to new terrain and address searches require Internet access and providers that permit browser requests. Requests disclose their requested map area/address to the provider. No location is embedded in this distribution. Saved places, alignment defaults and appearance settings stay in this browser's storage, isolated from the Python edition and other devices.

## Caching and offline use

IndexedDB reuses downloaded elevation tiles, traced horizons and daily calculations. A service worker retains application assets after the first successful load. Previously cached areas can be recalculated for other dates offline, and cached scenes survive reloads. New terrain and searches still need Internet. Browser storage can be evicted by the browser, is not shared across origins, and is temporary in private browsing.

The Cache panel reports terrain/calculation usage and clears it. Clearing keeps saved places, alignment defaults, appearance and the last displayed image. The application shell cache is kept for offline loading. Clearing all site data through browser settings also removes saved places and settings.

Start with Fast detail and a moderate range on a Pi. The worker limits each calculation to 512 terrain tiles and reports an error if a selected range/detail exceeds that budget. Download/network failures preserve the last valid scene. A browser storage quota failure can prevent persistent caching while the current calculation continues.

## Display and precision

Time slider, realtime sky, stars/planets, local clock, countdown, keystone/FOV and local projector layout work in this edition. Independent network control of a Raspberry Pi HDMI display and `LOCAL_DEM` raster loading use the Python/Pi edition. Settings here affect this browser only.

Displayed seconds express numerical precision, not guaranteed observed accuracy. DEM resolution, atmospheric refraction and small horizon features affect actual first/last light; the 15-second event scan can miss tiny visibility windows. Polar/marine DEM coverage has further limitations. The sky is a clear-sky model, not live measured weather.

See BROWSER-THIRD-PARTY.md and THIRD-PARTY.md for software/data attribution.
