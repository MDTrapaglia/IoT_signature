#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="/home/mtrapaglia/projects/esp32_sign/full_stack"
BACKEND_COMMAND="${BACKEND_COMMAND:-dev}"

# Load Node from nvm when available so npm resolves correctly under systemd
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$HOME/.nvm/nvm.sh"
fi

cd "$PROJECT_ROOT"
exec npm run "$BACKEND_COMMAND"
