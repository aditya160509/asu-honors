#!/usr/bin/env bash
# Generate TypeScript types from the FastAPI OpenAPI schema.
# Usage: ./scripts/gen-api-types.sh [output_path]
# Default output: apps/web/lib/api/types.ts (Phase 6 frontend)
set -euo pipefail

OUTPUT="${1:-apps/web/lib/api/types.ts}"
API_PORT="${API_PORT:-8001}"

echo "Starting API server on port $API_PORT..."
uvicorn apps.api.main:app --host 127.0.0.1 --port "$API_PORT" &
API_PID=$!
sleep 2

echo "Fetching OpenAPI schema..."
curl -s "http://127.0.0.1:$API_PORT/openapi.json" -o /tmp/openapi.json

echo "Generating TypeScript types -> $OUTPUT..."
mkdir -p "$(dirname "$OUTPUT")"
npx --yes openapi-typescript /tmp/openapi.json --output "$OUTPUT"

kill "$API_PID" 2>/dev/null || true
echo "Done — $OUTPUT written."
