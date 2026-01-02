#!/bin/bash
cd "$(dirname "$0")/../offchain/frontend"

PID_FILE=".frontend.pid"
LOCK_FILE=".next/dev/lock"

# Kill all next dev processes (child processes of npm)
echo "Deteniendo todos los procesos 'next dev'..."
pkill -f "next dev" 2>/dev/null && echo "Procesos detenidos" || echo "No se encontraron procesos corriendo"

# Clean up PID file
if [ -f "$PID_FILE" ]; then
    rm -f "$PID_FILE"
    echo "Archivo PID eliminado"
fi

# Remove lock file if exists
if [ -f "$LOCK_FILE" ]; then
    echo "Eliminando lock file..."
    rm -f "$LOCK_FILE"
fi

echo "Frontend detenido completamente"
