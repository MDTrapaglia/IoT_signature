#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="/home/mtrapaglia/projects/esp32_sign/full_stack/offchain/frontend"
FRONTEND_COMMAND="${FRONTEND_COMMAND:-dev}"
LOCK_FILE="$PROJECT_ROOT/.next/dev/lock"
NEXT_DISABLE_TURBOPACK=${NEXT_DISABLE_TURBOPACK:-1}

# Load Node from nvm when available so npm resolves correctly under systemd
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$HOME/.nvm/nvm.sh"
fi

# Clean orphaned Next.js lock to avoid startup failure after crashes
if [ -f "$LOCK_FILE" ]; then
  rm -f "$LOCK_FILE"
fi

cd "$PROJECT_ROOT"
export NEXT_DISABLE_TURBOPACK
exec npm run "$FRONTEND_COMMAND"
