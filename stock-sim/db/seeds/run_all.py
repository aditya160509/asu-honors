"""Run all seed scripts in dependency order."""

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
]


def main() -> None:
    db_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://stocksim:stocksim@localhost:5432/stocksim",
    )
    env = {**os.environ, "DATABASE_URL": db_url}

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
