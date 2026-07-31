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
    "seed_demo.py",
    "seed_companies.py",
    "seed_financials.py",
    "seed_concalls.py",
    "seed_events.py",
    "seed_scenario_templates.py",
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


def _psycopg3_url(database_url: str) -> str:
    """Select psycopg 3 for provider-supplied PostgreSQL connection URLs."""
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+psycopg://", 1)
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return database_url


def _reset(database_url: str) -> None:
    """Clear every application table while preserving Alembic schema state."""
    from sqlalchemy import create_engine, inspect, text
    engine = create_engine(database_url)
    tables = [name for name in inspect(engine).get_table_names() if name != "alembic_version"]
    with engine.begin() as conn:
        if tables:
            quoted = ", ".join(f'"{name}"' for name in tables)
            conn.execute(text(f"TRUNCATE TABLE {quoted} RESTART IDENTITY CASCADE"))
    print("All seed tables truncated.")


def _sync_postgres_sequences(database_url: str) -> None:
    """Move every PostgreSQL identity/serial sequence past seeded primary keys.

    Several seeders intentionally use stable IDs (the live timeline is always
    ID 1). ``TRUNCATE ... RESTART IDENTITY`` resets the backing sequence, but
    inserting an explicit ID does not advance it. The next user-created row
    would therefore collide with the seed row. Synchronising after the whole
    seed pipeline makes reset databases safe for immediate writes.
    """
    from sqlalchemy import create_engine, inspect, text

    engine = create_engine(database_url)
    if engine.dialect.name != "postgresql":
        return
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table in inspector.get_table_names():
            pk_columns = inspector.get_pk_constraint(table).get("constrained_columns") or []
            if len(pk_columns) != 1:
                continue
            column = pk_columns[0]
            sequence = conn.execute(
                text("SELECT pg_get_serial_sequence(:table_name, :column_name)"),
                {"table_name": table, "column_name": column},
            ).scalar()
            if not sequence:
                continue
            maximum = conn.execute(text(f'SELECT MAX("{column}") FROM "{table}"')).scalar()
            if maximum is None:
                conn.execute(text("SELECT setval(CAST(:sequence AS regclass), 1, false)"), {"sequence": sequence})
            else:
                conn.execute(text("SELECT setval(CAST(:sequence AS regclass), :maximum, true)"), {"sequence": sequence, "maximum": maximum})
    print("PostgreSQL sequences synchronized with seeded rows.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run all seed scripts in dependency order.")
    parser.add_argument("--reset", action="store_true", help="Truncate all seed tables before running")
    args = parser.parse_args()

    project_root = os.path.normpath(os.path.join(os.path.dirname(__file__), "../.."))
    db_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://stocksim:stocksim@localhost:5432/stocksim",
    )
    db_url = _psycopg3_url(db_url)

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

    _sync_postgres_sequences(db_url)

    print("\n✅ All seeds completed successfully.")


if __name__ == "__main__":
    main()
