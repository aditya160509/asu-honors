# Developer Setup Guide

> For all 4 developers. Follow these steps once to get a working local environment.

---

## Prerequisites

| Tool | Version | Check with |
|------|---------|------------|
| Python | ≥ 3.11 | `python3 --version` |
| pip | (bundled) | `python3 -m pip --version` |
| Docker | latest | `docker --version` |
| Git | any | `git --version` |

---

## Step 1 — Clone & enter the repo

```bash
git clone <repo-url> asu-honors
cd asu-honors/stock-sim
```

---

## Step 2 — Python virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate      # macOS/Linux
# .venv\Scripts\activate       # Windows

pip install --upgrade pip
pip install -e ".[dev]"
```

Verify: `python3 -m pytest tests/ -v` should show **88 passed**.

---

## Step 3 — Start Postgres (Docker)

```bash
docker run -d \
  --name stocksim-pg \
  -p 5432:5432 \
  -e POSTGRES_DB=stocksim \
  -e POSTGRES_USER=stocksim \
  -e POSTGRES_PASSWORD=stocksim \
  postgres:16
```

Check it's running: `docker ps | grep stocksim-pg`

---

## Step 4 — Set connection env var

```bash
export DATABASE_URL="postgresql+psycopg://stocksim:stocksim@localhost:5432/stocksim"
```

**Persist it** (add to your shell profile — `.zshrc`, `.bashrc`, or `.env` file):

```bash
echo 'export DATABASE_URL="postgresql+psycopg://stocksim:stocksim@localhost:5432/stocksim"' >> ~/.zshrc
```

---

## Step 5 — Run the migration

```bash
alembic upgrade head
```

Expected output — creates all 28 tables. Verify:

```bash
docker exec -it stocksim-pg psql -U stocksim -d stocksim -c "\dt"
```
You should see 28 tables listed.

---

## Daily workflow

```bash
source .venv/bin/activate            # enter venv
git pull                             # get latest code
alembic upgrade head                 # apply any new migrations
python3 -m pytest tests/ -v          # run tests
```

---

## What's next — Phase 3 seed scripts

Once everyone has Postgres running, the next work is **writing seed data** in order:

| # | Script | What it does |
|---|--------|-------------|
| 1 | `db/seeds/seed_config.py` | Insert config_parameters, factor_definitions, industry_pillar_weights |
| 2 | `db/seeds/seed_industries.py` | Insert 15 industries (banking, IT, pharma, etc.) with baseline PEs, volatility |
| 3 | `db/seeds/seed_companies.py` | Insert 150 companies with tickers, shares, betas, moat subscores |
| 4 | `db/seeds/seed_financials.py` | Insert placeholder income/balance/cashflow statements |
| 5 | `db/seeds/seed_events.py` | Insert 150+ market event types + news templates |
| 6 | Wire engine → DB | Run engine once to compute FQ, FairPE, IV, first price row |
| 7 | `db/seeds/seed_demo.py` | Insert demo users, portfolios, sample transactions |

Each seed script is **idempotent** — running it twice produces the same result.

---

## Useful Docker commands

```bash
docker start stocksim-pg        # start Postgres after reboot
docker stop stocksim-pg         # stop it
docker rm stocksim-pg           # delete the container (data is wiped)
docker exec -it stocksim-pg psql -U stocksim -d stocksim  # open SQL shell
```
