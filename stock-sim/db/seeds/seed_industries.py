"""Seed the 15 industries with pillar weights."""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

# Path setup handled by run_all.py entry point

from db.models import ConfigParameter, Industry, IndustryFactorWeight, IndustryPillarWeight

# Section 6.D (PEG-based, revised 2026-07-10) — Neutral Industry PEG: the
# long-term fair PEG a normal (Financial Quality Score ~= 60) business
# deserves in this industry. NOT a market-observed average; a configurable
# starting point meant to be calibrated against historical market data later.
# Keyed by industry name so it stays correct regardless of INDUSTRIES order.
NEUTRAL_INDUSTRY_PEGS = {
    "Banking & Financial Services": 0.90,
    "Information Technology / Software": 1.40,
    "Pharmaceuticals & Healthcare": 1.50,
    "FMCG / Consumer Staples": 1.60,
    "Automobiles & Auto Components": 1.00,
    "Energy (Oil & Gas)": 0.70,
    "Utilities (Power/Gas/Water)": 0.80,
    "Metals & Mining": 0.60,
    "Construction & Infrastructure": 0.90,
    "Real Estate": 0.80,
    "Telecommunications": 1.00,
    "Retail & E-commerce": 1.40,
    "Industrials & Capital Goods": 1.10,
    "Chemicals": 1.20,
    "Media & Entertainment": 1.20,
}


INDUSTRIES = [
    ("Banking & Financial Services", "Banks, NBFCs, insurance, and other financial intermediaries", 0.25, 0.8, 1.0, "financials"),
    ("Information Technology / Software", "Software, IT services, and technology platforms", 0.40, 0.6, 1.1, "standard"),
    ("Pharmaceuticals & Healthcare", "Drug manufacturers, biotech, and healthcare services", 0.30, 0.2, 0.8, "standard"),
    ("FMCG / Consumer Staples", "Fast-moving consumer goods with steady demand across cycles", 0.18, 0.3, 0.6, "standard"),
    ("Automobiles & Auto Components", "Vehicle manufacturers and auto-part suppliers", 0.30, 0.9, 1.2, "standard"),
    ("Energy (Oil & Gas)", "Upstream, midstream, and downstream oil and gas operations", 0.32, 0.7, 1.3, "standard"),
    ("Utilities (Power/Gas/Water)", "Essential utility services with regulated returns", 0.16, 0.2, 0.5, "standard"),
    ("Metals & Mining", "Extraction and processing of metals and minerals", 0.35, 0.8, 1.4, "standard"),
    ("Construction & Infrastructure", "Engineering, construction, and infrastructure development", 0.25, 0.9, 1.2, "standard"),
    ("Real Estate", "Property development, REITs, and real estate services", 0.28, 0.8, 1.1, "standard"),
    ("Telecommunications", "Telecom operators, tower companies, and communication services", 0.22, 0.4, 0.9, "standard"),
    ("Retail & E-commerce", "Brick-and-mortar retail and online commerce platforms", 0.28, 0.6, 1.0, "standard"),
    ("Industrials & Capital Goods", "Industrial machinery, equipment, and capital goods manufacturing", 0.24, 0.7, 1.1, "standard"),
    ("Chemicals", "Specialty and commodity chemical production", 0.26, 0.6, 1.0, "standard"),
    ("Media & Entertainment", "Broadcasting, publishing, streaming, and entertainment content", 0.32, 0.5, 0.9, "standard"),
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

# Industry-specific top-level factor weight overrides.
# Industry → (management_quality, moat_score, financial_quality, fcf_quality, growth_potential)
# Each tuple sums to 1.0. Falls back to global defaults when NULL in the DB.
INDUSTRY_FACTOR_WEIGHTS: dict[int, tuple[float, float, float, float, float]] = {
    1:  (0.30, 0.15, 0.30, 0.10, 0.15),   # Banking: management + FQ weighted
    2:  (0.20, 0.25, 0.10, 0.10, 0.35),   # IT: growth + moat heavy
    3:  (0.20, 0.30, 0.20, 0.05, 0.25),   # Pharma: moat (patents) + growth
    4:  (0.20, 0.30, 0.20, 0.15, 0.15),   # FMCG: moat (brand) + FCF
    5:  (0.25, 0.15, 0.30, 0.10, 0.20),   # Auto: FQ (capital intensive)
    6:  (0.20, 0.25, 0.30, 0.10, 0.15),   # Energy: moat (resources) + FQ
    7:  (0.20, 0.20, 0.35, 0.15, 0.10),   # Utilities: FQ + low growth
    8:  (0.20, 0.20, 0.30, 0.10, 0.20),   # Metals: FQ (capex heavy)
    9:  (0.25, 0.15, 0.30, 0.10, 0.20),   # Construction: management + FQ
    10: (0.20, 0.20, 0.25, 0.20, 0.15),   # Real Estate: FQ + FCF (REIT structure)
    11: (0.25, 0.20, 0.30, 0.10, 0.15),   # Telecom: FQ + management
    12: (0.20, 0.25, 0.15, 0.15, 0.25),   # Retail: growth + moat (brand)
    13: (0.25, 0.20, 0.25, 0.10, 0.20),   # Industrials: balanced
    14: (0.20, 0.25, 0.25, 0.10, 0.20),   # Chemicals: moat (IP) + FQ
    15: (0.20, 0.25, 0.15, 0.10, 0.30),   # Media: growth + moat (content)
}

FACTOR_KEYS = [
    "management_quality",
    "moat_score",
    "financial_quality",
    "fcf_quality",
    "growth_potential",
]


def validate_pillar_weights() -> None:
    """Verify each industry's pillar weights sum to 1.0."""
    sums: dict[int, float] = {}
    for ind_id, pillar, weight in PILLAR_WEIGHTS:
        sums[ind_id] = sums.get(ind_id, 0.0) + weight
    for ind_id, total in sums.items():
        if abs(total - 1.0) > 1e-9:
            raise ValueError(
                f"Industry {ind_id} pillar weights sum to {total}, expected 1.0"
            )

    for ind_id, weights in INDUSTRY_FACTOR_WEIGHTS.items():
        total = sum(weights)
        if abs(total - 1.0) > 1e-9:
            raise ValueError(
                f"Industry {ind_id} factor weights sum to {total}, expected 1.0"
            )


validate_pillar_weights()


def seed(session: Session) -> None:
    for i, ind in enumerate(INDUSTRIES, start=1):
        name, desc, bvol, csens, sbeta, sset = ind
        existing = session.get(Industry, i)
        if existing is None:
            session.add(Industry(
                id=i,
                name=name,
                description=desc,
                base_volatility=bvol,
                cycle_sensitivity=csens,
                sector_beta_default=sbeta,
                subfactor_set=sset,
            ))

        peg = NEUTRAL_INDUSTRY_PEGS.get(name)
        if peg is not None:
            existing_peg = session.query(ConfigParameter).filter_by(
                key="neutral_industry_peg", scope="industry", scope_id=i,
            ).first()
            if existing_peg is None:
                session.add(ConfigParameter(
                    key="neutral_industry_peg", value=str(peg),
                    scope="industry", scope_id=i,
                    description=f"Neutral Industry PEG for {name} (Section 6.D)",
                ))

    for ind_id, pillar, weight in PILLAR_WEIGHTS:
        existing = session.query(IndustryPillarWeight).filter_by(
            industry_id=ind_id, pillar=pillar
        ).first()
        if existing is None:
            session.add(IndustryPillarWeight(
                industry_id=ind_id, pillar=pillar, weight=weight,
            ))

    for ind_id, weights in INDUSTRY_FACTOR_WEIGHTS.items():
        for factor_key, weight in zip(FACTOR_KEYS, weights):
            existing = session.query(IndustryFactorWeight).filter_by(
                industry_id=ind_id, factor_key=factor_key
            ).first()
            if existing is None:
                session.add(IndustryFactorWeight(
                    industry_id=ind_id, factor_key=factor_key, weight=weight,
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
