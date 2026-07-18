"""Setup SQLite database: patch JSONB, create tables, run all seeds."""
import os
import sys

os.environ["DATABASE_URL"] = "sqlite:///stocksim.db"

from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler
SQLiteTypeCompiler.visit_JSONB = SQLiteTypeCompiler.visit_JSON

from db.models import Base
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

engine = create_engine("sqlite:///stocksim.db", connect_args={"check_same_thread": False})
Base.metadata.create_all(engine)
print("Tables created.")

project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

def run_seed(name):
    print(f"--- {name} ---")
    mod = __import__(f"db.seeds.{name}", fromlist=["seed"])
    with Session(engine) as session:
        mod.seed(session)
        session.commit()
    print(f"OK: {name}")

for s in ["seed_config", "seed_industries", "seed_companies", "seed_financials",
          "seed_events", "seed_demo", "seed_initial_prices", "seed_dividends"]:
    run_seed(s)

print("\nDatabase setup complete.")
