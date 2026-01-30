#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

MODE=${1:-${BACKEND_MODE:-prod}}
PID_FILE=".backend.${MODE}.pid"

# Kill previous process for this mode if exists
if [[ -f "$PID_FILE" ]]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "Stopping previous backend (${MODE}) (PID: $OLD_PID)..."
        kill "$OLD_PID"
        sleep 1
    fi
    rm -f "$PID_FILE"
fi

if [[ "$MODE" == "dev" ]]; then
    echo "Starting backend in dev mode (npm run dev)..."
    npm run dev &
else
    echo "Building backend..."
    npm run build:backend
    echo "Starting backend in production mode (node dist/offchain/backend/api_server.js)..."
    NODE_ENV=production node dist/offchain/backend/api_server.js &
fi

echo $! > "$PID_FILE"
echo "Backend started (${MODE}) (PID: $(cat "$PID_FILE"))"
