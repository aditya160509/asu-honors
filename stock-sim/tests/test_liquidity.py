import math

from engine import liquidity as liq


def test_order_imbalance_buying():
    result = liq.order_imbalance(demand=150, supply=50)
    assert math.isclose(result, 0.5)


def test_order_imbalance_selling():
    result = liq.order_imbalance(demand=50, supply=150)
    assert math.isclose(result, -0.5)


def test_order_imbalance_zero_when_equal():
    result = liq.order_imbalance(demand=100, supply=100)
    assert math.isclose(result, 0.0)


def test_order_imbalance_zero_when_both_zero():
    result = liq.order_imbalance(demand=0, supply=0)
    assert math.isclose(result, 0.0)


def test_demand_from_pressure_positive():
    result = liq.demand_from_pressure(base_volume=1000, price_pressure=0.5, sensitivity=0.2)
    assert math.isclose(result, 1000 * (1 + 0.2 * 0.5))


def test_demand_from_pressure_negative_pressure_no_effect():
    result = liq.demand_from_pressure(base_volume=1000, price_pressure=-0.5, sensitivity=0.2)
    assert math.isclose(result, 1000 * 1.0)


def test_supply_from_pressure_negative():
    result = liq.supply_from_pressure(base_volume=1000, price_pressure=-0.5, sensitivity=0.2)
    assert math.isclose(result, 1000 * (1 + 0.2 * 0.5))


def test_supply_from_pressure_positive_pressure_no_effect():
    result = liq.supply_from_pressure(base_volume=1000, price_pressure=0.5, sensitivity=0.2)
    assert math.isclose(result, 1000 * 1.0)


def test_daily_volume_basic():
    result = liq.daily_volume(base_volume=1_000_000, free_float_pct=0.5, imbalance=0.2)
    expected = 1_000_000 * 0.5 * (1 + 0.2)
    assert math.isclose(result, expected)


def test_daily_volume_no_imbalance():
    result = liq.daily_volume(base_volume=1_000_000, free_float_pct=0.5, imbalance=0.0)
    assert math.isclose(result, 500_000)


def test_market_liquidity_score_basic():
    score = liq.market_liquidity_score(free_float_pct=0.5, avg_daily_volume=10_000_000, market_cap=1_000_000_000)
    expected_turnover = 10_000_000 / 1_000_000_000
    expected = 100.0 * 0.5 * expected_turnover
    assert math.isclose(score, expected)


def test_market_liquidity_score_clamps_to_100():
    score = liq.market_liquidity_score(free_float_pct=1.0, avg_daily_volume=1_000_000_000, market_cap=1_000_000)
    assert score == 100.0


def test_market_liquidity_score_zero_cap_returns_zero():
    score = liq.market_liquidity_score(free_float_pct=0.5, avg_daily_volume=10_000_000, market_cap=0)
    assert score == 0.0


def test_bid_ask_spread_widens_with_illiquidity():
    liquid = liq.bid_ask_spread(base_spread_bps=10, liquidity_score=100)
    illiquid = liq.bid_ask_spread(base_spread_bps=10, liquidity_score=0)
    assert illiquid > liquid


def test_bid_ask_spread_fully_liquid_is_base():
    result = liq.bid_ask_spread(base_spread_bps=10, liquidity_score=100)
    assert math.isclose(result, 10.0)


def test_kyle_lambda_impact_basic():
    result = liq.kyle_lambda_impact(order_size=1000, kyle_lambda=0.0001)
    assert math.isclose(result, 0.1)


def test_kyle_lambda_from_liquidity_more_liquid_less_impact():
    illiquid = liq.kyle_lambda_from_liquidity(liquidity_score=0, scale=1.0)
    liquid = liq.kyle_lambda_from_liquidity(liquidity_score=100, scale=1.0)
    assert liquid < illiquid


def test_trade_price_with_impact_buy():
    result = liq.trade_price_with_impact(mid_price=100, order_size=1000, kyle_lambda=0.0001, side="buy")
    assert result > 100


def test_trade_price_with_impact_sell():
    result = liq.trade_price_with_impact(mid_price=100, order_size=1000, kyle_lambda=0.0001, side="sell")
    assert result < 100
