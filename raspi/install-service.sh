#!/usr/bin/env bash
# Optional per-user headless server autostart. Does not change login settings.
set -euo pipefail
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
NETWORK_FLAG=''
if [[ "${1:-}" == '--network' ]]; then
  if [[ ! -f "$ROOT_DIR/.network-auth.json" ]]; then
    echo 'Set a password first: .venv/bin/python serve.py --set-password'
    exit 1
  fi
  NETWORK_FLAG='--network'
elif [[ -n "${1:-}" ]]; then
  echo 'Usage: bash raspi/install-service.sh [--network]'
  exit 1
fi
if [[ "$ROOT_DIR" == *'%'* || "$ROOT_DIR" == *'"'* || "$ROOT_DIR" == *$'\n'* ]]; then
  echo 'Move the project to a path without percent signs, quotes, or newlines before installing the service.'
  exit 1
fi
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/local-sunset.service" <<EOF
[Unit]
Description=Local Sunset terrain server
After=network-online.target

[Service]
WorkingDirectory="$ROOT_DIR"
ExecStart="$ROOT_DIR/.venv/bin/python" "$ROOT_DIR/serve.py" --pi --no-browser $NETWORK_FLAG
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now local-sunset.service
echo 'User server enabled. Logs: journalctl --user -u local-sunset -f'
echo 'For startup without a login, enable lingering explicitly: sudo loginctl enable-linger "$USER"'
