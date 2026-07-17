#!/usr/bin/env bash
# Start the full local dev stack (API + web) with drift checks so a stale
# process or an unapplied migration can never silently break the app again.
#
# Usage: ./dev.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

echo "==> Checking for pending Alembic migrations..."
CURRENT=$(.venv/Scripts/alembic current 2>/dev/null | tail -1 | awk '{print $1}')
HEAD=$(.venv/Scripts/alembic heads 2>/dev/null | tail -1 | awk '{print $1}')
if [ "$CURRENT" != "$HEAD" ]; then
  echo "!! Database is behind: current=$CURRENT head=$HEAD"
  echo "!! Running: alembic upgrade head"
  .venv/Scripts/alembic upgrade head
else
  echo "==> Database is up to date (revision $CURRENT)."
fi

echo "==> Starting API (uvicorn --reload) on :8000..."
.venv/Scripts/python.exe -m uvicorn apps.api.main:app --port 8000 --reload > api.out.log 2> api.err.log &
API_PID=$!
echo "    API PID: $API_PID (logs: api.out.log / api.err.log)"

echo "==> Starting web (next dev) on :3000..."
(cd apps/web && npm run dev > ../dev.out.log 2> ../dev.err.log &)

trap "echo '==> Stopping API (PID $API_PID)...'; kill $API_PID 2>/dev/null || true" EXIT

echo "==> Dev stack starting. API: http://localhost:8000  Web: http://localhost:3000"
echo "==> Press Ctrl+C to stop the API server (web dev server keeps its own lifecycle)."
wait $API_PID
