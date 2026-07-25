# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A retail investor learning to trade in a risk-free simulated environment. The user practices trading strategies, builds portfolios, and studies market behavior without real financial risk.

## Product Purpose

A realistic stock market simulation with a professional-grade trading terminal UI. Users can trade simulated equities, analyze portfolios with technical indicators and charting tools, and explore alternative market scenarios through timeline branching.

## Positioning

A professional trading terminal experience backed by a realistic simulation engine, not a gamified stock game. The interface, data density, and tooling match real trading platforms — charts, technical indicators, drawing tools, portfolio analytics, and AI-powered financial analysis.

## Operating Context

Single-user web application accessed via desktop browser. Sessions involve monitoring a portfolio, executing trades through the Trading Desk, analyzing charts with technical tools, and optionally exploring branched timelines (Future Lab) to see how alternative market conditions would have affected holdings.

## Capabilities and Constraints

- Real-time simulated market with a tick-level price engine
- Full trading lifecycle: market/limit/stop orders, fills, portfolio tracking
- Professional charting: 6 chart types, 15 technical indicators, 12 drawing tools
- Portfolio analytics: P&L, risk metrics (VaR, Sharpe, beta), sector allocation
- AI Financial Advisor with Gemini: metric explanations, portfolio/company reviews, news analysis, strategy builder, chat
- Replay mode: scrub through past simulation dates at variable speed with bookmarks
- Future Lab: create branched timelines to explore "what-if" market scenarios
- Notifications: price alerts, watchlist movers, trade confirmations via WebSocket
- Single-user (no multiplayer), desktop-first, no mobile layout
- Simulation engine not designed for millisecond-level tick accuracy

## Brand Commitments

- Name: Stock Sim
- Dark theme with #8b7cf6 purple iris accent, mer-* CSS token system
- Minimalist, serious financial tone — clean, no gamification, no confetti or badges
- Educational but not didactic: the UI treats the user as a capable adult who wants to learn by doing

## Evidence on Hand

- Complete source at `apps/web/` (Next.js 15) and `apps/api/` (FastAPI)
- Functional dark-theme design system in `apps/web/components/dashboard/primitives/tokens.ts`
- AI Financial Advisor using Google Gemini API (`gemini-3.5-flash`)
- Real company data, price history, and financial statements in PostgreSQL
- No real user research, usability tests, or conversion data — this is a solo-built project

## Product Principles

1. **Realism over gamification** — every feature should feel like a tool a real trader would use, not a video game mechanic.
2. **Data density with clarity** — show the information a trader needs without overwhelming; use progressive disclosure, not simplification.
3. **Simulation integrity** — the engine's behavior must be internally consistent; users can lose simulated money.
4. **Every number has a source** — AI analysis cites specific fields; no fabricated figures.
5. **Self-directed learning** — the app teaches through use, not through tutorials or pop-ups.

## Accessibility & Inclusion

No product-specific accessibility requirements established yet. Standard WCAG compliance assumed as baseline.
