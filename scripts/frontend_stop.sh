#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/../offchain/frontend"

LOCK_FILE=".next/dev/lock"

stop_pid_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    local pid
    pid=$(cat "$file")
    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping frontend (PID: $pid) from ${file}..."
      kill "$pid"
      rm -f "$file"
      echo "Frontend stopped (${file})"
    else
      echo "Process in ${file} no longer exists"
      rm -f "$file"
    fi
  fi
}

stop_pid_file ".frontend.dev.pid"
stop_pid_file ".frontend.prod.pid"

# Remove lock file if exists
if [[ -f "$LOCK_FILE" ]]; then
    echo "Removing lock file..."
    rm -f "$LOCK_FILE"
fi

if [[ ! -f ".frontend.dev.pid" && ! -f ".frontend.prod.pid" ]]; then
  echo "No frontend process found"
fi
