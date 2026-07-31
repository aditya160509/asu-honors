# Future Lab deployment

The production topology intentionally uses only three resources:

- Vercel: Next.js frontend
- Render: one FastAPI web service, including the bounded in-process simulation executor
- Render: one managed PostgreSQL database, which is also the durable job/status store

Celery, Redis, and a separate worker service are not used. Keep the Render API at one
process (`--workers 1`); simulations run on its bounded background thread pool while
status and results are persisted in PostgreSQL.

## Render

Create a Blueprint from the repository root. `stock-sim/render.yaml` provisions the
database and API, runs migrations and idempotent seeds, and starts the API. Set:

- `FRONTEND_BASE_URL=https://<your-vercel-project>.vercel.app`
- `BACKGROUND_WORKER_THREADS=1` (increase only after measuring CPU and memory)
- optional `OPENROUTER_API_KEY` and `RESEND_API_KEY` for their respective real services

The API health check is `/health`.

## Vercel

Deploy from the repository root using `vercel.json`. Set either:

- `NEXT_PUBLIC_API_URL=https://<your-render-service>.onrender.com/api/v1`, or
- `API_PROXY_TARGET=https://<your-render-service>.onrender.com` to proxy `/api/*`

The direct API URL is simpler. Redeploy the frontend after changing a
`NEXT_PUBLIC_*` value because it is embedded in the browser bundle.

## Required launch checks

1. Render `/health` responds successfully.
2. Sign in through the Vercel site and create a 1-day custom scenario.
3. Confirm queued -> running -> ready progress without refreshing.
4. Open every result tab and export JSON, CSV, and PDF.
5. Run a sensitivity sweep and a Monte Carlo ensemble and verify all child timelines
   finish before treating the deployment as production-ready.
