"""Seed 150 companies with moat subscores and seed factor scores."""

import os
import random
import sys
from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from db.models import Company, CompanyFactorScore, MoatSubscore


COMPANIES = [
    # Industry 1 – Banking & Financial Services
    (1, "First National Bank", "FNB", 500_000_000, 0.65, 1.1, 1.0),
    (1, "Metro Credit Corp", "MCC", 200_000_000, 0.55, 1.2, 0.9),
    (1, "Pacific Financial Group", "PFG", 350_000_000, 0.60, 0.9, 1.1),
    (1, "Atlas Investment Bank", "AIB", 150_000_000, 0.50, 1.3, 1.2),
    (1, "Commonwealth Trust", "CMT", 400_000_000, 0.70, 1.0, 0.8),
    (1, "Summit Insurance Group", "SIG", 180_000_000, 0.55, 0.8, 0.9),
    (1, "Sterling Financial Services", "SFS", 120_000_000, 0.45, 1.1, 1.0),
    (1, "Harbor Asset Management", "HAM", 90_000_000, 0.40, 1.0, 0.7),
    (1, "Pinnacle Bancorp", "PNB", 280_000_000, 0.60, 0.9, 1.0),
    (1, "Crestline Financial", "CRF", 75_000_000, 0.35, 1.2, 1.1),
    # Industry 2 – Information Technology / Software
    (2, "NovaByte Software", "NBS", 800_000_000, 0.80, 1.3, 1.2),
    (2, "Quantum Dynamics", "QDM", 600_000_000, 0.75, 1.4, 1.3),
    (2, "Apex Digital Solutions", "ADS", 400_000_000, 0.70, 1.2, 1.1),
    (2, "CoreVault Systems", "CVS", 250_000_000, 0.65, 1.1, 1.0),
    (2, "WebForge Technologies", "WFT", 180_000_000, 0.60, 1.5, 1.3),
    (2, "DataStream Inc", "DSI", 350_000_000, 0.70, 1.2, 1.1),
    (2, "CloudPeak Software", "CPS", 220_000_000, 0.65, 1.4, 1.2),
    (2, "IronClad Cybersecurity", "ICS", 150_000_000, 0.55, 1.3, 1.0),
    (2, "GreenField Analytics", "GFA", 100_000_000, 0.50, 1.6, 1.4),
    (2, "Pivot AI Corp", "PAI", 300_000_000, 0.70, 1.5, 1.3),
    # Industry 3 – Pharmaceuticals & Healthcare
    (3, "Apex Pharmaceuticals", "APX", 450_000_000, 0.70, 0.7, 0.9),
    (3, "BioVita Labs", "BVL", 300_000_000, 0.65, 0.6, 0.8),
    (3, "MedCore Health", "MCH", 500_000_000, 0.75, 0.8, 0.9),
    (3, "Nexus Therapeutics", "NXT", 180_000_000, 0.55, 0.9, 1.0),
    (3, "Pulse Medical Devices", "PMD", 250_000_000, 0.60, 0.7, 0.8),
    (3, "Vertex BioSolutions", "VBS", 120_000_000, 0.50, 1.0, 1.1),
    (3, "Crestview Hospitals", "CVH", 350_000_000, 0.65, 0.5, 0.7),
    (3, "GenHeal Pharma", "GHP", 200_000_000, 0.55, 0.8, 0.9),
    (3, "PureCare Diagnostics", "PCD", 80_000_000, 0.40, 0.9, 1.0),
    (3, "OmniSurgical Inc", "OSI", 150_000_000, 0.50, 0.6, 0.8),
    # Industry 4 – FMCG / Consumer Staples
    (4, "Everyday Essentials Corp", "EEC", 900_000_000, 0.80, 0.5, 0.6),
    (4, "PureHome Products", "PHP", 600_000_000, 0.75, 0.6, 0.7),
    (4, "Sunrise Foods Ltd", "SFL", 400_000_000, 0.70, 0.5, 0.6),
    (4, "Coastal Beverages Inc", "CBI", 350_000_000, 0.65, 0.4, 0.5),
    (4, "EverFresh Consumer Goods", "EFC", 280_000_000, 0.60, 0.6, 0.7),
    (4, "HomeGuard Hygiene", "HGH", 200_000_000, 0.55, 0.5, 0.6),
    (4, "TasteBuds Food Co", "TBF", 150_000_000, 0.50, 0.7, 0.8),
    (4, "Nature's Best Organics", "NBO", 100_000_000, 0.45, 0.6, 0.7),
    (4, "QuickFix Household", "QFH", 180_000_000, 0.55, 0.5, 0.6),
    (4, "DailyBrew Coffee", "DBC", 120_000_000, 0.50, 0.7, 0.8),
    # Industry 5 – Automobiles & Auto Components
    (5, "Velocity Motors", "VLM", 400_000_000, 0.70, 1.2, 1.3),
    (5, "Apex Auto Parts", "AAP", 250_000_000, 0.60, 1.1, 1.2),
    (5, "Titan Engineering Ltd", "TEL", 300_000_000, 0.65, 1.3, 1.4),
    (5, "Cruise Control Systems", "CCS", 120_000_000, 0.50, 1.4, 1.3),
    (5, "EVolution Electric", "EVE", 180_000_000, 0.55, 1.6, 1.5),
    (5, "Metro Wagon Corp", "MWC", 220_000_000, 0.60, 1.1, 1.2),
    (5, "Powertrain Industries", "PTI", 350_000_000, 0.65, 1.2, 1.3),
    (5, "AutoNexa Technologies", "ANT", 90_000_000, 0.40, 1.5, 1.4),
    (5, "SteerSafe Components", "SSC", 150_000_000, 0.55, 1.0, 1.1),
    (5, "FleetPro Logistics", "FPL", 200_000_000, 0.60, 1.3, 1.2),
    # Industry 6 – Energy (Oil & Gas)
    (6, "PetroPeak Energy", "PPE", 700_000_000, 0.75, 1.3, 1.4),
    (6, "CrestOil Exploration", "COE", 400_000_000, 0.65, 1.4, 1.5),
    (6, "NorthStar Natural Gas", "NNG", 500_000_000, 0.70, 1.2, 1.3),
    (6, "DeepDrill Resources", "DDR", 250_000_000, 0.55, 1.5, 1.6),
    (6, "Greenfield Renewables", "GFR", 180_000_000, 0.50, 0.8, 0.7),
    (6, "Sierra Refining Corp", "SRC", 300_000_000, 0.60, 1.3, 1.4),
    (6, "Pipeline Partners LP", "PPL", 450_000_000, 0.70, 1.0, 1.1),
    (6, "Terra Energy Group", "TEG", 150_000_000, 0.45, 1.4, 1.5),
    (6, "Coastal LNG Ltd", "CLL", 200_000_000, 0.55, 1.1, 1.2),
    (6, "BluePeak Solar", "BPS", 100_000_000, 0.40, 0.9, 0.8),
    # Industry 7 – Utilities (Power/Gas/Water)
    (7, "PolarGrid Electric", "PGE", 600_000_000, 0.75, 0.4, 0.5),
    (7, "RiverRun Water Co", "RWC", 350_000_000, 0.70, 0.3, 0.4),
    (7, "MetroGas Distribution", "MGD", 400_000_000, 0.65, 0.5, 0.6),
    (7, "Sunbelt Power Authority", "SPA", 500_000_000, 0.75, 0.4, 0.5),
    (7, "ClearStream Utilities", "CSU", 250_000_000, 0.60, 0.5, 0.6),
    (7, "Windward Energy Co", "WEC", 180_000_000, 0.55, 0.6, 0.5),
    (7, "PeakGrid Transmission", "PGT", 300_000_000, 0.65, 0.4, 0.5),
    (7, "AquaPure Holdings", "APH", 150_000_000, 0.50, 0.3, 0.4),
    (7, "Unity Power Corp", "UPC", 220_000_000, 0.60, 0.5, 0.6),
    (7, "EcoTherm Energy", "ETE", 120_000_000, 0.45, 0.6, 0.7),
    # Industry 8 – Metals & Mining
    (8, "IronPeak Mining", "IPM", 350_000_000, 0.65, 1.4, 1.5),
    (8, "Copper Ridge Ltd", "CRL", 250_000_000, 0.60, 1.3, 1.4),
    (8, "NorthWest Minerals", "NWM", 400_000_000, 0.70, 1.5, 1.6),
    (8, "SteelCraft Industries", "SCI", 300_000_000, 0.65, 1.2, 1.3),
    (8, "GoldStar Resources", "GSR", 200_000_000, 0.55, 1.6, 1.7),
    (8, "Alpine Lithium Corp", "ALC", 120_000_000, 0.45, 1.7, 1.6),
    (8, "Titanium Extraction Co", "TEC", 180_000_000, 0.50, 1.5, 1.4),
    (8, "Fusion Metals Group", "FMG", 220_000_000, 0.60, 1.3, 1.4),
    (8, "RareEarth Dynamics", "RED", 90_000_000, 0.35, 1.8, 1.7),
    (8, "BeltLine Mining", "BLM", 150_000_000, 0.50, 1.4, 1.5),
    # Industry 9 – Construction & Infrastructure
    (9, "BuildRight Construction", "BRC", 250_000_000, 0.60, 1.2, 1.3),
    (9, "Highway Infrastructure Corp", "HIC", 350_000_000, 0.65, 1.1, 1.2),
    (9, "Skyline Developers", "SLD", 200_000_000, 0.55, 1.3, 1.4),
    (9, "RockSolid Foundations", "RSF", 150_000_000, 0.50, 1.0, 1.1),
    (9, "MetroRail Engineering", "MRE", 180_000_000, 0.55, 1.2, 1.3),
    (9, "GreenScape Urban", "GSU", 100_000_000, 0.45, 1.1, 1.2),
    (9, "Tidewater Dredging Co", "TDC", 80_000_000, 0.40, 1.4, 1.5),
    (9, "Summit Bridge Partners", "SBP", 120_000_000, 0.50, 1.2, 1.3),
    (9, "CoreBuild Materials", "CBM", 280_000_000, 0.65, 1.0, 1.1),
    (9, "Forward Infrastructure", "FWI", 160_000_000, 0.55, 1.3, 1.4),
    # Industry 10 – Real Estate
    (10, "Prime Office REIT", "POR", 300_000_000, 0.70, 1.0, 1.1),
    (10, "HarborView Properties", "HVP", 200_000_000, 0.60, 1.1, 1.2),
    (10, "UrbanSpace REIT", "USR", 400_000_000, 0.75, 0.9, 1.0),
    (10, "GreenLeaf Residential", "GLR", 250_000_000, 0.65, 0.8, 0.9),
    (10, "Commercial Core Trust", "CCT", 180_000_000, 0.55, 1.1, 1.2),
    (10, "Skyline Hospitality", "SLH", 120_000_000, 0.50, 1.2, 1.3),
    (10, "RetailPlex Properties", "RPP", 150_000_000, 0.55, 0.9, 1.0),
    (10, "Industrial Space Corp", "ISC", 220_000_000, 0.60, 1.0, 1.1),
    (10, "Lakeview Estates REIT", "LER", 100_000_000, 0.45, 0.8, 0.9),
    (10, "Capital District REIT", "CDR", 280_000_000, 0.65, 1.1, 1.2),
    # Industry 11 – Telecommunications
    (11, "ConnectTel Wireless", "CTW", 600_000_000, 0.75, 0.9, 1.0),
    (11, "BroadLink Communications", "BLC", 450_000_000, 0.70, 0.8, 0.9),
    (11, "FiberQuest Networks", "FQN", 300_000_000, 0.65, 1.0, 1.1),
    (11, "SkyWave Telecom", "SWT", 200_000_000, 0.55, 1.1, 1.2),
    (11, "DataPipe Solutions", "DPS", 150_000_000, 0.50, 1.0, 1.1),
    (11, "VoiceStream Inc", "VSI", 250_000_000, 0.60, 0.9, 1.0),
    (11, "NexGen Towers", "NGT", 180_000_000, 0.55, 1.1, 1.2),
    (11, "Pacific Satellite Corp", "PSC", 100_000_000, 0.45, 1.2, 1.3),
    (11, "MobileFirst Tech", "MFT", 220_000_000, 0.60, 1.3, 1.2),
    (11, "CyberLink ISP", "CIS", 80_000_000, 0.40, 1.0, 1.1),
    # Industry 12 – Retail & E-commerce
    (12, "MegaMart Retail", "MMR", 800_000_000, 0.80, 1.0, 1.1),
    (12, "ShopWave E-commerce", "SWE", 500_000_000, 0.75, 1.4, 1.3),
    (12, "CornerStore Grocery", "CSG", 350_000_000, 0.65, 0.6, 0.7),
    (12, "TrendSet Fashion", "TSF", 200_000_000, 0.55, 1.1, 1.0),
    (12, "QuickCart Online", "QCO", 150_000_000, 0.50, 1.5, 1.4),
    (12, "HomeStyle Furnishings", "HSF", 120_000_000, 0.50, 0.8, 0.9),
    (12, "BargainBasics Discount", "BBD", 250_000_000, 0.60, 0.7, 0.8),
    (12, "FreshMart Organic", "FMO", 100_000_000, 0.45, 0.5, 0.6),
    (12, "TechGadget Stores", "TGS", 180_000_000, 0.55, 1.3, 1.2),
    (12, "LuxeBoutique Online", "LBO", 60_000_000, 0.35, 1.2, 1.1),
    # Industry 13 – Industrials & Capital Goods
    (13, "Precision Machine Works", "PMW", 300_000_000, 0.65, 1.1, 1.2),
    (13, "Atlas Industrial Corp", "AIC", 400_000_000, 0.70, 1.0, 1.1),
    (13, "Titan Forge Ltd", "TFL", 250_000_000, 0.60, 1.2, 1.3),
    (13, "Global Logistics Systems", "GLS", 350_000_000, 0.65, 1.1, 1.2),
    (13, "SteelBridge Manufacturing", "SBM", 200_000_000, 0.55, 1.3, 1.4),
    (13, "AeroDynamic Components", "ADC", 120_000_000, 0.50, 1.4, 1.3),
    (13, "Rails & Roads Inc", "RRI", 180_000_000, 0.55, 1.0, 1.1),
    (13, "PowerGen Equipment", "PGN", 150_000_000, 0.50, 1.2, 1.3),
    (13, "HydroCore Systems", "HCS", 90_000_000, 0.40, 1.3, 1.4),
    (13, "EcoBuild Technologies", "EBT", 100_000_000, 0.45, 0.9, 1.0),
    # Industry 14 – Chemicals
    (14, "ChemCore Industries", "CCI", 350_000_000, 0.65, 1.0, 1.1),
    (14, "Synthesis Solutions", "SYS", 250_000_000, 0.60, 1.1, 1.2),
    (14, "Polymer Dynamics Inc", "PDI", 200_000_000, 0.55, 1.2, 1.3),
    (14, "AgriGrow Fertilizers", "AGF", 300_000_000, 0.65, 0.9, 1.0),
    (14, "Paints & Coatings Ltd", "PCL", 180_000_000, 0.55, 1.0, 1.1),
    (14, "SolventPro Chemicals", "SPC", 120_000_000, 0.50, 1.3, 1.4),
    (14, "Industrial Adhesives Corp", "IAC", 150_000_000, 0.50, 1.1, 1.2),
    (14, "BlueSky Petrochemicals", "BSP", 250_000_000, 0.60, 1.2, 1.3),
    (14, "Specialty Materials Inc", "SMI", 100_000_000, 0.45, 1.0, 1.1),
    (14, "GreenChem Solutions", "GCS", 80_000_000, 0.40, 0.8, 0.9),
    # Industry 15 – Media & Entertainment
    (15, "Global Media Networks", "GMN", 500_000_000, 0.75, 0.9, 1.0),
    (15, "StarStream Entertainment", "SSE", 350_000_000, 0.70, 1.1, 1.2),
    (15, "Pulse Digital Media", "PDM", 200_000_000, 0.60, 1.3, 1.2),
    (15, "NextReel Studios", "NRS", 150_000_000, 0.55, 1.2, 1.1),
    (15, "StreamVault Inc", "SVI", 120_000_000, 0.50, 1.4, 1.3),
    (15, "ClassicPress Publishing", "CPP", 80_000_000, 0.40, 0.7, 0.8),
    (15, "UrbanBeats Music Group", "UBM", 100_000_000, 0.45, 1.1, 1.0),
    (15, "Hologram Gaming Corp", "HGC", 200_000_000, 0.60, 1.5, 1.4),
    (15, "NewsWire Today", "NWT", 90_000_000, 0.45, 0.8, 0.9),
    (15, "BrightSky Broadcasting", "BSB", 250_000_000, 0.65, 0.9, 1.0),
]

MOAT_KEYS = [
    "market_share",
    "brand_strength",
    "customer_loyalty",
    "cost_advantage",
    "network_effects",
    "intangibles",
    "innovation",
    "competitive_intensity",
    "geographic_diversification",
]

# (lo, hi) per moat sub-factor, keyed by industry_id.
# Order matches MOAT_KEYS above.
MOAT_RANGES = {
    1:  [(30, 70), (30, 70), (30, 70), (30, 70), (10, 40), (20, 50), (20, 50), (40, 70), (30, 60)],
    2:  [(30, 70), (30, 70), (30, 70), (20, 50), (40, 80), (40, 80), (50, 90), (20, 50), (30, 60)],
    3:  [(30, 65), (40, 75), (30, 65), (20, 55), (10, 30), (60, 95), (50, 85), (30, 60), (20, 50)],
    4:  [(30, 70), (50, 90), (50, 85), (30, 60), (10, 30), (10, 30), (15, 40), (30, 60), (40, 80)],
    5:  [(30, 70), (30, 70), (30, 70), (30, 70), (30, 70), (30, 70), (30, 70), (30, 70), (30, 70)],
    6:  [(30, 65), (20, 50), (30, 60), (50, 85), (15, 40), (25, 55), (20, 50), (30, 60), (30, 65)],
    7:  [(30, 60), (20, 50), (60, 90), (40, 70), (10, 30), (10, 30), (10, 40), (30, 55), (30, 60)],
    8:  [(30, 65), (10, 40), (20, 50), (50, 80), (10, 30), (15, 40), (15, 40), (30, 60), (30, 65)],
    9:  [(30, 65), (20, 55), (30, 60), (40, 75), (15, 40), (15, 40), (20, 50), (30, 60), (40, 75)],
    10: [(30, 65), (30, 65), (30, 65), (30, 60), (15, 40), (10, 30), (15, 40), (30, 60), (40, 80)],
    11: [(30, 65), (30, 65), (40, 75), (30, 60), (50, 85), (20, 50), (30, 60), (30, 60), (30, 60)],
    12: [(30, 70), (40, 80), (40, 75), (30, 65), (15, 40), (10, 35), (25, 60), (30, 60), (30, 65)],
    13: [(30, 70), (30, 65), (30, 65), (40, 75), (20, 50), (25, 55), (25, 55), (30, 65), (30, 65)],
    14: [(30, 65), (25, 55), (30, 60), (40, 70), (20, 45), (40, 75), (30, 60), (30, 60), (30, 60)],
    15: [(30, 65), (40, 80), (30, 65), (20, 50), (25, 60), (35, 70), (40, 80), (30, 60), (30, 60)],
}

# (mgmt_lo, mgmt_hi, growth_lo, growth_hi, fcf_lo, fcf_hi) per industry
SCORE_RANGES = {
    1:  (40, 80, 20, 50, 40, 80),
    2:  (40, 85, 60, 90, 30, 70),
    3:  (40, 80, 50, 85, 30, 75),
    4:  (40, 80, 20, 50, 40, 80),
    5:  (30, 75, 20, 60, 25, 65),
    6:  (30, 75, 15, 45, 30, 70),
    7:  (40, 80, 10, 35, 40, 80),
    8:  (30, 70, 20, 50, 25, 60),
    9:  (30, 75, 25, 60, 20, 55),
    10: (30, 75, 20, 50, 25, 60),
    11: (30, 75, 15, 45, 30, 65),
    12: (35, 80, 30, 70, 25, 65),
    13: (35, 75, 25, 55, 25, 60),
    14: (35, 75, 20, 55, 30, 65),
    15: (30, 75, 30, 70, 20, 60),
}


def seed(session: Session) -> None:
    now = datetime.now(timezone.utc)

    for idx, row in enumerate(COMPANIES, start=1):
        industry_id, name, ticker, shares, float_pct, beta_m, beta_s = row

        existing = session.query(Company).filter_by(ticker=ticker).first()
        if existing is None:
            company = Company(
                id=idx,
                name=name,
                ticker=ticker,
                industry_id=industry_id,
                shares_outstanding=shares,
                free_float_pct=float_pct,
                beta_market=beta_m,
                beta_sector=beta_s,
            )
            session.add(company)
            session.flush()
            company_id = company.id
        else:
            company_id = existing.id

        rng = random.Random(company_id)

        # ── Moat subscores ───────────────────────────────────────────
        ranges = MOAT_RANGES[industry_id]
        for sub_i, key in enumerate(MOAT_KEYS):
            lo, hi = ranges[sub_i]
            existing_sub = (
                session.query(MoatSubscore)
                .filter_by(company_id=company_id, subfactor_key=key)
                .first()
            )
            if existing_sub is None:
                session.add(MoatSubscore(
                    company_id=company_id,
                    subfactor_key=key,
                    score=round(rng.uniform(lo, hi), 1),
                ))

        # ── Seed CompanyFactorScore ──────────────────────────────────
        mgmt_lo, mgmt_hi, growth_lo, growth_hi, fcf_lo, fcf_hi = SCORE_RANGES[industry_id]
        existing_cfs = (
            session.query(CompanyFactorScore)
            .filter_by(company_id=company_id, fiscal_period="SEED")
            .first()
        )
        if existing_cfs is None:
            session.add(CompanyFactorScore(
                company_id=company_id,
                fiscal_period="SEED",
                management_quality=round(rng.uniform(mgmt_lo, mgmt_hi), 1),
                moat_score=0,
                financial_quality=0,
                fcf_quality=round(rng.uniform(fcf_lo, fcf_hi), 1),
                growth_potential=round(rng.uniform(growth_lo, growth_hi), 1),
                intrinsic_score=0,
                fair_pe=0,
                intrinsic_value=0,
                computed_at=now,
            ))


def main() -> None:
    database_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://stocksim:stocksim@localhost:5432/stocksim",
    )
    engine = create_engine(database_url)
    with Session(engine) as session:
        seed(session)
        session.commit()
    print("seed_companies.py done.")


if __name__ == "__main__":
    main()
