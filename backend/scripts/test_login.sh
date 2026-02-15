#!/bin/bash
API_URL="https://turno-pvu-backend.xtrctr.workers.dev/api/auth/login"

echo "Testing Login for Coordinator..."
# JSON payload
JSON='{"username": "coord.cs001", "password": "Coord123!"}'

# Curl con -v para ver headers y status
curl -v -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "$JSON" 2>&1
