#!/bin/bash
cd "$(dirname "$0")/frontend"

PID_FILE=".frontend.pid"
LOCK_FILE=".next/dev/lock"

# Kill all next dev processes (not just parent npm process)
echo "Buscando procesos 'next dev' existentes..."
pkill -f "next dev" 2>/dev/null && echo "Procesos previos eliminados" || echo "No hay procesos previos"

# Clean up PID file
if [ -f "$PID_FILE" ]; then
    rm -f "$PID_FILE"
fi

# Remove lock file if exists (orphaned from crashed process)
if [ -f "$LOCK_FILE" ]; then
    echo "Eliminando lock file huérfano..."
    rm -f "$LOCK_FILE"
fi

# Wait for processes to fully terminate and lock to be released
sleep 2

# Start new process
echo "Iniciando frontend (npm run dev)..."
npm run dev &
echo $! > "$PID_FILE"
echo "Frontend iniciado (PID: $(cat $PID_FILE))"
echo "URL: http://localhost:3000"
