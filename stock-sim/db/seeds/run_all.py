"""Run all seed scripts in dependency order.

Each seed is run as a subprocess with PYTHONPATH set so that
'from db.models import …' etc. resolve without sys.path hacks.
"""

import argparse
import os
import subprocess
import sys

SEEDS = [
    "seed_config.py",
    "seed_industries.py",
    "seed_companies.py",
    "seed_financials.py",
    "seed_events.py",
    "seed_scenario_templates.py",
    "seed_demo.py",
    "seed_initial_prices.py",
    "seed_dividends.py",
]

SEED_TABLES = [
    "scenario_templates",
    "dividends",
    "price_history",
    "portfolio_holdings",
    "portfolio_transactions",
    "portfolio",
    "simulation_state",
    "economic_cycle_state",
    "company_factor_score",
    "financial_quality_subscore",
    "users",
    "timelines",
    "cash_flow_statements",
    "balance_sheets",
    "income_statements",
    "events",
    "companies",
    "industry_pillar_weights",
    "industries",
    "factor_definitions",
    "config_parameters",
]


def _reset(database_url: str) -> None:
    """Drop all seed data in reverse dependency order."""
    from sqlalchemy import create_engine, text
    engine = create_engine(database_url)
    with engine.connect() as conn:
        conn.execute(text("SET session_replication_role = 'replica';"))
        for table in SEED_TABLES:
            conn.execute(text(f"TRUNCATE TABLE {table} CASCADE;"))
        conn.execute(text("SET session_replication_role = 'origin';"))
        conn.commit()
    print("All seed tables truncated.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run all seed scripts in dependency order.")
    parser.add_argument("--reset", action="store_true", help="Truncate all seed tables before running")
    args = parser.parse_args()

    project_root = os.path.normpath(os.path.join(os.path.dirname(__file__), "../.."))
    db_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://stocksim:stocksim@localhost:5432/stocksim",
    )

    if args.reset:
        _reset(db_url)

    existing_pypath = os.environ.get("PYTHONPATH", "")
    env = {
        **os.environ,
        "DATABASE_URL": db_url,
        "PYTHONPATH": f"{project_root}{os.pathsep}{existing_pypath}" if existing_pypath else project_root,
    }

    seeds_dir = os.path.join(os.path.dirname(__file__))

    for seed_file in SEEDS:
        path = os.path.join(seeds_dir, seed_file)
        print(f"\n=== Running {seed_file} ===")
        result = subprocess.run([sys.executable, path], env=env)
        if result.returncode != 0:
            print(f"FAILED: {seed_file} (exit code {result.returncode})")
            sys.exit(1)
        print(f"=== {seed_file} done ===")

    print("\n✅ All seeds completed successfully.")


if __name__ == "__main__":
    main()
