#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/../offchain/frontend"

MODE=${1:-${FRONTEND_MODE:-prod}}
PID_FILE=".frontend.${MODE}.pid"
LOCK_FILE=".next/dev/lock"
PORT=${PORT:-3000}

# Kill old process for this mode
if [[ -f "$PID_FILE" ]]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "Stopping previous frontend (${MODE}) (PID: $OLD_PID)..."
        kill "$OLD_PID"
        sleep 1
    fi
    rm -f "$PID_FILE"
fi

# Clean dev lock (harmless in prod)
if [[ -f "$LOCK_FILE" ]]; then
    echo "Removing orphaned Next.js dev lock..."
    rm -f "$LOCK_FILE"
fi

if [[ "$MODE" == "dev" ]]; then
    echo "Starting frontend in dev mode on port ${PORT} (npm run dev)..."
    PORT=$PORT npm run dev &
else
    echo "Building frontend..."
    npm run build
    echo "Starting frontend in production mode on port ${PORT} (npm run start)..."
    PORT=$PORT npm run start &
fi

echo $! > "$PID_FILE"
echo "Frontend started (${MODE}) (PID: $(cat "$PID_FILE"))"
echo "URL: http://localhost:${PORT}"
