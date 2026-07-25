#!/usr/bin/env bash
# Start the full local dev stack — API + Web
# Usage: ./start.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/stock-sim"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

cleanup() {
  echo ""
  echo "==> Stopping servers..."
  [ -n "${API_PID:-}" ] && kill "$API_PID" 2>/dev/null || true
  [ -n "${WEB_PID:-}" ] && kill "$WEB_PID" 2>/dev/null || true
  echo "==> Done."
}
trap cleanup EXIT INT TERM

echo "==> Checking migrations..."
.venv/bin/python -m alembic upgrade head 2>&1 || true

echo "==> Starting API (uvicorn) on :8000..."
.venv/bin/python -m uvicorn apps.api.main:app --port 8000 --reload &
API_PID=$!

echo "==> Starting Web (Next.js) on :3000..."
(cd apps/web && npx next dev --port 3000) &
WEB_PID=$!

echo ""
echo "  ┌────────────────────────────────────────┐"
echo "  │  API  →  http://localhost:8000          │"
echo "  │  Web  →  http://localhost:3000          │"
echo "  │  Press Ctrl+C to stop both servers      │"
echo "  └────────────────────────────────────────┘"
echo ""

wait
