# Raspberry Pi and projector setup

Use a Raspberry Pi 4 or 5, a **64-bit Raspberry Pi OS desktop**, and at least 2 GB RAM. A Pi 5 / 4 GB is preferable for a 1080p projector. Python 3.10–3.12 is recommended; Bookworm's Python 3.11 is suitable. The server, real terrain calculations, network authentication, and 33 tests have been verified natively on ARM64 Bookworm/Python 3.11. Visual HDMI verification requires an active projector connection.

## Install

Copy/extract the project into a writable folder on the Pi, for example `~/LocalSunset`, then run:

```bash
cd ~/LocalSunset
bash raspi/install.sh
bash raspi/run.sh
```

The installer installs Python, build tools, and distribution-provided NumPy/Pillow/Rasterio packages, then creates a virtual environment and installs the app dependencies. This avoids compiling GDAL on a small Pi. Installation requires Internet access and sudo for apt. Use the included source files, not a Windows `.venv` directory.

The Pi profile defaults to Fast terrain with a 30 km range, caps the canvas at 1280 physical pixels wide, limits simulation playback to approximately 15 frames per second, and uses Waitress rather than Flask's development server. The countdown still updates each second. Higher terrain detail remains available in settings. The calculations are the same as the desktop version.

Search/select a location, save it, and calculate once while online to fill the terrain cache. Address providers and new terrain downloads need Internet access. Cached terrain and a local GeoTIFF can be used offline; the Pi's clock must remain accurate for the countdown. Files live beside the application: `locations.json`, `.cache/terrain`, and optionally a local DEM selected by `LOCAL_DEM`.

## HDMI projector / kiosk

Set the Pi's HDMI display resolution to the projector's supported mode in Raspberry Pi OS. Connect the projector as the desktop's active display. From a terminal **inside the graphical desktop**, run:

```bash
sudo apt-get install chromium
bash raspi/kiosk.sh
```

This launches the server if necessary and opens Chromium in kiosk mode. It loads the **last saved location**, selects today's date in that location's time zone, calculates, and shows the live sky. It checks for a new local day once per minute and recalculates on date rollover. Save a location before using unattended mode. With no saved location it displays setup instructions instead of inventing a site.

The kiosk has its own Chromium profile in `.cache/chromium-kiosk`. Close Chromium with Alt+F4 to end the kiosk session; a server started by this script is then stopped. If a server was already running, the script leaves it running. No browser sandbox protection is disabled.

To start kiosk mode when you log into the Pi desktop, add an autostart entry using your desktop session's startup settings, with this command (substitute your actual folder):

```text
bash /home/YOUR_USER/LocalSunset/raspi/kiosk.sh
```

Raspberry Pi OS desktop autostart mechanisms differ between releases. Use the desktop's documented startup configuration; do not launch Chromium as root or from a headless system service. Disable display blanking in Raspberry Pi OS display/power settings if you need continuous projection.

## Optional headless server service

Stop any manually launched server first (Ctrl+C) so port 5000 is free. For a server that starts with your user session:

```bash
bash raspi/install-service.sh
systemctl --user status local-sunset
journalctl --user -u local-sunset -f
```

To start the user service at boot without signing in, explicitly enable lingering:

```bash
sudo loginctl enable-linger "$USER"
```

To disable the server service:

```bash
systemctl --user disable --now local-sunset.service
```

The user service runs only the server; the graphical kiosk is started from the desktop. Loopback binding is the default. For password-protected LAN configuration, follow the network setup below. Non-loopback binding requires a configured password, including when `--host 0.0.0.0` is supplied explicitly.

## Desktop projector controls

Calculate a location, then click **Projector view**. This uses the current calculation, hides the setup panels, and requests fullscreen. The browser may require the **Fullscreen** button or its own fullscreen command. A projector URL (`?projector=1`) loads the layout but cannot bypass the browser's fullscreen gesture requirement.

- **P:** toggle the projector layout; **F:** request fullscreen; **Escape / Exit projector:** return to normal layout.
- Choose sunrise/sunset to change the countdown and view direction. First-light and last-ray times remain visible together.
- **Live sky:** follow the device clock for today's calculated local day. Time scrolling / playback returns to simulation mode; the display explicitly identifies live versus simulated sky.
- Drag horizontally to pan 360°. Arrow keys pan when the canvas is focused; Home recenters.

URLs can combine `?projector=1&pi=1&auto=1&event=sunrise`. These are presentation settings; no location is sent in the URL. `auto=1` uses the last saved location. For a particular other location, select and save it again to make it the last saved place.

On Windows or other desktops, after installing requirements:

```powershell
.\.venv\Scripts\python serve.py --projector
```

Projector output uses a conventional rectangular perspective panorama. Fisheye / dome projection, geometric projector calibration, and multi-projector edge blending are not implemented. Predicted times retain the terrain and atmosphere accuracy limitations documented in the main README.

Reference documentation: [Raspberry Pi OS](https://www.raspberrypi.com/documentation/computers/os.html) and [Waitress deployment](https://flask.palletsprojects.com/en/stable/deploying/waitress/).

## Configure the projector over the network

Stop any running manual server first, then set an admin password interactively on the Pi (do not put passwords in shell commands):

```bash
.venv/bin/python serve.py --set-password
bash raspi/run.sh --network --no-browser
```

From a phone, tablet, or computer on the same trusted LAN, open `http://raspberrypi.local:5000/` (substitute the Pi's actual hostname or IP address; `hostname -I` shows its addresses). Sign in as **admin** with your password. Allow TCP port 5000 through the host firewall for your trusted LAN if needed. The installer does not change firewall/router rules.

The normal address search, saved locations, and calculation settings are available remotely. Expand **Network display control** and use **Load current display settings** to edit the active configuration, or select a new location/coordinates and terrain settings, choose sunrise/sunset, today's local date or the selected date, live sky, and projector layout. Click **Apply to display**. This saves the configuration on the server; connected projector views and `auto=1` kiosks pick up changes within approximately three seconds when idle. Terrain calculations can take longer. Matching calculations are shared among displays. Changing a mode does not require another terrain download. A busy or disconnected screen retries rather than losing the saved configuration.

For the Pi's server to listen on the LAN automatically at startup:

```bash
# Stop the manually started server first.
bash raspi/install-service.sh --network
```

Then run the normal kiosk launcher on the HDMI desktop. Its loopback connection is trusted and does not require typing the admin password. A projector opened on a remote device requires sign-in. Leaving projector mode manually stops that ordinary browser tab following remote display changes; the Pi's unattended `auto=1` kiosk continues following them.

The persistent files `.network-auth.json` (password hash and session-signing key) and `.display-config.json` (display settings) stay on the device and are excluded from the Pi release ZIP. Protect these files and your saved locations. To change the password, stop the server, rerun `serve.py --set-password`, then restart; old remote sessions become invalid. Network sessions expire after 12 hours.

LAN mode uses HTTP, which is unencrypted. Use a trusted private LAN or an SSH tunnel/VPN; Internet hosting and TLS termination are not configured by these scripts. Do not forward the port to the public Internet. The app rejects cross-origin changes, requires authentication for remote reads and writes, and trusts only actual loopback connections with a localhost/loopback Host header. Unauthenticated health checks expose only service availability.

For a Sway console kiosk on Pi OS Lite, launch the generic kiosk script from the compositor and set `LOCAL_SUNSET_KIOSK_RESTART=1` for browser crash recovery. No full desktop is required.

### Password-free LAN option

Use `bash raspi/run.sh --network --no-auth --no-browser` to disable the application login explicitly. Any device that can reach the port can configure the app; cross-origin change checks remain active.
