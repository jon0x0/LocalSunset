#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "$(uname -m)" != "aarch64" ]]; then
  echo "Use 64-bit Raspberry Pi OS (aarch64). This installer targets Raspberry Pi 4/5."
  exit 1
fi
sudo apt-get update
sudo apt-get install -y python3-venv python3-pip python3-dev build-essential libffi-dev python3-numpy python3-pil python3-rasterio curl
python3 -m venv --system-site-packages "$ROOT_DIR/.venv"
"$ROOT_DIR/.venv/bin/python" -m pip install -r "$ROOT_DIR/requirements.txt"
printf '\nInstalled. Start with: bash "%s/raspi/run.sh"\n' "$ROOT_DIR"
echo 'For HDMI kiosk output, install Chromium and run raspi/kiosk.sh from the Pi desktop.'
