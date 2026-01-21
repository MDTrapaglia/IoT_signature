#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICE_TOGGLE="${HOME}/programas/bins/service_toggle"

[[ -x "$SERVICE_TOGGLE" ]] || { echo "service_toggle not found at ${SERVICE_TOGGLE}" >&2; exit 1; }

PROJECT_NAME="esp32-full-stack"
PORTS="3000 3001"
LOG_FILE="${ROOT_DIR}/logs/dev.log"
LOG_LINES="${LOG_LINES:-120}"
LOG_FOLLOW_SECS="${LOG_FOLLOW_SECS:-5}"

START_CMDS=$(
  cat <<EOF
${SCRIPT_DIR}/backend_start.sh >>"${LOG_FILE}" 2>&1
${SCRIPT_DIR}/frontend_start.sh >>"${LOG_FILE}" 2>&1
EOF
)

STOP_CMDS=$(
  cat <<EOF
${SCRIPT_DIR}/frontend_stop.sh >>"${LOG_FILE}" 2>&1
${SCRIPT_DIR}/backend_stop.sh >>"${LOG_FILE}" 2>&1
EOF
)

export PROJECT_NAME ROOT_DIR START_CMDS STOP_CMDS PORTS LOG_FILE LOG_LINES LOG_FOLLOW_SECS SERVICE_TOGGLE

exec "$SERVICE_TOGGLE" stop
