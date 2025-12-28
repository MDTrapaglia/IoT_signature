#!/bin/bash
cd "$(dirname "$0")/frontend"

PID_FILE=".frontend.pid"

# Kill previous process if exists
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "Matando proceso previo de frontend (PID: $OLD_PID)..."
        kill "$OLD_PID"
        sleep 1
    fi
    rm -f "$PID_FILE"
fi

# Start new process
echo "Iniciando frontend (npm run dev)..."
npm run dev &
echo $! > "$PID_FILE"
echo "Frontend iniciado (PID: $(cat $PID_FILE))"
echo "URL: http://localhost:3000"
