"""Seed the 15 industries with pillar weights."""

import os
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from db.models import Industry, IndustryPillarWeight


INDUSTRIES = [
    ("Banking & Financial Services", "Banks, NBFCs, insurance, and other financial intermediaries", 12, 5, 20, 0.25, 0.8, 1.0, "financials"),
    ("Information Technology / Software", "Software, IT services, and technology platforms", 30, 10, 60, 0.40, 0.6, 1.1, "standard"),
    ("Pharmaceuticals & Healthcare", "Drug manufacturers, biotech, and healthcare services", 25, 8, 45, 0.30, 0.2, 0.8, "standard"),
    ("FMCG / Consumer Staples", "Fast-moving consumer goods with steady demand across cycles", 22, 10, 40, 0.18, 0.3, 0.6, "standard"),
    ("Automobiles & Auto Components", "Vehicle manufacturers and auto-part suppliers", 14, 5, 25, 0.30, 0.9, 1.2, "standard"),
    ("Energy (Oil & Gas)", "Upstream, midstream, and downstream oil and gas operations", 10, 4, 20, 0.32, 0.7, 1.3, "standard"),
    ("Utilities (Power/Gas/Water)", "Essential utility services with regulated returns", 15, 8, 25, 0.16, 0.2, 0.5, "standard"),
    ("Metals & Mining", "Extraction and processing of metals and minerals", 11, 4, 22, 0.35, 0.8, 1.4, "standard"),
    ("Construction & Infrastructure", "Engineering, construction, and infrastructure development", 13, 5, 24, 0.25, 0.9, 1.2, "standard"),
    ("Real Estate", "Property development, REITs, and real estate services", 16, 6, 30, 0.28, 0.8, 1.1, "standard"),
    ("Telecommunications", "Telecom operators, tower companies, and communication services", 14, 6, 28, 0.22, 0.4, 0.9, "standard"),
    ("Retail & E-commerce", "Brick-and-mortar retail and online commerce platforms", 24, 8, 50, 0.28, 0.6, 1.0, "standard"),
    ("Industrials & Capital Goods", "Industrial machinery, equipment, and capital goods manufacturing", 17, 7, 32, 0.24, 0.7, 1.1, "standard"),
    ("Chemicals", "Specialty and commodity chemical production", 16, 6, 30, 0.26, 0.6, 1.0, "standard"),
    ("Media & Entertainment", "Broadcasting, publishing, streaming, and entertainment content", 20, 7, 40, 0.32, 0.5, 0.9, "standard"),
]

PILLAR_WEIGHTS = [
    (1, "profitability", 0.25),
    (1, "efficiency", 0.10),
    (1, "leverage_solvency", 0.35),
    (1, "stability", 0.20),
    (1, "earnings_quality", 0.10),
    (2, "profitability", 0.35),
    (2, "efficiency", 0.15),
    (2, "leverage_solvency", 0.10),
    (2, "stability", 0.20),
    (2, "earnings_quality", 0.20),
    (3, "profitability", 0.30),
    (3, "efficiency", 0.10),
    (3, "leverage_solvency", 0.15),
    (3, "stability", 0.25),
    (3, "earnings_quality", 0.20),
    (4, "profitability", 0.25),
    (4, "efficiency", 0.20),
    (4, "leverage_solvency", 0.15),
    (4, "stability", 0.25),
    (4, "earnings_quality", 0.15),
    (5, "profitability", 0.20),
    (5, "efficiency", 0.25),
    (5, "leverage_solvency", 0.25),
    (5, "stability", 0.15),
    (5, "earnings_quality", 0.15),
    (6, "profitability", 0.20),
    (6, "efficiency", 0.15),
    (6, "leverage_solvency", 0.30),
    (6, "stability", 0.15),
    (6, "earnings_quality", 0.20),
    (7, "profitability", 0.20),
    (7, "efficiency", 0.10),
    (7, "leverage_solvency", 0.25),
    (7, "stability", 0.30),
    (7, "earnings_quality", 0.15),
    (8, "profitability", 0.20),
    (8, "efficiency", 0.20),
    (8, "leverage_solvency", 0.30),
    (8, "stability", 0.15),
    (8, "earnings_quality", 0.15),
    (9, "profitability", 0.15),
    (9, "efficiency", 0.25),
    (9, "leverage_solvency", 0.35),
    (9, "stability", 0.10),
    (9, "earnings_quality", 0.15),
    (10, "profitability", 0.15),
    (10, "efficiency", 0.15),
    (10, "leverage_solvency", 0.40),
    (10, "stability", 0.15),
    (10, "earnings_quality", 0.15),
    (11, "profitability", 0.20),
    (11, "efficiency", 0.15),
    (11, "leverage_solvency", 0.30),
    (11, "stability", 0.20),
    (11, "earnings_quality", 0.15),
    (12, "profitability", 0.20),
    (12, "efficiency", 0.30),
    (12, "leverage_solvency", 0.15),
    (12, "stability", 0.20),
    (12, "earnings_quality", 0.15),
    (13, "profitability", 0.25),
    (13, "efficiency", 0.25),
    (13, "leverage_solvency", 0.20),
    (13, "stability", 0.15),
    (13, "earnings_quality", 0.15),
    (14, "profitability", 0.25),
    (14, "efficiency", 0.20),
    (14, "leverage_solvency", 0.20),
    (14, "stability", 0.20),
    (14, "earnings_quality", 0.15),
    (15, "profitability", 0.25),
    (15, "efficiency", 0.15),
    (15, "leverage_solvency", 0.15),
    (15, "stability", 0.20),
    (15, "earnings_quality", 0.25),
]


def seed(session: Session) -> None:
    for i, ind in enumerate(INDUSTRIES, start=1):
        name, desc, bpe, pmin, pmax, bvol, csens, sbeta, sset = ind
        existing = session.get(Industry, i)
        if existing is None:
            session.add(Industry(
                id=i,
                name=name,
                description=desc,
                baseline_pe=bpe,
                pe_min=pmin,
                pe_max=pmax,
                base_volatility=bvol,
                cycle_sensitivity=csens,
                sector_beta_default=sbeta,
                subfactor_set=sset,
            ))

    for ind_id, pillar, weight in PILLAR_WEIGHTS:
        existing = session.query(IndustryPillarWeight).filter_by(
            industry_id=ind_id, pillar=pillar
        ).first()
        if existing is None:
            session.add(IndustryPillarWeight(
                industry_id=ind_id, pillar=pillar, weight=weight,
            ))


def main() -> None:
    database_url = os.environ.get("DATABASE_URL", "postgresql+psycopg://stocksim:stocksim@localhost:5432/stocksim")
    engine = create_engine(database_url)
    with Session(engine) as session:
        seed(session)
        session.commit()
    print("seed_industries.py done.")


if __name__ == "__main__":
    main()
