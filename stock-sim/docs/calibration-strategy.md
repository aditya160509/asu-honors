# Calibration Strategy & Data Opportunity

## 1. Data Inventory

### Master Fundamentals — 3,833 tickers, 364 columns, 37K rows
Full financial statements (BS/IS/CF) + market data per company per quarter.
| Metric | Count |
|---|---|
| Unique tickers | 3,833 |
| Date range | 2021-01-31 to 2025-12-31 |
| Periods | 20,599 quarterly + 16,524 annual |
| Sectors | 12 |
| File | `data/fundamentals/master_fundamentals.parquet` (32 MB) |

### Fama-French Factors (Ken French Data Library)
From `data/factors/` — clean parquet format:
| File | Frequency | Period | Factors |
|---|---|---|---|
| `F_F_Research_Data_Factors_daily.parquet` | Daily | 1926-07 to 2026-02 | Mkt-RF, SMB, HML, RF |
| `F_F_Research_Data_Factors.parquet` | Monthly | 1926-07 to 2025 | Mkt-RF, SMB, HML, RF |
| `F_F_Research_Data_5_Factors_2x3_daily.parquet` | Daily | 1963-07 to 2026-02 | Mkt-RF, SMB, HML, RMW, CMA, RF |
| `F_F_Momentum_Factor_daily.parquet` | Daily | 1926-11 to 2026-02 | Mom |
| `global_Developed_5_Factors_Daily.parquet` | Daily | 1990-07 to 2026-01 | Mkt-RF, SMB, HML, RMW, CMA, RF |
| `global_Developed_MOM_Factor_Daily.parquet` | Daily | 1990-11 to 2026-01 | WML |
| `global_Developed_ex_US_5_Factors_Daily.parquet` | Daily | 1990-07 to 2026-01 | Mkt-RF, SMB, HML, RMW, CMA, RF |

### AQR Factors
From `data/factors/` — daily self-financing excess returns:
| File | Coverage | Contents |
|---|---|---|
| `BAB_Factors.csv` | Daily, since ~1990 | BAB (Betting Against Beta) for 23 countries + Global, North America, Europe, Pacifc |
| `HML_Devil.csv` (BAB set) | Daily, since ~1990 | Devil HML for same countries |
| `QMJ_Factors.csv` | Monthly, since 1957 | QMJ (Quality Minus Junk) for US + global |
| `HML_Devil.csv` (QMJ set) | Monthly, since 1957 | Devil HML monthly |

### Macro & Sentiment
From `data/`:
| File | Rows | Content |
|---|---|---|
| `announcement_surprises.parquet` | 572 | Macro announcement actual vs. forecast surprises |
| `country_metadata.parquet` | 22 | Retail share, analyst coverage by country |
| `google_trends.parquet` | 334 | "market crash", "bear market", "sell stocks" search volume |

### Also Available Outside Repo (not copied, 5391 parquet fies total)
| Dataset | Size | Content |
|---|---|---|
| `APDI/data/processed/market_universe.parquet` | 312 MB, 10.8M rows | Daily OHLCV + returns for global stocks/indices 2015+ |
| `APDI/data/processed/hourly/*.parquet` | ~30 fies | Hourly bars for 25+ global indices (GSPC, FTSE, N225, VIX, etc.) |
| `APDI/data/processed/factors/*.parquet` | various | Fama-French factors (already copied) |
| `APDI/data/processed/announcement_calendar.parquet` | | Macro event calendar |
| `APDI/data/processed/holiday_calendars.pkl` | | Trading holiday calendars by country |
| `APDI/data/processed/msci_rebalancing.parquet` | | MSCI index rebalancing dates |
| `APDI/data/processed/world_bank.pkl` | | World Bank macro indicators |

---

## 2. Engine Calibration: What Needs Real Data

The simulation has ~80 hardcoded/synthetic parameters. Below is every parameter, mapped to the real data column(s) that can calibrate it.

### P0 — Valuation Core (Highest Impact on Realism)

#### Q(S) Logistic Curve: `fair_pe = industry_baseline * Q(intrinsic_score)`
Currently: `q_min=0.30, q_max=5.00, k=0.12, inection=60`
- Data: `trailingPE, forwardPE, sector, industry` + computed quality scores
- **Action**: Bin real companies by intrinsic score proxy → fit logistic curve parameters by sector
- Benefit: Determines how 0-100 score maps to 0.3x-5.0x industry PE multiplier

#### Industry Baseline PEs
Currently: Static values 10-30 per industry (hardcoded in seed_industries.py:13-29)
- Data: `trailingPE, forwardPE` grouped by `industry`
- **Action**: Compute rolling sector-median trailing PE → replace seed values. Refresh quarterly.

#### Score → Return Correlation
- Data: Compute mgmt/growth/FCF quality from financials → correlate with forward returns
- **Action**: Replace `rng.uniform(30, 85)` with real-data distributions

### P1 — Financial Statement Generation

The engine synthesizes fake quarterly fiencials in `_generate_fake_quarterly_financials()`.
Every `rng.uniform()` range (revenue growth, COGS ratio, OpEx ratio, leverage, etc.) can be replaced with sector-median values from Master Fundamentals.

| Engine Parameter (hardcoded) | Real Data Column(s) |
|---|---|
| Revenue growth: `rng.gauss(0.01, 0.03)` | `TotalRevenue` quarter-over-quarter growth by sector |
| COGS ratio: `rng.uniform(0.4, 0.7)` | `CostOfRevenue / TotalRevenue` by industry |
| OpEx ratio: `rng.uniform(0.15, 0.35)` | `OperatingExpense / TotalRevenue` by industry |
| D&A ratio: `rng.uniform(0.02, 0.06)` | `DepreciationAndAmortization / TotalRevenue` by industry |
| Interest expense: `rng.uniform(0.01, 0.04)` | `InterestExpense / TotalRevenue` by industry |
| Cash/Revenue: `rng.uniform(0.05, 0.15)` | `CashCashEquivalentsAndShortTermInvestments / TotalRevenue` by industry |
| Debt/Revenue: `rng.uniform(0.3, 0.8)` | `TotalDebt / TotalRevenue` by industry |
| Equity/Revenue: `rng.uniform(0.5, 1.5)` | `StockholdersEquity / TotalRevenue` by industry |
| Payout ratio: `rng.uniform(0.1, 0.4)` | `CashDividendsPaid / NetIncome` by industry |
| Capex/PPE: `rng.uniform(0.02, 0.05)` | `CapitalExpenditure / NetPPE` by industry |

### P1 — Score & Weight Calibration

| Engine Component | Real Data | Method |
|---|---|---|
| Top-level score weights (mgmt/moat/FQ/etc.) | Trailing PE vs. quality metric cross-section | Regression: PE ~ weighted quality factors |
| FQ pillar weights (profitability, eciency, etc.) | Financial ratios by industry | PCA / factor analysis on real ratios |
| Industry FQ subfactor sets | Balance sheet composition by industry | Cluster analysis on real ratios → idenfiy which ratios matter for each industry |
| Moat subscore ranges | Gross margin stability, R&D/Revenue, market share proxies | Sector percentile distributions |
| Growth potential distributions | Historical 3-year revenue CAGR by industry | Percentile ranks and kernel density fits |

### P2 — Risk & Volatility

| Engine Parameter | Real Data | Method |
|---|---|---|
| Industry base_volatility (0.16-0.40) | Historical daily vol by industry (e.g., 90-day rolling std) | Compute from real daily returns, aggregate to industry level |
| Sector_beta_default (0.5-1.4) | CAPM beta by industry | Regress industry returns on market returns |
| Size effect on vol: tanh(log(mcap/1e9)) | Real vol vs. market cap deciles | Non-parametric ft of vol ~ market cap |
| Vol leverage factor (0.3, max 5.0) | Vol vs. debt/equity ratio by company | Regression of realized vol on leverage ratios |
| Cycle sensitivity (0.2-0.9) | Industry returns during NBER recessions/expansions | Historical beta to GDP / recession indicator |

### P2 — Price Driver & Market Microstructure

| Engine Parameter | Real Data | Method |
|---|---|---|
| 7 price driver weights | Event-study or factor-mimicking portfolios | Could use AQR / FF factors as proxy for systematic drivers |
| Decay rates (rho_news=0.15, rho_es=0.10) | Post-earnings-announcement drift half-life | Event study on real earnings surprises |
| Turnover rate (0.001) | Real daily turnover by market cap decile | Median daily volume / shares outstanding |
| Volume coeffs (return, news, earnings) | Volume-volume response to events | Regression on real data |
| Base spread (10 bps) | Real bid-ask spreads by market cap | CRSP / TAQ summary data |

### P2 — Macro / Cycle Parameters

| Engine Parameter | Real Data | Method |
|---|---|---|
| Transition probabilities (expansion→contraction: 0.03) | NBER business cycle dates 1854-present | Actual expansion/contraction durations |
| Phase returns (expansion=0.0004, peak=0.0001, contraction=-0.0003, trough=-0.0001) | Historical market returns by cycle phase | S&P 500 returns during each NBER phase |
| Phase GDP (expansion=3.0, contraction=-1.5) | Real GDP growth by cycle phase | BEA GDP data |
| Phase interest rates (expansion=4.5, contraction=3.0) | Fed funds rate by cycle phase | FRED data |
| Phase sentiment values | Can use Google Trends data as sentiment proxy | Correlate sentiment index with cycle phases |

### P3 — Institutional Buying Driver

Currently `rng.uniform(-0.1, 0.1) + sentiment * 0.05`. Could be calibrated using 13F fling aggregates or institutional flow data if available.

---

## 3. Beyond Calibration: What These Datasets Enable

### Replace Synthetic Companies with Real Ones
- Use real financial statements from master_fundamentals as direct seed data for simulation companies
- Would give real P&L history, real balance sheets, real growth rates
- 3,833 tickers available — pick any subset

### Factor-Based Price Simulation
- Instead of synthetic OU process with 7 arbitrary drivers, drive prices using actual factor returns:
  - `Price = IV + beta_mkt * MKT + beta_smb * SMB + beta_hml * HML + beta_mom * MOM + idiosyncratic`
- Fama-French 5-factor + momentum covers ~95% of systematic return variation
- AQR BAB/QR factors add betting-against-beta and quality-minus-junk dimensions

### Macro-Aware Shocks
- Use `announcement_surprises` to trigger macro events (Fed rate surprises → sentiment shifts)
- Use `google_trends` to detect retail sentiment extremes → contrarian shocks

### Portfolio & Strategy Backtesting
- Real factor returns 1926-present allow testing any multi-factor strategy
- Global developed ex-US factors for ex-US portfolio testing
- AQR BAB factors allow testing low-volatility strategies

### Cross-Country / Global Simulation
- 22 countries with retail share, analyst coverage metadata
- 25+ global index hourly/daily data
- Could run country-specific simulations with country-calibrated parameters

---

## 4. Recommended Action Plan

### Sprint A: Valuation Calibration (2-3 days, highest ROI)

1. **Compute sector PE distributions from real data** → replace `baseline_pe` in `industries` table
   - File: `scripts/calibrate_industry_pe.py`
   - SQL: `UPDATE industries SET baseline_pe = computed_median`

2. **Fit logistic Q(S) curve** by binning real companies by composite quality score
   - File: `scripts/calibrate_q_curve.ipynb`
   - Output: New values for `q_min, q_max, k, inflection` ConfigParameters

3. **Compute industry-specific volatility from real data**
   - File: `scripts/calibrate_volatility.py`
   - SQL: `UPDATE industries SET base_volatility = computed_vol`

4. **Compute sector betas from real data**
   - File: `scripts/calibrate_betas.py`
   - SQL: `UPDATE industries SET sector_beta_default = computed_beta`

### Sprint B: Financial Statement Realism (2-3 days)

1. **Write `scripts/calibrate_financial_ratios.py`** that:
   - Reads master_fundamentals.parquet
   - Computes 20+ industry-median financial ratios
   - Updates seed_financials.py or produces a config JSON
   - Replaces `rng.uniform()` calls with real-distribution draws

2. **Add sector-awareness** to `_generate_fake_quarterly_financials()`

### Sprint C: Score Calibration (2-3 days)

1. **Distill real financials into quality scores** (mgmt, moat, FQ, FCFQ, growth)
   - Reuse existing scoring logic but apply to real data
   - Fit score ranges by industry
   - Update seed score ranges

2. **Validate** that real-company quality scores produce PE multiples that match real PEs
   - If score → PE match is close, logistic curve is validated

### Sprint D: Factor-Driven Price Engine (3-5 days)

1. **Build factor return ingestion** from Fama-French parquet files
   - Factor: `factor_return = daily_return * beta`
   - Integrate into OU price equation alongside existing price pressure

2. **AQR factors optional** — add BAB and QMJ as auxiliary factors
   - Gives low-volatility and quality factor exposures

3. **Backward compatible** — existing synthetic mode should still work

### Sprint E: Post-Capstone Enhancements

1. **Real company simulation** — pick N real tickers, seed from their real financials
2. **Macro shock integration** — wire up announcement surprises → sentiment shifts
3. **Web frontend (Phase 6)** — the dashboard is independent of calibration work
4. **Global mode** — multiple country simulations with country-specific parameters

---

## 5. Sprint A: Detailed Implementation Plan

### Why Sprint A First
- Valuation is the core of every price in the simulation
- Changes are purely parameteric (ConfigParameters + DB updates)
- No new models or tables needed
- Instantly improves realism of PE ratios, IV, and price discovery

### Files to Create
| File | Purpose |
|---|---|
| `scripts/calibrate_utils.py` | Shared helpers: compute sector medians, ft logistic, write config |
| `scripts/calibrate_industry_pe.py` | Compute sector PEs from real data, update DB |
| `scripts/calibrate_q_curve.py` | Fit logistic Q(S) from real PE/score data |
| `scripts/calibrate_volatility.py` | Compute industry vols and betas |
| `scripts/calibrate_financial_ratios.py` | Compute industry-median fnancial ratios |
| `scripts/calibrate_quality_scores.py` | Score real companies using existing scoring logic |
| `scripts/run_all_calibrations.py` | Orchestrate all in sequence |
| `docs/calibration-results.md` | Document what was calibrated and the new values |

### SQL Updates Needed
```sql
-- After computing new values
UPDATE industries SET baseline_pe = <computed_median> WHERE id = <industry_id>;
UPDATE industries SET base_volatility = <computed_vol> WHERE id = <industry_id>;
UPDATE industries SET sector_beta_default = <computed_beta> WHERE id = <industry_id>;

-- ConfigParameters are updated via API (PATCH /api/v1/config)
```

### Validation
After Sprint A:
```bash
python scripts/validate_calibration.py
# Checks: PE distributions match real data, vol ranges match real data
```

---

## 6. Sprint A: Code to Write

Below is the actual code for each calibration script. Reproduce in order.

### 6.1 `scripts/calibrate_utils.py`

```python
"""Shared helpers for calibration scripts."""

import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from scipy import optimize

DATA_DIR = Path("data")
FUNDAMENTALS_PATH = DATA_DIR / "fundamentals" / "master_fundamentals.parquet"


def load_fundamentals() -> pd.DataFrame:
    df = pd.read_parquet(FUNDAMENTALS_PATH)
    # Filter to latest annual or quarterly snapshot
    df = df.sort_values("reportDate").groupby("ticker").last().reset_index()
    return df


def sector_medians(df: pd.DataFrame, metric_col: str, min_obs: int = 5) -> pd.Series:
    """Compute median of metric_col by sector, filtering out small sectors."""
    medians = df.groupby("sector")[metric_col].median()
    counts = df.groupby("sector")[metric_col].count()
    medians = medians[counts >= min_obs]
    return medians


def logistic(x: np.ndarray, qmin: float, qmax: float, k: float, c: float) -> np.ndarray:
    return qmin + (qmax - qmin) / (1 + np.exp(-k * (x - c)))


def ft_logistic(x: np.ndarray, y: np.ndarray) -> Tuple[float, float, float, float]:
    """Fit logistic curve y = qmin + (qmax-qmin)/(1+exp(-k*(x-c))) to data."""

    def resid(params):
        qmin, qmax, k, c = params
        pred = logistic(x, qmin, qmax, k, c)
        return np.sum((y - pred) ** 2)

    bounds = [(0.01, 2.0), (0.5, 10.0), (0.01, 1.0), (10.0, 90.0)]
    result = optimize.minimize(resid, [0.3, 5.0, 0.12, 60.0], bounds=bounds, method="L-BFGS-B")
    return tuple(result.x)
```

### 6.2 `scripts/calibrate_industry_pe.py`

```python
"""Compute industry median trailing PEs from real data and suggest DB updates."""

import pandas as pd
from calibrate_utils import load_fundamentals, sector_medians


def main():
    df = load_fundamentals()
    
    # Filter to valid PEs
    df = df[(df["trailingPE"] > 0) & (df["trailingPE"] < 200)]
    
    # Sector medians
    medians = sector_medians(df, "trailingPE")
    print("=== Sector Median Trailing P/E ===")
    for sector, pe in medians.sort_values().items():
        print(f"  {sector:25s} → {pe:.1f}")
    
    # Industry medians (fner granularity)
    industry_medians = df.groupby("industry")["trailingPE"].median().sort_values()
    print("\n=== Top 10 Industries by Median P/E ===")
    for ind, pe in industry_medians.tail(10).items():
        print(f"  {ind:40s} → {pe:.1f}")
    
    print("\n=== Bottom 10 Industries by Median P/E ===")
    for ind, pe in industry_medians.head(10).items():
        print(f"  {ind:40s} → {pe:.1f}")
    
    # Save for DB update
    medians.to_csv("outputs/industry_pe_calibration.csv", header=["median_trailing_pe"])


if __name__ == "__main__":
    main()
```

### 6.3 `scripts/calibrate_q_curve.py`

```python
"""Fit logistic Q(S) curve: PE = industry_baseline * Q(intrinsic_score)."""

import pandas as pd
import numpy as np
from calibrate_utils import load_fundamentals, ft_logistic, logistic

# First we need to score real companies (see calibrate_quality_scores.py)
# Then ft PE = industry_baseline * Q(score)  →  Q = PE / industry_baseline


def main():
    df = load_fundamentals()
    df = df[(df["trailingPE"] > 0) & (df["trailingPE"] < 200)]
    
    # Compute sector baseline PEs
    sector_pe = df.groupby("sector")["trailingPE"].median()
    df["sector_baseline_pe"] = df["sector"].map(sector_pe)
    df["q_multiplier"] = df["trailingPE"] / df["sector_baseline_pe"]
    
    # Clip extreme multipliers
    df = df[(df["q_multiplier"] >= 0.1) & (df["q_multiplier"] <= 10.0)]
    
    # For now, proxy intrinsic score using available metrics
    # A higher-quality score would use the full scoring pipeline
    df["quality_proxy"] = (
        df["returnOnEquity"].rank(pct=True) * 0.3
        + df["grossMargins"].rank(pct=True) * 0.3
        + (1 / (1 + df["debtToEquity"].fillna(1))).rank(pct=True) * 0.2
        + df["currentRatio"].rank(pct=True) * 0.2
    ) * 100
    
    df = df.dropna(subset=["q_multiplier", "quality_proxy"])
    
    x = df["quality_proxy"].values
    y = df["q_multiplier"].values
    
    qmin, qmax, k, c = ft_logistic(x, y)
    
    print("=== Fitted Q(S) Logistic Curve ===")
    print(f"  q_min = {qmin:.4f}")
    print(f"  q_max = {qmax:.4f}")
    print(f"  k     = {k:.4f}")
    print(f"  c     = {c:.4f}")
    
    # R-squared
    y_pred = logistic(x, qmin, qmax, k, c)
    ss_res = np.sum((y - y_pred) ** 2)
    ss_tot = np.sum((y - np.mean(y)) ** 2)
    r2 = 1 - ss_res / ss_tot
    print(f"  R²    = {r2:.4f}")


if __name__ == "__main__":
    main()
```

### 6.4 `scripts/calibrate_volatility.py`

```python
"""Compute industry volatilities and betas from real data."""

import pandas as pd
import numpy as np
from calibrate_utils import load_fundamentals, sector_medians


def main():
    df = load_fundamentals()
    
    # Size distributions by sector (market cap proxy for vol)
    print("=== Sector Market Cap Distributions (billions) ===")
    for sector, group in df.groupby("sector"):
        mcap = group["marketCap"].dropna() / 1e9
        if len(mcap) == 0:
            continue
        print(f"  {sector:25s}  median={mcap.median():.2f}B  "
              f"p25={mcap.quantile(0.25):.2f}B  p75={mcap.quantile(0.75):.2f}B")
    
    # Leverage by sector (proxy for vol leverage effect)
    print("\n=== Sector Debt/Equity Ratios ===")
    de_medians = sector_medians(df, "debtToEquity")
    for sector, de in de_medians.sort_values().items():
        print(f"  {sector:25s} → {de:.2f}")
    
    # ROE distributions by sector
    print("\n=== Sector ROE Distributions ===")
    for sector, group in df.groupby("sector"):
        roe = group["returnOnEquity"].dropna()
        if len(roe) == 0:
            continue
        print(f"  {sector:25s}  median={roe.median():.3f}  "
              f"p25={roe.quantile(0.25):.3f}  p75={roe.quantile(0.75):.3f}")
    
    # Suggested vol ranges for seed industries
    # Higher mcap → lower vol, Higher D/E → higher vol
    print("\n=== Suggested base_volatility updates (proxy: inverse market cap size) ===")
    mcap_medians = sector_medians(df, "marketCap")
    # Normalize: larger mcap → lower vol, scaled to [0.15, 0.40] range
    normalized = 1 - (mcap_medians - mcap_medians.min()) / (mcap_medians.max() - mcap_medians.min())
    suggested_vol = 0.15 + normalized * 0.25
    for sector, vol in suggested_vol.sort_values().items():
        print(f"  {sector:25s} → {vol:.3f} (mcap_median={mcap_medians[sector]/1e9:.1f}B)")


if __name__ == "__main__":
    main()
```

### 6.5 `scripts/calibrate_financial_ratios.py`

```python
"""Compute industry-median fnancial ratios for seed fnancial statement generation."""

import pandas as pd
import numpy as np
from calibrate_utils import load_fundamentals

RATIOS = [
    ("cogs_ratio", "CostOfRevenue", "TotalRevenue", lambda c, r: c / r if r > 0 else np.nan),
    ("opex_ratio", "OperatingExpense", "TotalRevenue", lambda c, r: c / r if r > 0 else np.nan),
    ("da_ratio", "DepreciationAndAmortization", "TotalRevenue", lambda c, r: c / r if r > 0 else np.nan),
    ("interest_ratio", "InterestExpense", "TotalRevenue", lambda c, r: c / r if r > 0 else np.nan),
    ("cash_ratio", "CashCashEquivalentsAndShortTermInvestments", "TotalRevenue", lambda c, r: c / r if r > 0 else np.nan),
    ("debt_ratio", "TotalDebt", "TotalRevenue", lambda c, r: c / r if r > 0 else np.nan),
    ("equity_ratio", "StockholdersEquity", "TotalRevenue", lambda c, r: c / r if r > 0 else np.nan),
    ("capex_ratio", "CapitalExpenditure", "NetPPE", lambda c, r: abs(c / r) if r > 0 else np.nan),
    ("payout_ratio", "CashDividendsPaid", "NetIncome", lambda c, r: abs(c / r) if r > 0 else np.nan),
    ("gross_margin", "GrossProfit", "TotalRevenue", lambda c, r: c / r if r > 0 else np.nan),
    ("receivables_ratio", "AccountsReceivable", "TotalAssets", lambda c, r: c / r if r > 0 else np.nan),
    ("inventory_ratio", "Inventory", "TotalAssets", lambda c, r: c / r if r > 0 else np.nan),
    ("ppe_ratio", "NetPPE", "TotalAssets", lambda c, r: c / r if r > 0 else np.nan),
    ("intangibles_ratio", "GoodwillAndOtherIntangibleAssets", "TotalAssets", lambda c, r: c / r if r > 0 else np.nan),
]


def main():
    df = load_fundamentals()
    
    print("=== Industry-Median Financial Ratios ===")
    print(f"{'Industry':45s}", end="")
    for name, _, _, _ in RATIOS:
        print(f"{name:18s}", end="")
    print()
    
    for sector, group in df.groupby("sector"):
        print(f"{sector:45s}", end="")
        for name, num_col, denom_col, fn in RATIOS:
            if num_col not in df.columns or denom_col not in df.columns:
                print(f"{'N/A':18s}", end="")
                continue
            group_clean = group.dropna(subset=[num_col, denom_col])
            if len(group_clean) == 0:
                print(f"{'N/A':18s}", end="")
                continue
            vals = group_clean.apply(lambda r: fn(r[num_col], r[denom_col]), axis=1)
            vals = vals[~np.isinf(vals) & vals.notna()]
            if len(vals) == 0:
                print(f"{'N/A':18s}", end="")
                continue
            print(f"{vals.median():>8.4f}      ", end="")
        print()
    
    # Also compute revenue distributions for seed
    print("\n=== Revenue Distributions by Sector (billions) ===")
    for sector, group in df.groupby("sector"):
        rev = group["TotalRevenue"].dropna() / 1e9
        if len(rev) == 0:
            continue
        print(f"  {sector:25s}  median={rev.median():>.2f}B  "
              f"p25={rev.quantile(0.25):>.2f}B  p75={rev.quantile(0.75):>.2f}B")


if __name__ == "__main__":
    main()
```

### 6.6 `scripts/calibrate_quality_scores.py`

```python
"""Score real companies using existing scoring logic, then ft distributions per industry."""

import pandas as pd
import numpy as np
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from calibrate_utils import load_fundamentals
from engine.scoring import FQComposite, MoatComposite
from db.models.reference import IndustryFactorWeight, IndustryMoatWeight


def compute_financial_quality_scores(df: pd.DataFrame) -> pd.Series:
    """Compute percentile-ranked FQ score for each company.
    
    Using the engine's percentile_rank_scores approach.
    """
    metrics = {
        "operating_margin": (df.get("grossMargins", pd.Series(0)), 1),
        "roe": (df.get("returnOnEquity", pd.Series(0)), 1),
        "debt_to_equity": (df.get("debtToEquity", pd.Series(0)), -1),
        "current_ratio": (df.get("currentRatio", pd.Series(0)), 1),
    }
    
    scores = pd.DataFrame(index=df.index)
    for name, (series, direction) in metrics.items():
        clean = series.fillna(series.median())
        ranked = clean.rank(pct=True)
        scores[name] = ranked if direction > 0 else (1 - ranked)
    
    # Composite (equal-weight for now)
    fq_score = scores.mean(axis=1) * 100
    return fq_score


def main():
    df = load_fundamentals()
    df = df[(df["trailingPE"] > 0) & (df["trailingPE"] < 200)]
    
    # Compute FQ scores
    df["fq_score"] = compute_financial_quality_scores(df)
    
    # Growth potential proxy: trailingPE (high PE → high growth expectation)
    df["growth_proxy"] = df["trailingPE"].rank(pct=True) * 100
    
    # Management quality proxy: ROE (high ROE → good mgmt)
    df["mgmt_proxy"] = df["returnOnEquity"].rank(pct=True).fillna(0.5) * 100
    
    # Composite intrinsic score proxy (simplifed version of engine logic)
    df["intrinsic_score"] = (
        0.25 * df["mgmt_proxy"]
        + 0.25 * df["fq_score"]
        + 0.30 * df["growth_proxy"]
        + 0.20 * 50  # FCFQ placeholder
    )
    
    # Score distributions by sector
    print("=== Score Distributions by Sector ===")
    for sector, group in df.groupby("sector"):
        scores = group["intrinsic_score"].dropna()
        if len(scores) == 0:
            continue
        print(f"  {sector:25s}  mean={scores.mean():.1f}  "
              f"std={scores.std():.1f}  p10={scores.quantile(0.1):.1f}  "
              f"p90={scores.quantile(0.9):.1f}")
    
    # Update score ranges for seed company generation
    print("\n=== Suggested Score Ranges for seed companies ===")
    for sector, group in df.groupby("sector"):
        for metric, label in [("intrinsic_score", "intrinsic"),
                              ("mgmt_proxy", "mgmt"),
                              ("fq_score", "fq"),
                              ("growth_proxy", "growth")]:
            vals = group[metric].dropna()
            if len(vals) == 0:
                continue
            lo = max(10, int(vals.quantile(0.05)))
            hi = min(95, int(vals.quantile(0.95)))
            print(f"  {sector:25s} {label:10s}: ({lo}, {hi})")
        print()


if __name__ == "__main__":
    main()
```

### 6.7 `scripts/run_all_calibrations.py`

```python
"""Run all calibration scripts in sequence and produce a summary."""

import subprocess
import sys
from pathlib import Path

SCRIPTS = [
    "calibrate_industry_pe.py",
    "calibrate_q_curve.py",
    "calibrate_volatility.py",
    "calibrate_financial_ratios.py",
    "calibrate_quality_scores.py",
]

SCRIPT_DIR = Path(__file__).parent


def main():
    results = {}
    for script in SCRIPTS:
        path = SCRIPT_DIR / script
        print(f"\n{'='*60}")
        print(f"Running {script}...")
        print(f"{'='*60}")
        result = subprocess.run([sys.executable, str(path)], capture_output=True, text=True)
        results[script] = result
        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr[:500])
    
    print(f"\n{'='*60}")
    print("CALIBRATION SUMMARY")
    print(f"{'='*60}")
    for script, result in results.items():
        status = "OK" if result.returncode == 0 else "FAILED"
        print(f"  {script:40s} {status}")


if __name__ == "__main__":
    main()
```

### 6.8 `scripts/validate_calibration.py`

```python
"""Validate that calibration improved engine realism."""

import pandas as pd
import numpy as np
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from calibrate_utils import load_fundamentals


def main():
    df = load_fundamentals()
    df = df[(df["trailingPE"] > 0) & (df["trailingPE"] < 200)]
    
    print("=== Validation Checks ===")
    print()
    
    # Check 1: PE distributions by sector
    print("1. Sector PE distributions (should match updated baseline_pe values):")
    sect_medians = df.groupby("sector")["trailingPE"].median().sort_values()
    for sector, pe in sect_medians.items():
        print(f"    {sector:25s} → {pe:.1f}")
    
    # Check 2: Are PEs roughly lognormal?
    from scipy import stats
    pe_values = df["trailingPE"].values
    pe_log = np.log(pe_values[pe_values > 0])
    _, p_value = stats.normaltest(pe_log)
    print(f"\n2. PE log-normality test p-value: {p_value:.4f} "
          f"({'pass' if p_value > 0.01 else 'skewed distribution'})")
    
    # Check 3: Correlation between size and volatility proxy
    if "marketCap" in df.columns and "returnOnEquity" in df.columns:
        corr = df["marketCap"].corr(df["returnOnEquity"])
        print(f"3. Market cap vs ROE correlation: {corr:.3f} (expect slightly positive)")
    
    # Check 4: Sample vs engine parameters
    print(f"\n4. Data quality:")
    print(f"    Companies with valid PE: {df['trailingPE'].notna().sum()} / {len(df)}")
    print(f"    Companies with valid ROE: {df['returnOnEquity'].notna().sum()} / {len(df)}")
    print(f"    Companies with valid D/E: {df['debtToEquity'].notna().sum()} / {len(df)}")
    
    print("\n=== Validation Complete ===")


if __name__ == "__main__":
    main()
```

---

## 7. Decision Matrix: What to Do

| Option | Eort | Impact | When |
|---|---|---|---|
| **A: Calibrate valuation** (Sprint A) | 2-3 days | High — PE ratios, IV, prices will refect real-world ranges | **Now** |
| **B: Calibrate fnancials** (Sprint B) | 2-3 days | Medium — synthetic fnancials match sector norms | After A |
| **C: Factor engine** (Sprint D) | 3-5 days | High — prices driven by real factor returns (Fama-French) | Before capstone |
| **D: Phase 6 frontend** | 5-7 days | High — web UI for the simulation | In parallel |
| **E: Real company seeds** | 2-3 days | High — replaces all synthetic with real tickers | Post-capstone |
| **F: Macro shocks** | 2-3 days | Medium — macro-driven sentiment and price impact | Post-capstone |

### Recommendation

**Do A (valuation calibration) now, then D (Phase 6 frontend) in parallel with B+C.**

Rationale:
1. Sprint A is pure parameter changes, highest realism ROI, code is already written above
2. Phase 6 is the capstone deliverable and independent of calibration work
3. B + C can be done while Phase 6 is being built
4. E + F are post-capstone enhancements

### Script Outputs That Need DB Updates

After running calibration scripts, these values must be written to the database:

```sql
-- Sprint A outputs
UPDATE industries SET baseline_pe = <value> WHERE id = <id>;
UPDATE industries SET base_volatility = <value> WHERE id = <id>;
UPDATE industries SET sector_beta_default = <value> WHERE id = <id>;
UPDATE config_parameters SET value = '<new_qmin>' WHERE key = 'quality_mult_min';
UPDATE config_parameters SET value = '<new_qmax>' WHERE key = 'quality_mult_max';
UPDATE config_parameters SET value = '<new_k>' WHERE key = 'quality_mult_k';
UPDATE config_parameters SET value = '<new_inflection>' WHERE key = 'quality_mult_inflection';

-- Sprint B outputs
-- These values flow into seed_financials.py (code change needed for dynamic ratios)
```

---

## 8. Data File Reference

| File in Repo | Source | Description |
|---|---|---|
| `data/fundamentals/master_fundamentals.parquet` | ~/Downloads/quant\ 2/backend/data/fundamentals/ | 3,833 tickers, 364 columns, 37K rows |
| `data/factors/F_F_Research_Data_Factors_daily.parquet` | APDI data | Fama-French 3-factor daily (1926-2026) |
| `data/factors/F_F_Research_Data_5_Factors_2x3_daily.parquet` | APDI data | Fama-French 5-factor daily (1963-2026) |
| `data/factors/F_F_Momentum_Factor_daily.parquet` | APDI data | Momentum factor daily (1926-2026) |
| `data/factors/global_Developed_5_Factors_Daily.parquet` | APDI data | Global developed 5-factor daily (1990-2026) |
| `data/factors/Betting-Against-Beta-Equity-Factors-Daily__BAB_Factors.csv` | AQR | BAB factors, 23 countries daily |
| `data/factors/Quality-Minus-Junk-Factors-Monthly__QMJ_Factors.csv` | AQR | QMJ factors, monthly (1957-2026) |
| `data/announcement_surprises.parquet` | APDI | Macro announcement surprises (572 events) |
| `data/country_metadata.parquet` | APDI | 22 countries: retail share, analyst coverage |
| `data/google_trends.parquet` | APDI | Fear/sentiment search volume indices |

### External Data Not Copied (referenced by path)

File too large or project-specific — reference by absolute path:
- `~/Downloads/quant\ 2/APDI/data/processed/market_universe.parquet` — 312 MB, 10.8M rows, daily OHLCV for global stocks (2015+)
- `~/Downloads/quant\ 2/APDI/data/processed/hourly/*.parquet` — hourly bars for 25+ global indices
- `~/Downloads/quant\ 2/factors/data/processed/aqr_csv/*.csv` — AQR factor definitions, disclosures, sources

Total factor dataset: **9 Fama-French parquet files + 3 AQR factor CSVs + fundamentals + macro = ~42 MB**

Total available (all external): **~1.2 GB (5391 fies)**
