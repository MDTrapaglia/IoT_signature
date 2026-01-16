#!/bin/bash
set -e

# Stop frontend and backend development servers
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Stopping frontend..."
"$SCRIPT_DIR/frontend_stop.sh"

echo "Stopping backend..."
"$SCRIPT_DIR/backend_stop.sh"

echo "All services stopped"
