#!/bin/bash
cd "$(dirname "$0")/frontend"

PID_FILE=".frontend.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "Deteniendo frontend (PID: $PID)..."
        kill "$PID"
        echo "Frontend detenido"
    else
        echo "No hay proceso frontend corriendo con PID $PID"
    fi
    rm -f "$PID_FILE"
else
    echo "No se encontró archivo PID. Intentando matar procesos 'next dev'..."
    pkill -f "next dev" && echo "Procesos detenidos" || echo "No se encontraron procesos"
fi
