#!/usr/bin/env bash
set -euo pipefail

SERVICES=("iot-service-backend.service" "iot-service-frontend.service")
PORTS=("3001" "3000")

for svc in "${SERVICES[@]}"; do
  echo "==> $svc"
  if ! systemctl --user show "$svc" >/dev/null 2>&1; then
    echo "   status: not installed"
    echo
    continue
  fi

  ACTIVE=$(systemctl --user is-active "$svc" 2>/dev/null || true)
  SUBSTATE=$(systemctl --user show -p SubState --value "$svc" 2>/dev/null || true)
  PID=$(systemctl --user show -p MainPID --value "$svc" 2>/dev/null || true)
  EXIT_CODE=$(systemctl --user show -p ExecMainStatus --value "$svc" 2>/dev/null || true)

  echo "   status: $ACTIVE (substate: ${SUBSTATE:-unknown}) pid: ${PID:-0} exit: ${EXIT_CODE:-N/A}"

  # Port check (assumes backend->3001, frontend->3000 in same order as SERVICES)
  if command -v ss >/dev/null 2>&1 && [ "${#PORTS[@]}" -eq "${#SERVICES[@]}" ]; then
    # Map service to port by index order
    for i in "${!SERVICES[@]}"; do
      if [ "${SERVICES[$i]}" = "$svc" ]; then
        port="${PORTS[$i]}"
        PORT_STATE=$(ss -ltn "( sport = :$port )" 2>/dev/null | tail -n +2 | awk '{print $4}' | sed 's/.*://')
        if [ -n "$PORT_STATE" ]; then
          echo "   port $port: listening"
        else
          echo "   port $port: not listening"
        fi
        break
      fi
    done
  fi

  echo "   recent logs:"
  # Show recent logs even if the journal is empty; avoid failing on missing entries.
  journalctl --user -u "$svc" -n 20 --no-pager 2>/dev/null || echo "   (no logs found)"
  echo
done
