#!/bin/bash

BASE_URL="http://localhost:3001"

# Usar jq si existe, sino mostrar raw
format() {
  if command -v jq &>/dev/null; then
    jq .
  else
    cat
  fi
}

echo "=== Test POST /api/ingest ==="
curl -s -X POST "$BASE_URL/api/ingest" \
  -H "Content-Type: application/json" \
  -d '{
    "sensor_id": "ESP32_001",
    "value": 25.5,
    "signature": "test_signature_abc123",
    "publicKey": "test_public_key_xyz"
  }' | format

echo ""
echo "=== Test GET /api/measurements ==="
curl -s "$BASE_URL/api/measurements" | format
