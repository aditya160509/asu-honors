# Stock-Sim Overview

> Fictional stock market simulation engine — factor-model driven with 150 companies across 15 industries.

---

## Architecture

```
apps/api/        → FastAPI backend (future Phase 5)
apps/web/        → Next.js frontend (future Phase 6)
db/
  models/        → SQLAlchemy 2.0 ORM (28 tables)
  migrations/    → Alembic schema evolution
  seeds/         → Idempotent seed data scripts
engine/          → Simulation engine (Python/NumPy)
tests/           → Pytest suite (88 tests)
docs/            → Documentation
```

## Current status

| Area | Status |
|------|--------|
| DB Schema | ✅ 28 tables + leaderboard MV, migration executed |
| Seed Data | ✅ 150 companies, 25 events, 3 demo users, industry factor weights |
| Simulation Engine | 🟡 Formulas done, DB wiring pending |
| APIs | ⬜ Not started |
| Frontend | ⬜ Not started |

## Quick start

```bash
# Setup (one time)
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
docker run -d --name stocksim-pg -p 5432:5432 \
  -e POSTGRES_DB=stocksim -e POSTGRES_USER=stocksim -e POSTGRES_PASSWORD=stocksim postgres:16
export DATABASE_URL="postgresql+psycopg://stocksim:stocksim@localhost:5432/stocksim"
alembic upgrade head

# Run tests
pytest tests/ -v

# Seed data
python db/seeds/run_all.py
```

See [SETUP.md](../SETUP.md) for full instructions.

## Key docs

| File | Content |
|------|---------|
| [`done.md`](../done.md) | Build progress tracker |
| [`project.md`](../project.md) | Full PRD & spec |
| [`review.md`](../review.md) | Code review findings |
| [`phase3-audit.md`](phase3-audit.md) | Phase 3 audit report |
| [`PHASE3.md`](../db/PHASE3.md) | Phase 3 detailed checklist |
