"""Portfolio history reconstruction and risk metrics.

There is no daily NAV snapshot table; the daily portfolio-value series is
reconstructed from the transaction ledger + price_history closes. Both the
Performance chart and the Analytics risk metrics consume this single code path.
"""

import logging
import math
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from apps.api.exceptions import NotFoundError
from apps.api.schemas import BenchmarkPoint, PortfolioHistoryPoint, PortfolioHistoryResponse
from db.models import Portfolio, PriceHistory, SimulationState, Transaction, User

logger = logging.getLogger(__name__)

RANGE_DAYS: dict[str, Optional[int]] = {
    "1D": 1,
    "5D": 7,  # 5 trading days ~ 7 calendar days
    "1M": 30,
    "6M": 182,
    "YTD": None,  # resolved from current sim year
    "1Y": 365,
    "5Y": 1825,
    "MAX": None,
}

# Minimum daily-return observations before a statistic is reported at all —
# below this the numbers are noise dressed up as analysis.
MIN_RETURN_OBSERVATIONS = 10
TRADING_DAYS_PER_YEAR = 252


def _current_sim_date(db: Session, timeline_id: int) -> date:
    state = db.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    return state.current_sim_date if state is not None else date.today()


def resolve_range_start(range_key: str, current: date) -> Optional[date]:
    """None means unbounded (MAX)."""
    key = range_key.upper()
    if key == "MAX":
        return None
    if key == "YTD":
        return date(current.year, 1, 1)
    days = RANGE_DAYS.get(key)
    if days is None:
        return None
    return current - timedelta(days=days)


def get_portfolio_history(
    db: Session, user: User, timeline_id: int, range_key: str
) -> PortfolioHistoryResponse:
    portfolio = db.query(Portfolio).filter_by(user_id=user.id, timeline_id=timeline_id).first()
    if portfolio is None:
        raise NotFoundError("Portfolio not found")

    current = _current_sim_date(db, timeline_id)
    start = resolve_range_start(range_key, current)

    # Equal-weight market composite doubles as the trading calendar.
    bench_q = (
        db.query(PriceHistory.sim_date, func.avg(PriceHistory.close))
        .filter(PriceHistory.timeline_id == timeline_id, PriceHistory.sim_date <= current)
    )
    if start is not None:
        bench_q = bench_q.filter(PriceHistory.sim_date >= start)
    bench_rows = bench_q.group_by(PriceHistory.sim_date).order_by(PriceHistory.sim_date).all()
    calendar = [r[0] for r in bench_rows]
    benchmark = [BenchmarkPoint(sim_date=r[0], value=Decimal(str(round(float(r[1]), 4)))) for r in bench_rows]

    if not calendar:
        return PortfolioHistoryResponse(range=range_key, points=[], benchmark=[])

    txns = (
        db.query(Transaction)
        .filter_by(portfolio_id=portfolio.id)
        .order_by(Transaction.sim_date.asc(), Transaction.id.asc())
        .all()
    )

    held_company_ids = {t.company_id for t in txns}
    closes: dict[tuple[int, date], float] = {}
    if held_company_ids:
        price_q = db.query(
            PriceHistory.company_id, PriceHistory.sim_date, PriceHistory.close
        ).filter(
            PriceHistory.timeline_id == timeline_id,
            PriceHistory.company_id.in_(held_company_ids),
            PriceHistory.sim_date <= current,
        )
        # No lower bound: positions opened before the window still need a price
        # via forward-fill from their last close before the first calendar date.
        for cid, d, close in price_q.all():
            closes[(cid, d)] = float(close)

    starting_cash = float(user.starting_cash or 0)

    points: list[PortfolioHistoryPoint] = []
    cash = starting_cash
    qty: dict[int, float] = {}
    last_close: dict[int, float] = {}
    txn_idx = 0
    n_txns = len(txns)

    # Apply everything that happened before the first calendar date so the
    # window opens with the true position state.
    first_day = calendar[0]
    while txn_idx < n_txns and txns[txn_idx].sim_date < first_day:
        cash, qty = _apply_txn(txns[txn_idx], cash, qty)
        txn_idx += 1
    for cid in qty:
        # Seed forward-fill with the most recent close at/before the window start.
        seed = _latest_close_at_or_before(closes, cid, first_day)
        if seed is not None:
            last_close[cid] = seed

    for d in calendar:
        while txn_idx < n_txns and txns[txn_idx].sim_date <= d:
            cash, qty = _apply_txn(txns[txn_idx], cash, qty)
            txn_idx += 1
        holdings_value = 0.0
        for cid, q in qty.items():
            if q <= 0:
                continue
            c = closes.get((cid, d))
            if c is not None:
                last_close[cid] = c
            holdings_value += q * last_close.get(cid, 0.0)
        total = cash + holdings_value
        points.append(
            PortfolioHistoryPoint(
                sim_date=d,
                total_value=Decimal(str(round(total, 4))),
                cash=Decimal(str(round(cash, 4))),
                holdings_value=Decimal(str(round(holdings_value, 4))),
            )
        )

    return PortfolioHistoryResponse(range=range_key, points=points, benchmark=benchmark)


def _apply_txn(txn: Transaction, cash: float, qty: dict[int, float]) -> tuple[float, dict[int, float]]:
    q = float(txn.quantity)
    price = float(txn.price)
    fees = float(txn.fees)
    new_qty = dict(qty)
    if txn.side == "buy":
        cash = cash - q * price - fees
        new_qty[txn.company_id] = new_qty.get(txn.company_id, 0.0) + q
    else:
        cash = cash + q * price - fees
        new_qty[txn.company_id] = new_qty.get(txn.company_id, 0.0) - q
    return cash, new_qty


def _latest_close_at_or_before(
    closes: dict[tuple[int, date], float], company_id: int, day: date
) -> Optional[float]:
    candidates = [(d, c) for (cid, d), c in closes.items() if cid == company_id and d <= day]
    if not candidates:
        return None
    return max(candidates)[1]


# ---------------------------------------------------------------------------
# Risk metrics
# ---------------------------------------------------------------------------


def _daily_returns(values: list[float]) -> list[float]:
    returns = []
    for prev, cur in zip(values, values[1:]):
        if prev > 0:
            returns.append(cur / prev - 1.0)
    return returns


def _mean(xs: list[float]) -> float:
    return sum(xs) / len(xs)


def _std(xs: list[float]) -> float:
    if len(xs) < 2:
        return 0.0
    m = _mean(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / (len(xs) - 1))


def compute_risk_metrics(history: PortfolioHistoryResponse) -> dict[str, Optional[float]]:
    """Beta, Sharpe (risk-free rate 0), annualized volatility %, max drawdown %.

    Every metric individually degrades to None when the series is too short —
    the UI renders a contained 'needs more history' state instead of a number.
    """
    values = [float(p.total_value) for p in history.points]
    bench = [float(b.value) for b in history.benchmark]

    port_returns = _daily_returns(values)

    metrics: dict[str, Optional[float]] = {
        "beta": None,
        "sharpe_ratio": None,
        "volatility_pct": None,
        "max_drawdown_pct": None,
    }

    if len(values) >= 2:
        peak = values[0]
        max_dd = 0.0
        for v in values:
            peak = max(peak, v)
            if peak > 0:
                max_dd = min(max_dd, v / peak - 1.0)
        metrics["max_drawdown_pct"] = max_dd * 100.0

    if len(port_returns) >= MIN_RETURN_OBSERVATIONS:
        vol = _std(port_returns)
        metrics["volatility_pct"] = vol * math.sqrt(TRADING_DAYS_PER_YEAR) * 100.0
        if vol > 0:
            metrics["sharpe_ratio"] = _mean(port_returns) / vol * math.sqrt(TRADING_DAYS_PER_YEAR)

    bench_returns = _daily_returns(bench)
    n = min(len(port_returns), len(bench_returns))
    if n >= MIN_RETURN_OBSERVATIONS:
        pr, br = port_returns[-n:], bench_returns[-n:]
        bm = _mean(br)
        var_b = sum((b - bm) ** 2 for b in br) / (n - 1)
        if var_b > 0:
            pm = _mean(pr)
            cov = sum((p - pm) * (b - bm) for p, b in zip(pr, br)) / (n - 1)
            metrics["beta"] = cov / var_b

    return metrics
