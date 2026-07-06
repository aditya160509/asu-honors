"""Tests for engine.tick — the simulation tick orchestrator."""

import math

import numpy as np

from engine.tick import CompanyTickInput, CompanyTickOutput, TickResult, TickState, run_tick


def _make_input(company_id: int = 1, y: float = 0.0, theta: float = 0.05, **kw) -> CompanyTickInput:
    defaults = dict(
        driver_values={},
        driver_weights={},
        beta_market=1.0,
        beta_sector=0.5,
        sector_factor_return=0.0,
        sigma=0.2,
        epsilon=0.0,
        intrinsic_value=100.0,
    )
    defaults.update(kw)
    return CompanyTickInput(company_id=company_id, y=y, theta=theta, **defaults)


def test_run_tick_empty_state_returns_next_day():
    state = TickState(sim_day=10, market_factor_return=0.0, companies=())
    result = run_tick(state)
    assert result.sim_day == 11
    assert result.outputs == ()


def test_run_tick_single_company_produces_output():
    inp = _make_input(company_id=5)
    state = TickState(sim_day=0, market_factor_return=0.0, companies=(inp,))
    result = run_tick(state)
    assert isinstance(result, TickResult)
    assert len(result.outputs) == 1
    out = result.outputs[0]
    assert out.company_id == 5
    assert isinstance(out.y, float)
    assert isinstance(out.price, float)
    assert isinstance(out.price_pressure, float)


def test_run_tick_price_near_iv_with_no_pressure():
    inp = _make_input(y=0.0, intrinsic_value=100.0)
    state = TickState(sim_day=0, market_factor_return=0.0, companies=(inp,))
    result = run_tick(state)
    price = result.outputs[0].price
    assert math.isclose(price, 100.0, rel_tol=0.01)


def test_run_tick_positive_pressure_increases_price():
    inp_zero = _make_input(company_id=1, y=0.0, driver_values={"v": 0.0}, driver_weights={"v": 1.0})
    inp_pos = _make_input(company_id=2, y=0.0, driver_values={"v": 0.5}, driver_weights={"v": 1.0})
    state = TickState(sim_day=0, market_factor_return=0.0, companies=(inp_zero, inp_pos))
    result = run_tick(state)
    price_zero = result.outputs[0].price
    price_pos = result.outputs[1].price
    assert price_pos > price_zero


def test_run_tick_multiple_companies_preserves_order():
    inps = tuple(_make_input(company_id=i) for i in range(5))
    state = TickState(sim_day=1, market_factor_return=0.0, companies=inps)
    result = run_tick(state)
    assert len(result.outputs) == 5
    for i, out in enumerate(result.outputs):
        assert out.company_id == i


def test_run_tick_y_mean_reverts_toward_zero():
    inp = _make_input(y=1.0, theta=0.1)
    state = TickState(sim_day=0, market_factor_return=0.0, companies=(inp,))
    result = run_tick(state)
    assert abs(result.outputs[0].y) < 1.0


def test_run_tick_market_return_moves_all_prices():
    inp = _make_input(y=0.0, beta_market=1.0)
    state_pos = TickState(sim_day=0, market_factor_return=0.05, companies=(inp,))
    state_neg = TickState(sim_day=0, market_factor_return=-0.05, companies=(inp,))
    result_pos = run_tick(state_pos)
    result_neg = run_tick(state_neg)
    assert result_pos.outputs[0].price > result_neg.outputs[0].price


def test_run_tick_vectorized_consistency():
    inps = tuple(
        _make_input(company_id=i, y=float(i) * 0.1, theta=0.05 + 0.01 * i)
        for i in range(3)
    )
    state = TickState(sim_day=0, market_factor_return=0.0, companies=inps)
    result = run_tick(state)
    assert len(result.outputs) == 3
    for out in result.outputs:
        assert out.y != 0.0 or out.price == 100.0
