"""One-off data repair for the 1e6 EPS inflation bug (engine/orchestrator.py:2015).

Engine-generated income statements stored eps = net_profit * 1_000_000 / shares,
inflating EPS (and intrinsic_value = fair_pe * eps) by 1e6. The correct convention
-- matching the seeded rows and market_cap = price * shares -- is:

    eps = net_profit / shares_diluted   (both absolute units)

This script rewrites every income_statements.eps to that invariant (idempotent:
already-correct rows are unchanged), scales consensus_estimates.consensus_eps by
the same per-row ratio so earnings-surprise ratios are preserved, and then rebuilds
the fair_pe / intrinsic_value caches via scripts/recompute_valuations.py.

Usage:
    python scripts/repair_eps_inflation.py --dry-run   # preview only
    python scripts/repair_eps_inflation.py --apply     # mutate + backup
"""

import argparse
import csv
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from db.models import IncomeStatement, ConsensusEstimate, Company

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///stocksim.db")
INFLATION_THRESHOLD = 100.0  # a row is "inflated" if stored eps is >100x the invariant


def _invariant_eps(net_profit: float, shares_diluted: float) -> float:
    return net_profit / shares_diluted if shares_diluted else 0.0


def main() -> None:
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--dry-run", action="store_true")
    g.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    engine = create_engine(DATABASE_URL)
    with Session(engine) as session:
        incomes = session.query(IncomeStatement).all()
        inflated = []
        for inc in incomes:
            correct = _invariant_eps(float(inc.net_profit), float(inc.shares_diluted))
            stored = float(inc.eps) if inc.eps is not None else 0.0
            if correct != 0.0 and abs(stored) > abs(correct) * INFLATION_THRESHOLD:
                inflated.append((inc, stored, round(correct, 4)))

        print(f"income_statements total: {len(incomes)}")
        print(f"income_statements inflated (>{INFLATION_THRESHOLD}x invariant): {len(inflated)}")
        print()
        print("sample (company_id, timeline_id, period, stored_eps -> corrected_eps):")
        for inc, stored, correct in inflated[:10]:
            print(f"  c{inc.company_id} t{inc.timeline_id} {inc.fiscal_period}: {stored:,.2f} -> {correct}")

        if args.dry_run:
            print("\n[dry-run] no changes written.")
            return

        # --- backup before mutating ---
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = os.path.join(os.path.dirname(__file__), "..", "db", "backups")
        os.makedirs(backup_dir, exist_ok=True)
        backup_path = os.path.join(backup_dir, f"eps_backup_{stamp}.csv")
        with open(backup_path, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["table", "row_id", "column", "old_value"])
            for inc in incomes:
                w.writerow(["income_statements", inc.id, "eps", inc.eps])
            for c in session.query(Company).all():
                w.writerow(["companies", c.id, "intrinsic_value", c.intrinsic_value])
                w.writerow(["companies", c.id, "fair_pe", c.fair_pe])
        print(f"\nbackup written: {backup_path}")

        # --- 1. rewrite every income eps to the invariant (idempotent) ---
        # ratio per row lets us scale the matching consensus_eps the same way.
        ratio_by_key: dict[tuple[int, int, str], float] = {}
        changed = 0
        for inc in incomes:
            old = float(inc.eps) if inc.eps is not None else 0.0
            correct = round(_invariant_eps(float(inc.net_profit), float(inc.shares_diluted)), 4)
            ratio_by_key[(inc.company_id, inc.timeline_id, inc.fiscal_period)] = (
                correct / old if old else 1.0
            )
            if inc.eps is None or abs(float(inc.eps) - correct) > 1e-9:
                inc.eps = correct
                changed += 1

        # --- 2. scale consensus_eps by the same ratio (preserve surprise ratio) ---
        cons_changed = 0
        for ce in session.query(ConsensusEstimate).all():
            r = ratio_by_key.get((ce.company_id, ce.timeline_id, ce.fiscal_period))
            if r is not None and r != 1.0 and ce.consensus_eps is not None:
                ce.consensus_eps = round(float(ce.consensus_eps) * r, 4)
                cons_changed += 1

        session.commit()
        print(f"income_statements eps updated: {changed}")
        print(f"consensus_estimates consensus_eps scaled: {cons_changed}")

    # --- 3. rebuild fair_pe / intrinsic_value caches from corrected eps ---
    from scripts.recompute_valuations import main as recompute_main
    print("\nrebuilding fair_pe / intrinsic_value caches...")
    recompute_main()
    print("done.")


if __name__ == "__main__":
    main()
