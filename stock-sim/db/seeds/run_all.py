"""Run all seed scripts in dependency order.

Each seed is run as a subprocess with PYTHONPATH set so that
'from db.models import …' etc. resolve without sys.path hacks.
"""

import os
import subprocess
import sys

SEEDS = [
    "seed_config.py",
    "seed_industries.py",
    "seed_companies.py",
    "seed_financials.py",
    "seed_events.py",
    "seed_demo.py",
    "seed_initial_prices.py",
    "seed_dividends.py",
]


def main() -> None:
    project_root = os.path.normpath(os.path.join(os.path.dirname(__file__), "../.."))
    db_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://stocksim:stocksim@localhost:5432/stocksim",
    )
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
