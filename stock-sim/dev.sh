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
# `set -e` does NOT apply to a command on the right-hand side of a variable
# assignment -- `CURRENT=$(cmd)` "succeeds" (from the shell's point of view)
# even if `cmd` itself fails, silently leaving CURRENT empty and letting the
# script barrel on with bad state instead of halting. Capture stderr and
# check the exit code explicitly instead of relying on `set -e` to catch it.
if ! CURRENT_OUTPUT=$(.venv/Scripts/alembic current 2>&1); then
  echo "!! 'alembic current' failed:"
  echo "$CURRENT_OUTPUT"
  exit 1
fi
CURRENT=$(echo "$CURRENT_OUTPUT" | tail -1 | awk '{print $1}')

if ! HEADS_OUTPUT=$(.venv/Scripts/alembic heads 2>&1); then
  echo "!! 'alembic heads' failed:"
  echo "$HEADS_OUTPUT"
  exit 1
fi
# A branched migration history (two unmerged heads) prints multiple lines --
# `tail -1` would silently pick one arbitrary head and compare against it,
# reporting "up to date" even when a merge migration is actually required.
HEAD_COUNT=$(echo "$HEADS_OUTPUT" | grep -c '^[0-9a-f]')
if [ "$HEAD_COUNT" -gt 1 ]; then
  echo "!! Multiple Alembic heads detected -- migration history has an unmerged branch:"
  echo "$HEADS_OUTPUT"
  echo "!! Run 'alembic merge heads' before starting the dev stack."
  exit 1
fi
HEAD=$(echo "$HEADS_OUTPUT" | tail -1 | awk '{print $1}')

if [ "$CURRENT" != "$HEAD" ]; then
  echo "!! Database is behind: current=$CURRENT head=$HEAD"
  echo "!! Running: alembic upgrade head"
  .venv/Scripts/alembic upgrade head
else
  echo "==> Database is up to date (revision $CURRENT)."
fi

echo "==> Checking Redis (Celery broker/backend for Future Lab async jobs)..."
if ! docker exec stocksim-redis redis-cli ping > /dev/null 2>&1; then
  echo "!! Redis not reachable via 'stocksim-redis' container -- starting it."
  # `docker start` fails (nonzero exit) if the container doesn't exist yet at
  # all (first run on a fresh machine) -- in that case, and ONLY in that
  # case, fall back to `docker run` to create it. Checking `docker ps -a`
  # first (rather than blindly running `start || run` every time) avoids a
  # `docker run --name stocksim-redis` erroring out with "name already in
  # use" if the container exists but `docker start` failed for some other
  # transient reason (e.g. Docker Desktop still warming up).
  if docker ps -a --format '{{.Names}}' | grep -qx stocksim-redis; then
    docker start stocksim-redis > /dev/null
  else
    docker run -d --name stocksim-redis -p 6379:6379 redis:7-alpine > /dev/null
  fi
  # A fixed `sleep 1` with no re-check either wastes a second when Redis was
  # already fast to start, or (worse) isn't long enough on a slower machine
  # and lets the Celery worker below launch against a broker that isn't
  # accepting connections yet. Poll with a real timeout instead.
  echo "==> Waiting for Redis to accept connections..."
  for _ in $(seq 1 30); do
    if docker exec stocksim-redis redis-cli ping > /dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
  if ! docker exec stocksim-redis redis-cli ping > /dev/null 2>&1; then
    echo "!! Redis did not become ready within 15s -- check 'docker logs stocksim-redis'."
    exit 1
  fi
fi
echo "==> Redis is up."

echo "==> Starting Celery worker (--pool=solo, Windows-compatible)..."
.venv/Scripts/python.exe -m celery -A apps.api.celery_app worker --pool=solo --loglevel=info > celery.out.log 2> celery.err.log &
CELERY_PID=$!
echo "    Celery worker PID: $CELERY_PID (logs: celery.out.log / celery.err.log)"

# apps.api.routers.simulation.create_timeline pings celery_app.control.ping
# before dispatching a branch's fast-forward job, and marks the branch
# 'failed' immediately if no worker responds within 1s (see that router's
# docstring for the incident this closed). A worker takes a moment to
# connect to the broker and start consuming after the process launches --
# without waiting here, the very first branch created right after `./dev.sh`
# starts could lose its fast-forward job to that same race the ping was
# built to catch, on every single fresh dev-stack startup.
echo "==> Waiting for Celery worker to come online..."
CELERY_READY=0
for _ in $(seq 1 30); do
  if .venv/Scripts/python.exe -c "
from apps.api.celery_app import celery_app
import sys
sys.exit(0 if celery_app.control.ping(timeout=1.0) else 1)
" > /dev/null 2>&1; then
    CELERY_READY=1
    break
  fi
  sleep 0.5
done
if [ "$CELERY_READY" -eq 1 ]; then
  echo "==> Celery worker is online."
else
  echo "!! Celery worker did not respond to a liveness ping within 15s -- check celery.err.log."
  echo "!! Continuing anyway: branches created before it comes up will be marked status=failed, not lost silently."
fi

echo "==> Starting API (uvicorn --reload) on :8000..."
.venv/Scripts/python.exe -m uvicorn apps.api.main:app --port 8000 --reload > api.out.log 2> api.err.log &
API_PID=$!
echo "    API PID: $API_PID (logs: api.out.log / api.err.log)"

echo "==> Starting web (next dev) on :3000..."
(cd apps/web && npm run dev > ../dev.out.log 2> ../dev.err.log &)

trap "echo '==> Stopping API (PID $API_PID) and Celery worker (PID $CELERY_PID)...'; kill $API_PID $CELERY_PID 2>/dev/null || true" EXIT

echo "==> Dev stack starting. API: http://localhost:8000  Web: http://localhost:3000"
echo "==> Press Ctrl+C to stop the API server + Celery worker (web dev server and Redis keep their own lifecycle)."
wait $API_PID
