#!/usr/bin/env bash
set -euo pipefail

TOKEN="${TOKEN:-gaelito2025}"
BASE_URL="${BASE_URL:-https://matiastrapaglia.space/iot}"

echo "Checking frontend at ${BASE_URL}"
curl -I "${BASE_URL}"

echo
echo "Checking API at ${BASE_URL}/api/measurements?token=<redacted>"
curl -I "${BASE_URL}/api/measurements?token=${TOKEN}"
