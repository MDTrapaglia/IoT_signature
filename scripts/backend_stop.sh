#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

stop_pid_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    local pid
    pid=$(cat "$file")
    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping backend (PID: $pid) from ${file}..."
      kill "$pid"
      rm -f "$file"
      echo "Backend stopped (${file})"
    else
      echo "Process in ${file} no longer exists"
      rm -f "$file"
    fi
  fi
}

stop_pid_file ".backend.dev.pid"
stop_pid_file ".backend.prod.pid"

if [[ ! -f ".backend.dev.pid" && ! -f ".backend.prod.pid" ]]; then
  echo "No backend process found"
fi
