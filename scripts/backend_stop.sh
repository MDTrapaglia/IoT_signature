#!/bin/bash
cd "$(dirname "$0")/.."

PID_FILE=".dev.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "Matando proceso (PID: $PID)..."
        kill "$PID"
        rm -f "$PID_FILE"
        echo "Proceso detenido"
    else
        echo "El proceso ya no existe"
        rm -f "$PID_FILE"
    fi
else
    echo "No hay proceso ejecutándose"
fi
