#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
if [[ -z "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]]; then
  echo 'Launch kiosk.sh from a logged-in graphical desktop session.'
  exit 1
fi
CHROMIUM_BIN="$(command -v chromium || command -v chromium-browser || true)"
if [[ -z "$CHROMIUM_BIN" ]]; then
  echo 'Install Chromium first: sudo apt-get install chromium'
  exit 1
fi
PORT_NUMBER="${PORT:-5000}"
SERVER_PID=''
BROWSER_PID=''
cleanup() {
  if [[ -n "$BROWSER_PID" ]]; then kill "$BROWSER_PID" 2>/dev/null || true; fi
  if [[ -n "$SERVER_PID" ]]; then kill "$SERVER_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT
trap 'exit 0' INT TERM
if ! curl --fail --silent "http://127.0.0.1:$PORT_NUMBER/api/health" >/dev/null; then
  bash raspi/run.sh --no-browser --port "$PORT_NUMBER" &
  SERVER_PID=$!
fi
READY=0
for attempt in {1..30}; do
  if curl --fail --silent "http://127.0.0.1:$PORT_NUMBER/api/health" >/dev/null; then READY=1; break; fi
  sleep 1
done
if [[ "$READY" != 1 ]]; then echo 'Local Sunset did not start. Check the terminal output.'; exit 1; fi
# Software rendering avoids intermittent vc4/GLES buffer failures on Pi kiosks.
# The low-power canvas profile caps resolution and frame rate.
BROWSER_FLAGS=(--disable-gpu --disable-gpu-compositing)
if [[ -n "${WAYLAND_DISPLAY:-}" ]]; then
  BROWSER_FLAGS+=(--ozone-platform=wayland)
fi
# A Sway console kiosk may request crash recovery; desktop launches still exit
# normally when the user closes Chromium.
FAILURES=0
while true; do
  STARTED=$SECONDS
  "$CHROMIUM_BIN" "${BROWSER_FLAGS[@]}" --kiosk --no-first-run --disable-session-crashed-bubble \
    --user-data-dir="$ROOT_DIR/.cache/chromium-kiosk" \
    "http://127.0.0.1:$PORT_NUMBER/?projector=1&pi=1&auto=1" &
  BROWSER_PID=$!
  wait "$BROWSER_PID" || true
  BROWSER_PID=''
  if [[ "${LOCAL_SUNSET_KIOSK_RESTART:-0}" != 1 ]]; then break; fi
  if (( SECONDS-STARTED < 20 )); then FAILURES=$((FAILURES+1)); else FAILURES=0; fi
  if (( FAILURES >= 3 )); then sleep 30; else sleep 2; fi
done
