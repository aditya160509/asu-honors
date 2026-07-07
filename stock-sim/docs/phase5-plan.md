# Phase 5 — Backend APIs: Build Plan

> **Scope:** FastAPI REST layer over engine + DB — auth, market data, trading, simulation control, admin.
> **Status:** ⬜ Not started
> **Depends on:** Phases 1–4 (engine, DB, seeds)
> **New directory:** `apps/api/`

---

## 0. Prerequisites — Update `pyproject.toml`

**File:** `pyproject.toml`

| Change | Why |
|--------|-----|
| Add `"apps/api"` to `[tool.setuptools.packages.find].include` | So `apps/api/` is importable |
| Add `"python-jose[cryptography]>=3.3"` to `dependencies` | JWT token creation/validation |
| Add `"httpx>=0.27"` to `[project.optional-dependencies].dev` | Async test client for FastAPI tests |

The `apps/api/setup.py` or `apps/api/pyproject.toml` is **not needed** — the monorepo's single `pyproject.toml` at root covers all Python packages.

---

## 1. Application Entry Point

### `apps/api/__init__.py`

**What:** Empty init to make the directory a package.
**Content:** Blank file (or just a docstring).

### `apps/api/main.py` — FastAPI Application

**What:** Creates the FastAPI `app`, registers routers, middleware, exception handlers, and startup/shutdown events.

**Imports:**
- `from fastapi import FastAPI`
- `from fastapi.middleware.cors import CORSMiddleware`
- All routers from `apps.api.routers.*`

**Classes/Functions to define:**

| Name | Kind | Purpose |
|------|------|---------|
| `app` | `FastAPI` instance | Root app with title `"Stock-Sim API"`, version `"0.1.0"` |
| `create_app()` | Factory function | Optional — returns `app` after registering routers/middleware. Makes testing easier. |

**Implementation details:**
- Set `docs_url="/docs"`, `redoc_url="/redoc"` for OpenAPI docs
- Add CORS middleware allowing `["*"]` (tighten before prod)
- Include routers with prefixes: `market_router` → `/api/v1`, `trading_router` → `/api/v1`, `simulation_router` → `/api/v1`, `news_router` → `/api/v1`, `leaderboard_router` → `/api/v1`
- Register exception handlers from `apps.api.exceptions`
- On startup: no-op (engine does not hold connection state)
- On shutdown: no-op

**Route registration table:**

| Router module | Prefix | Tags |
|--------------|--------|------|
| `market_router` | `/api/v1` | `["Market Data"]` |
| `trading_router` | `/api/v1` | `["Trading & Portfolio"]` |
| `simulation_router` | `/api/v1` | `["Simulation Control"]` |
| `news_router` | `/api/v1` | `["News"]` |
| `leaderboard_router` | `/api/v1` | `["Leaderboard"]` |

### `apps/api/config.py` — Application Settings

**What:** Pydantic-settings-based configuration loaded from environment variables.

**Imports:**
- `from pydantic_settings import BaseSettings`
- `from typing import Optional`

**Classes/Functions to define:**

| Name | Kind | Purpose |
|------|------|---------|
| `Settings(BaseSettings)` | Class | All config values with env var prefixes |

**Fields:**

| Field | Type | Default | Env Var | Purpose |
|-------|------|---------|---------|---------|
| `database_url` | `str` | `"postgresql+psycopg://stocksim:stocksim@localhost:5432/stocksim"` | `DATABASE_URL` | Postgres connection |
| `secret_key` | `str` | `"dev-secret-key-change-in-prod"` | `SECRET_KEY` | JWT signing key |
| `algorithm` | `str` | `"HS256"` | `JWT_ALGORITHM` | JWT algorithm |
| `access_token_expire_minutes` | `int` | `1440` | `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime (24h) |
| `api_host` | `str` | `"0.0.0.0"` | `API_HOST` | Bind address |
| `api_port` | `int` | `8000` | `API_PORT` | Listen port |
| `redis_url` | `Optional[str]` | `None` | `REDIS_URL` | Optional Redis for quote caching |
| `default_timeline_id` | `int` | `1` | `DEFAULT_TIMELINE_ID` | Live timeline |

**How to use:** `settings = Settings()` singleton at module level. Import where needed.

### `apps/api/database.py` — DB Session Dependency

**What:** Creates the SQLAlchemy engine and sessionmaker, provides FastAPI `Depends` callable for route handlers.

**Imports:**
- `from sqlalchemy import create_engine`
- `from sqlalchemy.orm import sessionmaker, Session`
- `from apps.api.config import settings`

**Classes/Functions to define:**

| Name | Kind | Purpose |
|------|------|---------|
| `engine` | Module-level `Engine` | Created once from `settings.database_url` |
| `SessionLocal` | `sessionmaker` | Bound to engine, `autocommit=False`, `autoflush=False` |
| `get_db()` | Generator function | Yields `Session`, ensures close on exit. Use as `Depends(get_db)` in routes. |

**Implementation details:**
```python
engine = create_engine(settings.database_url, pool_size=10, max_overflow=20)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

---

## 2. Schemas — Pydantic Request/Response Models

### `apps/api/schemas.py`

**What:** All Pydantic models for request validation and response serialization. Match the DB model fields but are flat, safe for JSON.

**Imports:**
- `from pydantic import BaseModel, Field, field_validator`
- `from datetime import date, datetime`
- `from decimal import Decimal`
- `from typing import Optional, List`

**Classes to define (grouped by domain):**

#### 2.1 Auth Schemas

| Class | Fields | Purpose |
|-------|--------|---------|
| `TokenResponse` | `access_token: str`, `token_type: str = "bearer"` | JWT login response |
| `LoginRequest` | `email: str`, `password: str` | Login body |
| `UserCreateRequest` | `email: str`, `password: str`, `display_name: str` | Registration body |
| `UserResponse` | `id: int`, `email: str`, `display_name: str`, `role: str`, `starting_cash: Decimal` | Public user info |

#### 2.2 Market Data Schemas

| Class | Fields | Purpose |
|-------|--------|---------|
| `CompanyGridItem` | `ticker: str`, `name: str`, `industry_name: str`, `current_price: Decimal`, `prev_close: Optional[Decimal]`, `day_change_pct: Optional[float]`, `intrinsic_value: Optional[Decimal]`, `market_cap: Optional[Decimal]`, `volatility: Optional[Decimal]` | Market grid row |
| `MarketGridResponse` | `companies: List[CompanyGridItem]`, `sim_date: date`, `cycle_phase: str` | Wrapper with sim state |
| `PriceHistoryItem` | `sim_date: date`, `open: Decimal`, `high: Decimal`, `low: Decimal`, `close: Decimal`, `volume: int`, `intrinsic_value: Optional[Decimal]` | OHLCV bar |
| `DriverBreakdown` | `driver_key: str`, `value: float`, `weight: float`, `contribution: float` | Per-driver breakdown |
| `CompanyDetail` | All company fields + `industry_name`, `latest_price`, `latest_iv`, `pe_ratio`, `driver_breakdowns: List[DriverBreakdown]` | Full company profile |
| `FinancialStatementResponse` | `fiscal_period: str`, line items per statement | Income/Balance/CF |
| `ValuationResponse` | `intrinsic_value: Decimal`, `fair_pe: Decimal`, `intrinsic_score: float`, `management_quality: float`, `moat_score: float`, `financial_quality: float`, `fcf_quality: float`, `growth_potential: float` | IV decomposition |
| `CycleStateResponse` | `sim_date: date`, `cycle_phase: str`, `market_factor_return: float`, `gdp_growth: float`, `interest_rate: float`, `market_sentiment: float` | Economic cycle state |

#### 2.3 Trading Schemas

| Class | Fields | Purpose |
|-------|--------|---------|
| `OrderRequest` | `ticker: str`, `side: str` (`"buy"\|"sell"`), `quantity: int`, `order_type: str = "market"` | Place order body |
| `OrderResponse` | `id: int`, `portfolio_id: int`, `company_id: int`, `sim_date: date`, `side: str`, `quantity: int`, `price: Decimal`, `fees: Decimal`, `realized_pnl: Optional[Decimal]` | Order confirmation |
| `HoldingResponse` | `ticker: str`, `company_name: str`, `quantity: int`, `avg_cost_basis: Decimal`, `current_price: Decimal`, `market_value: Decimal`, `unrealized_pnl: Decimal`, `unrealized_pnl_pct: float` | Position view |
| `PortfolioResponse` | `id: int`, `cash_balance: Decimal`, `total_value: Decimal`, `holdings: List[HoldingResponse]`, `day_change_pct: Optional[float]` | Full portfolio |
| `TransactionItem` | `id: int`, `sim_date: date`, `ticker: str`, `side: str`, `quantity: int`, `price: Decimal`, `realized_pnl: Optional[Decimal]` | Transaction ledger row |
| `WatchlistItem` | `company_id: int`, `ticker: str`, `name: str` | Watchlist entry |
| `LeaderboardEntry` | `rank: int`, `display_name: str`, `total_value: Decimal`, `return_pct: float` | Leaderboard row |

#### 2.4 News Schemas

| Class | Fields | Purpose |
|-------|--------|---------|
| `NewsItem` | `id: int`, `sim_date: date`, `headline: str`, `body: str`, `sentiment: str`, `severity: str`, `company_name: Optional[str]`, `industry_name: Optional[str]` | News feed row |

#### 2.5 Simulation Schemas

| Class | Fields | Purpose |
|-------|--------|---------|
| `AdvanceRequest` | `timeline_id: int = 1`, `days: int = 1` | Advance N ticks |
| `AdvanceResponse` | `ticks_executed: int`, `new_sim_date: date`, `tick_count: int`, `cycle_phase: str` | Advance result |
| `TimelineCreateRequest` | `name: str`, `parent_timeline_id: int`, `branch_point_sim_date: date`, `rng_seed: Optional[int]`, `scenario_overrides: Optional[dict]` | Branch request |
| `TimelineResponse` | `id: int`, `name: str`, `is_live: bool`, `parent_timeline_id: Optional[int]`, `branch_point_sim_date: Optional[date]`, `created_at: datetime` | Timeline info |
| `EventInjectRequest` | `event_id: int`, `timeline_id: int = 1`, `scope_type: str`, `scope_ref: int`, `sim_date: Optional[date]`, `severity_override: Optional[float]` | Inject event body |
| `ConfigUpdateRequest` | `key: str`, `value: str`, `scope: str = "global"`, `scope_id: Optional[int]` | Update config param |

---

## 3. Routers — Route Handlers

### `apps/api/routers/__init__.py`

**What:** Empty init.

### `apps/api/routers/auth.py`

**What:** Registration and login endpoints.

**Imports:**
- `from fastapi import APIRouter, Depends, HTTPException, status`
- `from sqlalchemy.orm import Session`
- `from apps.api.database import get_db`
- `from apps.api.schemas import LoginRequest, TokenResponse, UserCreateRequest, UserResponse`
- `from apps.api.auth import create_access_token, hash_password, verify_password` (see §4)
- `from db.models import User`

**Router:** `router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])`

**Endpoints:**

| Method | Path | Request | Response | Logic |
|--------|------|---------|----------|-------|
| `POST` | `/register` | `UserCreateRequest` | `UserResponse`, status 201 | Check email not taken, hash password, create User row, return user |
| `POST` | `/login` | `LoginRequest` | `TokenResponse`, 200 | Find user by email, verify password, create JWT with `sub=user.id`, return `{"access_token": ..., "token_type": "bearer"}` |
| `GET` | `/me` | (JWT) | `UserResponse` | Return current user from token |

**Validation rules:**
- Email must not already exist in `users` table
- Password must be ≥ 8 characters
- On login, wrong email or password → `401` with `"Invalid credentials"` (do not reveal which)

### `apps/api/routers/market.py`

**What:** Market data read-only endpoints.

**Imports:**
- `from fastapi import APIRouter, Depends, Query, HTTPException`
- `from sqlalchemy.orm import Session`
- `from apps.api.database import get_db`
- `from apps.api.schemas import *`
- `from apps.api.services.market_service import *`
- `from apps.api.auth import get_current_user_optional` (optional auth)

**Router:** `router = APIRouter(prefix="/api/v1", tags=["Market Data"])`

**Endpoints:**

| Method | Path | Query Params | Response | Logic |
|--------|------|-------------|----------|-------|
| `GET` | `/market` | `timeline_id: int = 1` | `MarketGridResponse` | Load all companies with latest prices, compute day_change_pct from previous close, include sim_date + cycle_phase |
| `GET` | `/companies/{ticker}` | `timeline_id: int = 1` | `CompanyDetail` | Load company + latest price + today's driver breakdowns; 404 if ticker not found |
| `GET` | `/companies/{ticker}/history` | `timeline_id=1, from_date, to_date, interval=daily` | `List[PriceHistoryItem]` | Query price_history; interval filtering (daily/weekly/monthly) done client-side or via custom query |
| `GET` | `/companies/{ticker}/drivers` | `timeline_id=1, sim_date: Optional[date]` | `List[DriverBreakdown]` | Query price_driver_scores for most recent (or specified) sim_date |
| `GET` | `/companies/{ticker}/financials` | `period: Optional[str]` | `FinancialStatementResponse` | Get income/balance/cashflow for latest (or specified) fiscal_period |
| `GET` | `/companies/{ticker}/valuation` | `timeline_id=1` | `ValuationResponse` | Get latest CompanyFactorScore row |
| `GET` | `/market/cycle` | `timeline_id=1` | `CycleStateResponse` | Get latest EconomicCycleState row |

**Implementation notes for `/market`:**
```python
def get_market_grid(db: Session, timeline_id: int) -> MarketGridResponse:
    companies = db.query(Company).order_by(Company.ticker).all()
    sim_state = db.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    # For each company, find prev day close from price_history
    # Compute day_change_pct = (current_price - prev_close) / prev_close * 100
    ...
```
- Day change needs the previous sim-day's close from `price_history`. Query once per company or batch with a subquery.
- 404 on unknown ticker for all `/companies/{ticker}` routes.

### `apps/api/routers/trading.py`

**What:** Portfolio, orders, watchlist — all require JWT auth.

**Imports:**
- `from fastapi import APIRouter, Depends, HTTPException, status`
- `from sqlalchemy.orm import Session`
- `from apps.api.database import get_db`
- `from apps.api.auth import get_current_user`
- `from apps.api.schemas import *`
- `from apps.api.services.trade_service import place_order`
- `from db.models import Portfolio, Holding, Transaction, Watchlist, Company`

**Router:** `router = APIRouter(prefix="/api/v1", tags=["Trading & Portfolio"])` + `dependencies=[Depends(get_current_user)]`

**Endpoints:**

| Method | Path | Request/Body | Response | Logic |
|--------|------|-------------|----------|-------|
| `GET` | `/portfolio` | query: `timeline_id=1` | `PortfolioResponse` | Get user's portfolio for timeline, include holdings with current prices, compute unrealized PnL |
| `GET` | `/portfolio/history` | query: `timeline_id=1` | `List[PortfolioHistoryPoint]` | (If we add a portfolio_history table or compute from transactions) |
| `POST` | `/orders` | `OrderRequest` | `OrderResponse`, 201 | Validate → execute → write transaction → update holdings/cash |
| `GET` | `/transactions` | query: `timeline_id=1, limit=50, offset=0` | `List[TransactionItem]` | User's transaction ledger |
| `GET` | `/watchlist` | — | `List[WatchlistItem]` | User's watchlisted companies |
| `POST` | `/watchlist` | body: `{"company_id": int}` | `WatchlistItem`, 201 | Add company to watchlist |
| `DELETE` | `/watchlist/{company_id}` | — | 204 | Remove from watchlist |

**Order execution logic (`trade_service.place_order`):**
1. Load user's portfolio + company + latest price
2. Validate: ticker exists, quantity > 0, side is "buy" or "sell"
3. If buy: check `cash_balance >= quantity * price`. If sell: check `Holding.quantity >= quantity`
4. Apply Kyle's lambda price impact:
   - `lambda_val = kyle_lambda_from_liquidity(company.market_liquidity_score or default)`
   - `impact = kyle_lambda_impact(lambda_val, quantity)`
   - Execution price = `current_price + (impact if buy else -impact)`
5. Compute fees: `fees = quantity * execution_price * 0.001` (0.1% — configurable via `config_parameters`)
6. Write `Transaction` row (side, quantity, execution_price, fees, realized_pnl for sells)
7. Update `Holding`:
   - Buy: insert or update with avg cost basis: `new_avg = (old_qty * old_cost + qty * price) / (old_qty + qty)`
   - Sell: reduce quantity; if quantity reaches 0, delete row. realized_pnl = `(sell_price - avg_cost_basis) * qty`
8. Update `Portfolio.cash_balance` and `total_value`
9. Return `Transaction` as `OrderResponse`

**Portfolio response:**
```python
def get_portfolio(db, user_id, timeline_id):
    portfolio = db.query(Portfolio).filter_by(user_id=user_id, timeline_id=timeline_id).first()
    if not portfolio:
        raise HTTPException(404, "Portfolio not found")
    holdings = db.query(Holding).filter_by(portfolio_id=portfolio.id).all()
    # Enrich each holding with current price, compute unrealized PnL
    ...
    return PortfolioResponse(...)
```

### `apps/api/routers/simulation.py`

**What:** Simulation control — advance ticks, branch timelines, admin controls.

**Imports:**
- `from fastapi import APIRouter, Depends, HTTPException`
- `from sqlalchemy.orm import Session`
- `from apps.api.database import get_db`
- `from apps.api.auth import get_current_user, require_admin`
- `from apps.api.schemas import *`
- `from engine.orchestrator import run_tick, run_ticks`
- `from db.models import SimulationState, Timeline`
- `from apps.api.services.sim_service import create_branch_timeline, inject_event, update_config`

**Router:** `router = APIRouter(prefix="/api/v1/sim", tags=["Simulation Control"])`

**Endpoints:**

| Method | Path | Auth | Request | Response | Logic |
|--------|------|------|---------|----------|-------|
| `POST` | `/advance` | Any | `AdvanceRequest` | `AdvanceResponse` | Call `run_ticks(db, timeline_id, days)`, return result |
| `POST` | `/timelines` | Any | `TimelineCreateRequest` | `TimelineResponse`, 201 | Create branched timeline |
| `GET` | `/timelines` | Any | — | `List[TimelineResponse]` | List all timelines for user |
| `GET` | `/state` | Any | query: `timeline_id=1` | `SimulationState` fields | Get current sim date, tick count |
| `POST` | `/admin/events` | Admin | `EventInjectRequest` | `EventInstance`, 201 | Create EventInstance row with optional severity override |
| `PUT` | `/admin/config` | Admin | `ConfigUpdateRequest` | `ConfigParameter`, 200 | Upsert config_parameter value |
| `GET` | `/admin/config` | Admin | query: `scope=global` | `List[ConfigParameter]` | List config parameters |

**Admin check:** `require_admin` is a dependency that checks `current_user.role == "admin"`. Raise `403` if not.

**Branch timeline logic (`sim_service.create_branch_timeline`):**
1. Validate parent_timeline_id exists and has history up to branch_point_sim_date
2. Create new `Timeline` with `parent_timeline_id`, `is_live=False`, `rng_seed` (use hash of name + time if not provided)
3. Create `SimulationState` for the new timeline, copying parent's `current_sim_date`, `tick_count`
4. If `scenario_overrides` provided, apply them:
   - `{"economic_cycle": "recession"}` → force cycle phase
   - `{"config_overrides": {"k_drift": 0.02}}` → create timeline-scoped config overrides
5. Return new timeline

### `apps/api/routers/news.py`

**What:** News feed endpoint.

**Imports:**
- `from fastapi import APIRouter, Depends, Query`
- `from sqlalchemy.orm import Session`
- `from apps.api.database import get_db`
- `from apps.api.schemas import NewsItem`
- `from db.models import NewsFeed`

**Router:** `router = APIRouter(prefix="/api/v1/news", tags=["News"])`

**Endpoints:**

| Method | Path | Query Params | Response | Logic |
|--------|------|-------------|----------|-------|
| `GET` | `/` | `timeline_id=1, sim_date: Optional[date], company_id: Optional[int], limit=50, offset=0` | `List[NewsItem]` | Query news_feed filtered by timeline, optional date/company, order by sim_date DESC |

### `apps/api/routers/leaderboard.py`

**What:** Leaderboard endpoint.

**Imports:**
- `from fastapi import APIRouter, Depends, Query`
- `from sqlalchemy.orm import Session`
- `from apps.api.database import get_db`
- `from apps.api.schemas import LeaderboardEntry`
- `from db.models import Portfolio, User`

**Router:** `router = APIRouter(prefix="/api/v1/leaderboard", tags=["Leaderboard"])`

**Endpoints:**

| Method | Path | Query Params | Response | Logic |
|--------|------|-------------|----------|-------|
| `GET` | `/` | `timeline_id=1, limit=20` | `List[LeaderboardEntry]` | Join Portfolio + User, filter by timeline_id, order by total_value DESC, assign rank |

---

## 4. Dependencies & Auth

### `apps/api/dependencies.py`

**What:** Shared FastAPI dependencies beyond `get_db`.

**Imports:**
- `from fastapi import Depends`
- `from sqlalchemy.orm import Session`
- `from apps.api.database import get_db`
- `from apps.api.auth import get_current_user`

**Functions to define:**

| Name | Purpose |
|------|---------|
| `get_user_portfolio(timeline_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user))` | Load Portfolio for (user, timeline), 404 if missing |
| `get_company_by_ticker(ticker: str, db: Session = Depends(get_db))` | Load Company by ticker, 404 if missing |

These DRY up common patterns across routers.

### `apps/api/auth.py` — Auth & JWT

**What:** Password hashing, JWT creation/validation, FastAPI dependency for current user.

**Imports:**
- `from datetime import datetime, timedelta, timezone`
- `from typing import Optional`
- `from fastapi import Depends, HTTPException, status`
- `from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials`
- `from jose import JWTError, jwt`
- `import bcrypt`
- `from sqlalchemy.orm import Session`
- `from apps.api.config import settings`
- `from apps.api.database import get_db`
- `from db.models import User`

**Classes/Functions to define:**

| Name | Kind | Purpose |
|------|------|---------|
| `pwd_context` | Module-level | `CryptContext(schemes=["bcrypt"], deprecated="auto")` — OR use `bcrypt` directly |
| `hash_password(password: str)` | Function | Returns bcrypt hash |
| `verify_password(plain: str, hashed: str)` | Function | Returns bool |
| `create_access_token(data: dict, expires_delta: Optional[timedelta])` | Function | Encode JWT with `sub`, `exp`, `iat` claims |
| `security` | `HTTPBearer` | Auto-extracts Bearer token from `Authorization` header |
| `get_current_user(token: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db))` | Dependency | Decode JWT → extract `sub` (user_id) → query User → return user or 401 |
| `get_current_user_optional(...)` | Dependency | Same but returns `None` instead of 401 if no token. Used on market endpoints that don't require auth. |
| `require_admin(current_user: User = Depends(get_current_user))` | Dependency | Check `current_user.role == "admin"`, raise 403 if not |

**JWT payload structure:**
```json
{
  "sub": "123",
  "exp": 1700000000,
  "iat": 1699913600,
  "role": "user"
}
```

**Implementation of `create_access_token`:**
```python
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
```

**Implementation of `get_current_user`:**
```python
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user
```

### `apps/api/exceptions.py` — Error Handling

**What:** Custom exception classes and FastAPI exception handlers for consistent error responses.

**Imports:**
- `from fastapi import Request, HTTPException`
- `from fastapi.responses import JSONResponse`

**Classes/Functions to define:**

| Name | Kind | Purpose |
|------|------|---------|
| `NotFoundError(HTTPException)` | Class | 404 with detail message |
| `ValidationError(HTTPException)` | Class | 422 with detail |
| `InsufficientFundsError(HTTPException)` | Class | 400 — "Insufficient cash" |
| `InsufficientSharesError(HTTPException)` | Class | 400 — "Not enough shares" |
| `add_exception_handlers(app: FastAPI)` | Function | Register handlers that return `{"detail": ..., "error_code": ...}` |

**Response format for all errors:**
```json
{
  "detail": "Human-readable message",
  "error_code": "INSUFFICIENT_FUNDS"
}
```

---

## 5. Service Layer

### `apps/api/services/__init__.py`

**What:** Empty init.

### `apps/api/services/market_service.py`

**What:** Business logic for market data queries — keeps routers thin.

**Imports:**
- `from sqlalchemy.orm import Session`
- `from sqlalchemy import desc`
- `from datetime import date`
- `from db.models import Company, PriceHistory, PriceDriverScore, SimulationState, EconomicCycleState, CompanyFactorScore, Industry`
- `from apps.api.schemas import CompanyGridItem, MarketGridResponse, DriverBreakdown, ...`

**Functions to define:**

| Name | Purpose |
|------|---------|
| `get_market_grid(db, timeline_id)` | Build `MarketGridResponse` — batch all companies, prev-close subquery, day change |
| `get_company_detail(db, ticker, timeline_id)` | Build `CompanyDetail` — company + latest price + drivers |
| `get_price_history(db, ticker, timeline_id, from_date, to_date)` | Query `PriceHistory` rows, return as `List[PriceHistoryItem]` |
| `get_driver_breakdowns(db, ticker, timeline_id, sim_date)` | Get driver scores for a company |
| `get_financials(db, ticker, fiscal_period)` | Income + Balance + CashFlow for the given period |
| `get_valuation(db, ticker, timeline_id)` | Latest `CompanyFactorScore` |

**Implement each as pure query functions that return schema objects.** No DB writes in market_service.

### `apps/api/services/trade_service.py`

**What:** Order validation, execution, and transaction ledger management.

**Imports:**
- `from sqlalchemy.orm import Session`
- `from decimal import Decimal`
- `from db.models import Company, Portfolio, Holding, Transaction, User`
- `from engine.liquidity import kyle_lambda_from_liquidity, kyle_lambda_impact`
- `from apps.api.schemas import OrderRequest, OrderResponse`

**Functions to define:**

| Name | Purpose |
|------|---------|
| `place_order(db, user, request, timeline_id)` | Full order lifecycle: validate → execute → write → return |
| `_validate_order(db, company, portfolio, side, quantity, price)` | Check cash/shares availability |
| `_execute_buy(db, portfolio, company, quantity, price, fees, sim_date)` | Write Transaction, update Holding, update cash |
| `_execute_sell(db, portfolio, company, quantity, price, fees, sim_date, avg_cost)` | Write Transaction with realized_pnl, update Holding, update cash |
| `_compute_realized_pnl(buy_cost, sell_price, quantity)` | `(sell_price - avg_cost_basis) * quantity` |

**Kyle's lambda for price impact:**
```python
def _compute_impact(company: Company, quantity: int, db: Session) -> tuple[Decimal, Decimal]:
    liq_score = float(company.market_liquidity_score or 0.5)
    lambda_val = kyle_lambda_from_liquidity(liq_score)
    impact = float(kyle_lambda_impact(lambda_val, quantity))
    # impact is in price-space ($ per share)
    return Decimal(str(impact)), Decimal(str(lambda_val))
```

**Fee computation:**
- Fee rate from `config_parameters` key `trade_fee_rate` (default `0.001`)
- `fees = quantity * execution_price * fee_rate`

### `apps/api/services/sim_service.py`

**What:** Simulation control — advance ticks, timeline branching, admin operations.

**Imports:**
- `from sqlalchemy.orm import Session`
- `from datetime import date, datetime, timezone`
- `from db.models import Timeline, SimulationState, EventInstance, MarketEvent, ConfigParameter`
- `from engine.orchestrator import run_tick, run_ticks`

**Functions to define:**

| Name | Purpose |
|------|---------|
| `advance_simulation(db, timeline_id, days)` | Call `run_ticks`, return summary |
| `create_branch_timeline(db, user_id, name, parent_id, branch_date, rng_seed, overrides)` | Create branched timeline + sim state |
| `inject_event(db, event_id, timeline_id, scope_type, scope_ref, sim_date, severity)` | Create EventInstance row |
| `update_config_parameter(db, key, value, scope, scope_id)` | Upsert ConfigParameter |

---

## 6. Tests

### `apps/api/tests/__init__.py`

**What:** Empty init.

### `apps/api/tests/conftest.py`

**What:** Pytest fixtures for API tests.

**Imports:**
- `from fastapi.testclient import TestClient`
- `import pytest`
- `from apps.api.main import app`
- `from apps.api.database import get_db`
- (testing DB via SQLite in-memory or test Postgres)

**Fixtures to define:**

| Fixture | Scope | Purpose |
|---------|-------|---------|
| `test_db` | function | Create in-memory SQLite DB with all tables, yield session, drop |
| `client` | function | `TestClient(app)` with `app.dependency_overrides[get_db] = lambda: test_db` |
| `test_user` | function | Create a User row with hashed password "password" |
| `auth_headers` | function | Generate JWT for test_user → `{"Authorization": "Bearer <token>"}` |
| `test_company` | function | Create a Company row with ticker, price, etc. |
| `test_portfolio` | function | Create Portfolio + initial cash for test_user |

**Testing DB approach:** Use SQLite (`sqlite:///:memory:`) since the queries are read-only or simple CRUD. Engine test coverage already exists — API tests focus on route behavior, auth, validation, serialization.

Create tables in `test_db` fixture:
```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from db.models import Base

engine = create_engine("sqlite:///:memory:")
TestingSessionLocal = sessionmaker(bind=engine)

@pytest.fixture
def test_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
    Base.metadata.drop_all(bind=engine)
```

### `apps/api/tests/test_auth.py`

**Test cases:**

| Test | What it verifies |
|------|-----------------|
| `test_register_success` | POST `/api/v1/auth/register` returns 201 + UserResponse |
| `test_register_duplicate_email` | Same email returns 409 |
| `test_login_success` | POST `/api/v1/auth/login` returns TokenResponse |
| `test_login_wrong_password` | Returns 401 |
| `test_login_nonexistent_user` | Returns 401 |
| `test_me_authenticated` | GET `/api/v1/auth/me` with token returns UserResponse |
| `test_me_no_token` | Returns 401 |
| `test_me_invalid_token` | Returns 401 |

### `apps/api/tests/test_market.py`

**Test cases:**

| Test | What it verifies |
|------|-----------------|
| `test_get_market_grid` | Returns 200 with list of companies |
| `test_get_market_grid_includes_sim_date` | Response has sim_date and cycle_phase |
| `test_get_company_by_ticker` | Returns CompanyDetail with correct ticker |
| `test_get_company_not_found` | Unknown ticker returns 404 |
| `test_get_price_history` | Returns list of OHLCV bars |
| `test_get_drivers` | Returns list of driver breakdowns |
| `test_get_financials` | Returns financial statement data |
| `test_get_valuation` | Returns valuation decomposition |
| `test_get_cycle_state` | Returns economic cycle state |

### `apps/api/tests/test_trading.py`

**Test cases:**

| Test | What it verifies |
|------|-----------------|
| `test_get_portfolio_no_auth` | Returns 401 without token |
| `test_get_portfolio_empty` | Empty portfolio returns cash_balance = starting_cash |
| `test_place_buy_order` | POST order with sufficient cash → 201 + Holding created + cash reduced |
| `test_place_buy_insufficient_funds` | Order for more than cash → 400 error |
| `test_place_sell_order` | Sell existing holding → Transaction + reduced quantity + cash increased |
| `test_place_sell_no_holding` | Sell unowned ticker → 400 |
| `test_place_sell_excess_shares` | Sell more than owned → 400 |
| `test_order_price_impact` | Large order moves price (verify from Transaction price differs from current) |
| `test_get_transactions` | Returns ledger in reverse chronological |
| `test_watchlist_add` | POST → 201 with WatchlistItem |
| `test_watchlist_delete` | DELETE → 204, subsequent GET excludes it |
| `test_watchlist_duplicate_add` | Adding same company → 409 |

### `apps/api/tests/test_simulation.py`

**Test cases:**

| Test | What it verifies |
|------|-----------------|
| `test_advance_ticks` | POST `/api/v1/sim/advance` with `days=5` returns 5 ticks executed |
| `test_advance_idempotent` | Same tick range → skipped (idempotent) |
| `test_get_sim_state` | Returns current sim_date + tick_count |
| `test_create_timeline_branch` | POST `/api/v1/sim/timelines` with valid parent → 201 with new Timeline |
| `test_create_timeline_invalid_parent` | Non-existent parent → 404 |
| `test_inject_event` | POST `/api/v1/sim/admin/events` as admin → 201 with EventInstance |
| `test_inject_event_not_admin` | As non-admin → 403 |
| `test_update_config` | PUT `/api/v1/sim/admin/config` as admin → 200 |
| `test_get_config` | Returns list of config params |
| `test_list_timelines` | Returns at least the live timeline |

---

## 7. File Manifest (Files to Create)

```
apps/api/
├── __init__.py                    # Empty
├── main.py                        # FastAPI app, middleware, router registration
├── config.py                      # Pydantic-settings (database_url, secret_key, ...)
├── database.py                    # SQLAlchemy engine + sessionmaker + get_db()
├── auth.py                        # JWT, bcrypt, get_current_user, require_admin
├── schemas.py                     # All Pydantic models
├── dependencies.py                # Shared Depends utilities
├── exceptions.py                  # Custom HTTP exceptions + handlers
├── routers/
│   ├── __init__.py                # Empty
│   ├── auth.py                    # /register, /login, /me
│   ├── market.py                  # /market, /companies/{ticker}/...
│   ├── trading.py                 # /orders, /portfolio, /watchlist
│   ├── simulation.py              # /sim/advance, /sim/timelines, /admin/*
│   ├── news.py                    # /news
│   └── leaderboard.py             # /leaderboard
├── services/
│   ├── __init__.py                # Empty
│   ├── market_service.py          # Market data query logic
│   ├── trade_service.py           # Order execution + validation
│   └── sim_service.py             # Simulation control + branching
└── tests/
    ├── __init__.py                # Empty
    ├── conftest.py                # Fixtures: test_db, client, test_user, auth_headers
    ├── test_auth.py               # 8 tests
    ├── test_market.py             # 10 tests
    ├── test_trading.py            # 12 tests
    └── test_simulation.py         # 10 tests
```

**Total: 24 new files** (including empty `__init__.py` files), **~40 test cases**.

### Files to Modify

| File | Change |
|------|--------|
| `pyproject.toml` | Add `"apps/api"` to `find.include`, add `python-jose[cryptography]` to deps, add `httpx` to dev deps |

---

## 8. Build Order (Dependency Chain)

Build these files **in this order** — each depends on the last:

```
 1. pyproject.toml  (update deps + package discovery)
 2. apps/api/__init__.py
 3. apps/api/config.py             ← no dependencies
 4. apps/api/database.py           ← depends on config
 5. apps/api/exceptions.py         ← no dependencies
 6. apps/api/schemas.py            ← no dependencies (pure Pydantic)
 7. apps/api/auth.py               ← depends on config, database, schemas
 8. apps/api/dependencies.py       ← depends on database, auth
 9. apps/api/services/market_service.py   ← depends on database, schemas
10. apps/api/services/trade_service.py    ← depends on database, engine.liquidity
11. apps/api/services/sim_service.py      ← depends on database, engine.orchestrator
12. apps/api/routers/auth.py       ← depends on auth, database, schemas
13. apps/api/routers/market.py     ← depends on market_service, dependencies
14. apps/api/routers/trading.py    ← depends on trade_service, auth, dependencies
15. apps/api/routers/simulation.py ← depends on sim_service, auth
16. apps/api/routers/news.py       ← depends on database, schemas
17. apps/api/routers/leaderboard.py ← depends on database, schemas
18. apps/api/main.py               ← depends on all routers, exceptions
19. apps/api/tests/conftest.py     ← depends on main, database
20. apps/api/tests/test_auth.py
21. apps/api/tests/test_market.py
22. apps/api/tests/test_trading.py
23. apps/api/tests/test_simulation.py
```

**Once all 40 tests pass**, Phase 5 is complete — the backend provides every endpoint the frontend needs.

---

## 9. Known Risks & Design Decisions

| Risk | Mitigation |
|------|-----------|
| **SQLite vs Postgres in tests** — SQLite doesn't support JSONB, some Postgres-specific types | Use `JSON` type fallback in test DB, or add Postgres test container. For JSONB: pydantic handles serialization, SQLAlchemy's `JSON` type works on SQLite. |
| **Order execution race conditions** — two concurrent buys could double-spend cash | Use row-level lock: `db.query(Portfolio).with_for_update().filter_by(id=...)` in trade_service |
| **Engine runs synchronously** — `run_ticks` for 100+ days could block the HTTP worker for seconds | Run ticks in a background task (`FastAPI.BackgroundTasks`) or Celery worker for large advances. For small advances (1–5 days), synchronous is fine. |
| **Password hashing in seed data** — existing `seed_demo.py` stores "demo" as plaintext | Keep seed as-is; the auth flow will fail for demo users until their passwords are re-hashed. Either fix seed_demo to store bcrypt hash, or accept that demo users must re-register. |
| **CORS in production** — allowing `["*"]` is insecure | Change to specific origins before deployment |
| **No pagination on market grid** — 150 companies returns as one array | Companies fit in a single response; pagination is overkill. For history endpoints, enforce limit/offset. |

---

## 10. Verification

After building Phase 5, run:

```bash
# Install new deps
pip install -e ".[dev]"

# Run all tests (engine + existing + new API tests)
pytest tests/ apps/api/tests/ -v

# Start server
uvicorn apps.api.main:app --reload --host 0.0.0.0 --port 8000

# Verify OpenAPI docs
open http://localhost:8000/docs

# Health check
curl http://localhost:8000/api/v1/market | jq .
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "password"}' | jq .
```
