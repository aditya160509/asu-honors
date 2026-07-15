# Stock Screener Research — Design Bible

> **Purpose**: Comprehensive analysis of every major stock screener to inform the design of a world-class stock screening interface for stock-sim.
> **Date**: July 2026
> **Status**: Complete

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Per-Screener Deep Dive](#2-per-screener-deep-dive)
   - [Bloomberg Terminal (EQS)](#21-bloomberg-terminal-eqs)
   - [TradingView](#22-tradingview)
   - [Finviz](#23-finviz)
   - [Yahoo Finance](#24-yahoo-finance)
   - [MarketSmith / MarketSurge](#25-marketsmith-marketsurge)
   - [Tastytrade](#26-tastytrade)
   - [Seeking Alpha](#27-seeking-alpha)
   - [Koyfin](#28-koyfin)
   - [StockAnalysis.com](#29-stockanalysiscom)
   - [Simply Wall St](#210-simply-wall-st)
   - [Zacks](#211-zacks)
   - [TipRanks](#212-tipranks)
   - [Stock Rover](#213-stock-rover)
   - [TC2000](#214-tc2000)
   - [Deepvue](#215-deepvue)
3. [Feature Matrix](#3-feature-matrix)
4. [Best Patterns — The Gold Standard](#4-best-patterns--the-gold-standard)
5. [Anti-Patterns — What NOT To Do](#5-anti-patterns--what-not-to-do)
6. [Recommendations for stock-sim](#6-recommendations-for-stock-sim)

---

## 1. Executive Summary

After analyzing 15+ stock screeners across the market, several clear patterns emerge about what the best screeners have in common:

### What the Best Screeners Share

1. **Progressive Disclosure**: The best screeners (Finviz, TradingView, Koyfin) don't overwhelm users with all 150+ filters at once. They reveal complexity gradually — show 5-8 essential filters by default, then let users expand to more.

2. **Filter chips/badges above the results**: Active filters are always visible as removable chips/tags above the table. Users instantly see what's applied.

3. **Real-time result count**: As filters change, a live count shows "X of Y stocks match." This prevents dead-end screens with 0 results.

4. **Preset screens/templates**: Every top screener offers pre-built screens (e.g., "Top Gainers," "Value Plays," "Dividend Aristocrats"). This is the #1 onboarding mechanism.

5. **Heat coloring in tables**: Green/red intensity scales for price change, quality metrics (ROE, margins), and technical indicators. Simply Wall St's Snowflake is the most advanced example.

6. **Inline sparklines/charts**: Finviz's hover-to-preview-chart and TradingView's chart view mode show mini charts directly in the results grid.

7. **Column customization**: Users can add/remove/reorder columns. Koyfin and TradingView excel here with saved column presets.

8. **Watchlist integration**: One-click add from screener results to watchlist. TradingView's watchlist-scanner loop is best-in-class.

9. **Dark mode**: Essential for financial professionals. Bloomberg pioneered it; every modern screener has it.

10. **Mobile responsiveness**: TradingView and StockAnalysis.com lead in mobile screener experience.

### The Screener Spectrum

```
Simple ◄──────────────────────────────────► Complex
Yahoo │ StockAnalysis │ Finviz │ TradingView │ Koyfin │ Bloomberg
Finance │ .com │ │ │ │ Terminal
```

### Key Insight

The best free screener (Finviz) and the best paid screener (Bloomberg) have fundamentally different philosophies:
- **Finviz**: Speed, visual density, instant gratification. One screen shows everything.
- **Bloomberg**: Depth, precision, keyboard-first power. Every function has its own screen.
- **TradingView**: Integration. Screening flows into charting flows into community.

---

## 2. Per-Screener Deep Dive

---

### 2.1 Bloomberg Terminal (EQS)

**Overview**: The gold standard for institutional screening. EQS (Equity Screening) is one of the most used Bloomberg functions. Costs $24,000+/year.

#### Grid/Table Design
- **Layout**: Full-screen table with amber-highlighted editable fields
- **Row density**: Extremely high — 30-50+ rows visible at once on a standard monitor
- **Cell styling**: Monospaced font, minimal borders, data-dense cells
- **Heat coloring**: None by default — Bloomberg relies on raw numbers, not visual encoding
- **Price/change display**: Standard OHLCV format with tick-by-tick updates
- **Background**: Black background with white/amber text (the iconic Bloomberg aesthetic)

#### Filter System
- **Location**: Left sidebar with collapsible category panels
- **Filter types**: 
  - Dropdown selects (exchanges, sectors, countries)
  - Range inputs (min/max for fundamentals)
  - Boolean toggles
  - Text search for field names
- **Categories**: Exchange, Country, Index, Sector, Industry, Security Type, Fundamentals, Estimates, Price Ratios, Technical
- **Active filter state**: Filters appear in a "Selected Screening Criteria" box with live count of matching stocks
- **Key UX**: Drag-and-drop criterion from a browse window into the filter panel
- **Fields button**: Opens a searchable tree of 800+ screening criteria

#### Column System
- **Available columns**: 800+ data fields — the most of any screener
- **Column customization**: Full control via "Edit View" tab
- **Column resizing**: Yes, via drag handles
- **Column pinning**: First column (ticker) is sticky
- **Preset views**: None — fully custom each time

#### Sorting
- **Multi-column**: Yes, click column headers
- **Sort indicators**: Arrow icons (ascending/descending)
- **Visual feedback**: Rows reorder instantly

#### Visual Design
- **Color palette**: Black background, amber editable fields, white data, red for negative, green for positive
- **Typography**: Monospaced, small (10-11px), optimized for data density
- **Spacing**: Extremely tight — 2-3px padding per cell
- **Borders**: Minimal — thin gray grid lines
- **Elevation/shadow**: None — completely flat
- **Dark mode**: Default (always dark)

#### Chart Integration
- **Inline charts**: No sparklines in screener table
- **Row expand**: No — must load ticker into separate GP function
- **Side panels**: Launchpad allows side-by-side chart + screener
- **Mini charts**: Available in separate Chart Grid component

#### Search & Navigation
- **Global search**: Command line at top of every panel — type ticker or function name
- **Ticker search**: Autocomplete from command line
- **Quick-filter presets**: Pre-made screens available under "Example Searches"
- **Keyboard shortcuts**: Extensive — F8 for Equity, GO to execute, function codes (EQS, FA, GP, etc.)
- **Keyboard-first**: Terminal is designed for keyboard navigation, not mouse

#### Data Density
- **Rows visible**: 30-50+ depending on monitor size
- **Compact mode**: Default — extremely dense
- **Information per row**: 8-15 data columns typical

#### Color Coding
- **Up/down**: White text for positive, red for negative (subtle)
- **Bullish/bearish**: No visual encoding — relies on numerical thresholds
- **Quality metrics**: No heat coloring

#### Company Detail Views
- **Transition**: Type ticker + function code (e.g., "AAPL US Equity" then "DES")
- **New panel**: Opens in a new Bloomberg panel (up to 4 panels)
- **Split view**: Launchpad supports side-by-side panels

#### Watchlist Integration
- **Watchlists**: PORT function for portfolio tracking
- **From screener**: Export results to Excel or save as a list
- **Workflow**: Screen → Export → Analyze in separate function

#### Comparison Features
- **Side-by-side**: RV (Relative Value) function compares securities
- **Overlay**: GP function overlays multiple securities on one chart
- **Peer groups**: Built-in peer group comparison

#### Export & Sharing
- **Export options**: Excel (via Bloomberg Excel Add-In), PDF, print
- **Sharing**: Pages can be sent to other terminal users via IB chat
- **API**: BQL (Bloomberg Query Language) for programmatic access

#### Mobile/Responsive
- **Mobile app**: Bloomberg Professional App — limited screener functionality
- **Desktop-first**: Terminal is a desktop application, not web-based
- **Responsive**: No — fixed layout optimized for large monitors

#### Unique/Standout Features
- **Keyboard-first navigation**: No other screener matches Bloomberg's keyboard efficiency
- **800+ screening fields**: Deepest data coverage in the industry
- **Multi-panel workspace**: Up to 4 independent panels
- **Real-time data**: Tick-by-tick updates, no delays
- **BQL**: Programmatic query language for custom screens
- **Integration**: Screener → Chart → News → Trading all in one terminal

---

### 2.2 TradingView

**Overview**: The most popular charting platform with a powerful integrated screener. 100M+ users globally. Covers 100+ exchanges across 50+ countries.

#### Grid/Table Design
- **Layout**: Table view or Chart view (toggleable)
- **Row density**: 20-40 rows visible depending on screen size
- **Cell styling**: Clean, modern, white/dark background
- **Heat coloring**: Subtle green/red for price change columns
- **Price/change display**: Price, Change, Change %, Volume as default columns
- **Alternating rows**: Light zebra striping in light mode

#### Filter System
- **Location**: Top panel with horizontal filter chips
- **Filter types**:
  - Dropdown selects (exchange, sector, country)
  - Range sliders with min/max inputs
  - Checkbox toggles for boolean conditions
  - Text search within filter categories
- **Categories**: Descriptive, Fundamental, Technical
- **Active filter state**: Filter chips appear in top bar with "×" to remove
- **Result count**: Live count updates as filters change
- **Key UX**: Click "Add filter" to search/browse available filters
- **Popular screens**: Pre-built templates (Top Gainers, New High, etc.)

#### Column System
- **Available columns**: 150+ metrics
- **Column customization**: Full add/remove/reorder via column setup panel
- **Column resizing**: Yes, drag column borders
- **Column pinning**: Ticker column is sticky
- **Preset column views**: "Overview," "Performance," "Valuation," etc.
- **Column sets**: Save and switch between custom column configurations

#### Sorting
- **Multi-column**: Yes, click any column header
- **Sort indicators**: Up/down arrows in column headers
- **Visual feedback**: Instant table reorder

#### Visual Design
- **Color palette**: Dark mode default, light mode available. TradingView's signature dark blue/gray
- **Typography**: Sans-serif, clean, well-spaced
- **Spacing**: Medium density — comfortable to read
- **Borders**: Thin borders between cells, subtle
- **Elevation/shadow**: Minimal
- **Dark mode**: First-class dark mode with multiple theme options

#### Chart Integration
- **Inline charts**: "Chart view" mode shows mini candlestick charts for every result
- **Row expand**: Click ticker → opens full TradingView chart
- **Side panels**: Screener can be docked alongside charts
- **Mini charts**: Sparkline-style charts in table cells (paid plan)
- **Chart-to-screener**: From chart, use "Add to screener" to filter

#### Search & Navigation
- **Global search**: Symbol search at top of platform
- **Ticker search**: Autocomplete with exchange disambiguation
- **Quick-filter presets**: "Popular screens" dropdown with pre-built filters
- **Keyboard shortcuts**: Ctrl+Z/Y for undo/redo in screener, Dot (.) to open screen picker
- **Autosave**: Screener settings auto-save 2 seconds after each edit (new 2026 feature)

#### Data Density
- **Rows visible**: 20-40 depending on viewport
- **Compact mode**: Available via theme settings
- **Information per row**: 6-12 columns typical

#### Color Coding
- **Up/down**: Green for positive, red for negative
- **Bullish/bearish**: Technical summary column (Strong Buy/Buy/Neutral/Sell/Strong Sell)
- **Quality metrics**: Color-coded ratings

#### Company Detail Views
- **Transition**: Click ticker → opens full chart in new tab or panel
- **Modal**: No — opens in new tab
- **Split view**: Screener + Chart can be side-by-side

#### Watchlist Integration
- **Watchlists**: Deep integration — add screener results to watchlists
- **From watchlist to screener**: Scan watchlist using Pine Screener
- **Workflow**: Screen → Add to Watchlist → Monitor with alerts

#### Comparison Features
- **Side-by-side**: Compare multiple symbols on one chart
- **Overlay**: Drag symbols onto chart to overlay
- **Multi-chart**: Layout multiple charts in grid

#### Export & Sharing
- **Export options**: CSV (paid), screenshot, PDF
- **Sharing**: Share full screener setup via link (new 2025 feature)
- **Community**: Share screens publicly, other users can fork

#### Mobile/Responsive
- **Mobile app**: Full screener on iOS/Android
- **Responsive**: Yes, adapts to screen size
- **Mobile limitations**: Some filters harder to access on small screens

#### Unique/Standout Features
- **Chart view mode**: See mini charts for every result — unique to TradingView
- **Pine Script integration**: Create custom screening criteria using Pine Script
- **Pine Screener**: Scan watchlists with custom indicators
- **Community**: 100M+ users sharing screens, ideas, scripts
- **Multi-asset**: Stocks, ETFs, forex, crypto, bonds — all in one screener
- **Autosave + Undo**: Recent features for screener workflow
- **Shareable setups**: Share complete screener configuration via link

---

### 2.3 Finviz

**Overview**: The most popular free stock screener. Launched 2007. Known for speed, visual heatmaps, and instant filtering. 10M+ monthly visitors.

#### Grid/Table Design
- **Layout**: Table view (default), Charts view, Performance view, Maps view
- **Row density**: 20 rows per page (paginated, up to 572 pages)
- **Cell styling**: Compact, text-heavy, minimal decoration
- **Heat coloring**: Minimal in table — relies on Charts view for visual encoding
- **Price/change display**: Ticker, Company, Sector, Industry, Country, Market Cap, P/E, Price, Change, Volume
- **Background**: White (light mode only in free tier)

#### Filter System
- **Location**: Top panel organized into Descriptive, Fundamental, Technical tabs
- **Filter types**:
  - Dropdown selects (every filter is a dropdown)
  - Range presets (e.g., "Mega ($200bln+)", "Large ($10bln+)")
  - Custom min/max ranges
  - Boolean toggles
  - Signal-based filters (Top Gainers, New High, etc.)
- **Categories**: Descriptive (exchange, sector, industry, country, index, market cap), Fundamental (P/E, PEG, P/S, P/B, EPS growth, margins, etc.), Technical (RSI, SMA signals, patterns, volatility)
- **Active filter state**: Filters show selected values in dropdown boxes
- **Result count**: "X Result" shown at bottom of filter panel
- **Key UX**: URL encodes all filter selections — bookmarkable/shareable screens
- **Preset signals**: Built-in screens (Top Gainers, Top Losers, New High, Most Active, etc.)

#### Column System
- **Available columns**: 60+ metrics in free tier
- **Column customization**: Limited in free — reorder and select from dropdown
- **Column resizing**: No
- **Column pinning**: Ticker is always first
- **Preset views**: Overview, Valuation, Financial, Performance, Technical, Custom

#### Sorting
- **Multi-column**: Single column sort only
- **Sort indicators**: Click column header to toggle asc/desc
- **Visual feedback**: Instant reorder

#### Visual Design
- **Color palette**: White background, green/red for change, blue for links
- **Typography**: Small sans-serif, functional
- **Spacing**: Very tight — maximizes data density
- **Borders**: Thin gray borders between cells
- **Elevation/shadow**: None
- **Dark mode**: Not available in free tier (Elite has dark mode)

#### Chart Integration
- **Inline charts**: Hover over ticker in any view → popup chart preview
- **Charts view**: Grid of daily charts for all results — scan 20+ charts at once
- **Row expand**: No — click ticker to open company page
- **Side panels**: No
- **Mini charts**: Hover preview is the signature Finviz feature

#### Search & Navigation
- **Global search**: Ticker search box at top
- **Ticker search**: Direct input — type ticker to load
- **Quick-filter presets**: Signal filters act as presets
- **Keyboard shortcuts**: Limited
- **URL-based**: All filter state encoded in URL — no account needed to save

#### Data Density
- **Rows visible**: 20 per page (paginated)
- **Compact mode**: Default
- **Information per row**: 7-10 columns in default view

#### Color Coding
- **Up/down**: Green for positive, red for negative
- **Intensity**: No gradient — binary color
- **Heatmap**: Sector/country heat map view — sized by market cap, colored by performance

#### Company Detail Views
- **Transition**: Click ticker → opens Finviz company snapshot page
- **New page**: Full-page transition
- **Snapshot content**: Chart, fundamentals, analyst ratings, news, insider data

#### Watchlist Integration
- **Watchlists**: Portfolio feature (requires free account)
- **From screener**: Add to portfolio from results
- **Workflow**: Screen → Add to Portfolio → Monitor

#### Comparison Features
- **Side-by-side**: No built-in comparison tool
- **Overlay**: Chart comparison on company page (vs S&P 500)

#### Export & Sharing
- **Export options**: CSV export (Elite only), screenshot
- **Sharing**: URL sharing (filters encoded in URL)
- **API**: No public API

#### Mobile/Responsive
- **Mobile app**: No native app
- **Responsive**: Partially — works on mobile browsers but cramped
- **Heatmap**: Loses effectiveness on small screens

#### Unique/Standout Features
- **Speed**: Fastest filter-to-results of any screener — instant updates
- **Hover chart preview**: Signature feature — see chart without clicking
- **Charts view**: Grid of daily charts for visual scanning
- **Heatmap**: Market-wide visualization by sector/market cap
- **URL encoding**: Share screens via URL without accounts
- **No account required**: Free screener works without signup

---

### 2.4 Yahoo Finance

**Overview**: The most accessible screener for beginners. Part of Yahoo Finance's broader market data platform. Free with optional paid tiers.

#### Grid/Table Design
- **Layout**: Table view (default), Heatmap view
- **Row density**: 20-50 rows depending on viewport
- **Cell styling**: Clean, modern, white background
- **Heat coloring**: Subtle green/red for price change
- **Price/change display**: Symbol, Name, 1D Chart, Price, Change, Change %, Volume, Avg Vol, Market Cap, P/E, 52 Week Range
- **Background**: White with clean borders

#### Filter System
- **Location**: Left sidebar with "Add Filter" button
- **Filter types**:
  - Dropdown selects (region, sector, industry)
  - Range inputs (min/max)
  - Preset ranges (e.g., "Mega Cap," "Large Cap")
  - Search within filter categories
- **Categories**: Region, Market Cap, Sector, Industry, Price, Share Statistics, Income, Valuation, Dividends, ESG Scores, Technical
- **Active filter state**: Filters appear as rows in sidebar with values
- **Result count**: Dynamic count updates as filters change
- **Key UX**: "Add Another Filter" button — progressive disclosure
- **Pre-built screeners**: "Most Active," "Gainers," "Most Shorted," "52-Week Lows," etc.

#### Column System
- **Available columns**: 30-40 in free tier
- **Column customization**: Add/remove via "Add Column" button
- **Column resizing**: No
- **Column pinning**: Symbol is always first
- **Preset views**: Overview, Valuation, Performance, Financials, Technical Analysis

#### Sorting
- **Multi-column**: Single column sort
- **Sort indicators**: Click header to toggle
- **Visual feedback**: Instant reorder

#### Visual Design
- **Color palette**: White background, blue links, green/red for change
- **Typography**: Clean sans-serif, well-spaced
- **Spacing**: Comfortable — not too dense
- **Borders**: Light borders between cells
- **Elevation/shadow**: Minimal
- **Dark mode**: Available in paid tiers

#### Chart Integration
- **Inline charts**: Small sparkline in "1D Chart" column
- **Row expand**: No
- **Side panels**: No
- **Mini charts**: Sparkline thumbnails

#### Search & Navigation
- **Global search**: Yahoo search bar at top
- **Ticker search**: Autocomplete with company name
- **Quick-filter presets**: Pre-built screeners prominently featured
- **Keyboard shortcuts**: Limited
- **Saved screens**: Requires Yahoo account

#### Data Density
- **Rows visible**: 20-50
- **Compact mode**: Not available
- **Information per row**: 8-12 columns

#### Color Coding
- **Up/down**: Green positive, red negative
- **Heatmap view**: Color-coded grid by performance and market cap

#### Company Detail Views
- **Transition**: Click ticker → Yahoo Finance quote page
- **New page**: Full-page transition
- **Content**: Chart, key statistics, financials, analysis, news

#### Watchlist Integration
- **Watchlists**: Yahoo Finance portfolio/watchlist
- **From screener**: Add to portfolio
- **Workflow**: Screen → Add to Watchlist → Monitor with alerts

#### Comparison Features
- **Side-by-side**: Basic comparison tool
- **Overlay**: No chart overlay from screener

#### Export & Sharing
- **Export options**: CSV (paid only)
- **Sharing**: Link to saved screen
- **API**: Yahoo Finance API (unofficial)

#### Mobile/Responsive
- **Mobile app**: Yahoo Finance app with screener
- **Responsive**: Yes
- **Mobile experience**: Good — filters adapt to smaller screens

#### Unique/Standout Features
- **Beginner-friendly**: Most intuitive interface for new investors
- **Pre-built screeners**: Excellent curated screens for learning
- **Heatmap view**: Visual market overview
- **Integration**: Part of broader Yahoo Finance ecosystem (news, earnings, analysis)
- **Free real-time quotes**: Unlike Finviz's delayed data

---

### 2.5 MarketSmith / MarketSurge

**Overview**: Investor's Business Daily's premium research platform. Built on William O'Neil's CAN SLIM methodology. Renamed to MarketSurge in 2024. $149.99/month.

#### Grid/Table Design
- **Layout**: Chart-centric — screener results feed into full-screen charts
- **Row density**: 15-25 rows in list panel
- **Cell styling**: Data boxes surrounding the main chart
- **Heat coloring**: Proprietary 1-99 ratings with color intensity
- **Price/change display**: Integrated into chart with fundamental data boxes
- **Background**: Light gray/white

#### Filter System
- **Location**: Left panel with expandable category sections
- **Filter types**:
  - Dropdown selects
  - Range inputs
  - Star/favorite system for frequent criteria
  - Real-time count of matching stocks
- **Categories**: O'Neill Rating, Financial Ratios, Price & Volume, Industry & Sector, Pattern Recognition (9 categories + Favorites)
- **Active filter state**: Screen Summary box shows all criteria with match count
- **Key UX**: Click criterion name for explanation and usage tips
- **Preset screens**: Growth 250, Guru Checklists (Buffett, O'Neil, Lynch, etc.)

#### Column System
- **Available columns**: 100+ criteria
- **Column customization**: Full control via custom layout
- **Column resizing**: Yes
- **Column pinning**: Ticker always visible
- **Preset views**: Default and custom layouts

#### Sorting
- **Multi-column**: Yes
- **Sort indicators**: Standard arrows
- **Visual feedback**: Instant reorder

#### Visual Design
- **Color palette**: IBD's signature blue/white/gray
- **Typography**: Clean, professional
- **Spacing**: Medium density
- **Borders**: Light borders
- **Elevation/shadow**: Subtle shadows on data boxes
- **Dark mode**: Not available (desktop app)

#### Chart Integration
- **Inline charts**: Charts ARE the primary view — not an afterthought
- **Row expand**: Click result → full interactive chart
- **Side panels**: Chart in center, screens on left, checklists on right
- **Pattern recognition**: AI-flagged chart patterns (bases, breakouts, pullbacks)
- **Earnings Line**: Visual quarterly earnings trend overlay

#### Search & Navigation
- **Global search**: Symbol search
- **Ticker search**: Autocomplete
- **Quick-filter presets**: Growth 250, Guru screens, Stock Guide screens
- **Keyboard shortcuts**: Limited
- **Browse Screens**: 1,000+ community screens

#### Data Density
- **Rows visible**: 15-25 in list view
- **Compact mode**: Not needed — chart-centric
- **Information per row**: Fundamentals displayed around chart

#### Color Coding
- **1-99 rating system**: Proprietary color-coded ratings
- **A-E ratings**: SMR rating (Sales, Margins, ROE)
- **Volume color**: Green on up days, red on down days
- **Accumulation/Distribution**: David Ryan's Ants Indicator

#### Company Detail Views
- **Transition**: Click ticker → full chart view (same page)
- **Modal**: No
- **Split view**: Fixed layout — chart center, data sides

#### Watchlist Integration
- **Watchlists**: Built-in lists (Growth 250, Recent Breakouts, etc.)
- **From screener**: Add to custom lists
- **Workflow**: Screen → Chart → Checklist → Monitor

#### Comparison Features
- **Side-by-side**: Relative Value (RV) function
- **Overlay**: Compare stocks on same chart
- **Peer groups**: Industry group comparison

#### Export & Sharing
- **Export options**: Excel, PDF
- **Sharing**: Limited
- **API**: No public API

#### Mobile/Responsive
- **Mobile app**: iOS/Android — chart viewing and watchlists
- **Responsive**: Partially
- **Mobile limitations**: Full screening best on desktop

#### Unique/Standout Features
- **Pattern recognition**: AI identifies chart patterns automatically
- **1-99 RS Rating**: Proprietary relative strength system
- **Growth 250**: Curated list of 250 growth stocks updated daily
- **Guru Checklists**: Screen using Buffett, O'Neil, Lynch criteria
- **Earnings Line**: Visual quarterly earnings trend
- **Ants Indicator**: Institutional accumulation detection
- **Date change feature**: See what a stock looked like on any historical date

---

### 2.6 Tastytrade

**Overview**: Options-focused trading platform. No traditional stock screener — uses a sophisticated watchlist with filtering as a screener substitute. Purpose-built for options traders.

#### Grid/Table Design
- **Layout**: Watchlist-based grid (not a traditional screener)
- **Row density**: 15-30 rows in watchlist
- **Cell styling**: Compact, focused on options data
- **Heat coloring**: IV Rank color coding
- **Price/change display**: Price, IV Rank, Volume, Delta, Probability of Profit
- **Background**: Dark theme (trading-focused)

#### Filter System
- **Location**: Left sidebar filter panel
- **Filter types**:
  - Range sliders (IV Rank, Delta, Days to Expiration)
  - Dropdown selects (strategy type)
  - Boolean toggles (Optionable, Earnings in X days)
  - Custom range inputs
- **Categories**: Price, Volume, IV Rank, Probability of Profit, Days to Expiration, Earnings Date, Greeks
- **Active filter state**: Filter chips in sidebar
- **Key UX**: Probability of Profit metric is front-and-center
- **Preset filters**: High IV Opportunities, Earnings Plays, etc.

#### Column System
- **Available columns**: ~50 options-focused metrics
- **Column customization**: Moderate — options-specific columns
- **Column resizing**: Yes
- **Column pinning**: Ticker always first
- **Preset views**: Options chain, Watchlist, Positions

#### Sorting
- **Multi-column**: Single column
- **Sort indicators**: Click header
- **Visual feedback**: Instant

#### Visual Design
- **Color palette**: Dark theme (black/dark gray), orange accents
- **Typography**: Modern sans-serif
- **Spacing**: Medium density
- **Borders**: Minimal
- **Elevation/shadow**: Flat
- **Dark mode**: Default (always dark)

#### Chart Integration
- **Inline charts**: Small chart in symbol overview panel
- **Row expand**: No — click to open full chart
- **Side panels**: Chart alongside options chain
- **Curve analysis**: Visualize P&L over time and price — unique to Tastytrade

#### Search & Navigation
- **Global search**: Symbol search in header
- **Ticker search**: Autocomplete
- **Quick-filter presets**: IV Rank filters, strategy presets
- **Keyboard shortcuts**: Trading-focused hotkeys

#### Data Density
- **Rows visible**: 15-30
- **Compact mode**: Default
- **Information per row**: Options-focused data

#### Color Coding
- **IV Rank**: Color intensity based on volatility percentile
- **Probability of Profit**: Green/red scale
- **Greeks**: Color-coded by value

#### Company Detail Views
- **Transition**: Click ticker → options chain view
- **Modal**: No
- **Split view**: Watchlist + Chart + Options Chain

#### Watchlist Integration
- **Watchlists**: Core of the platform — everything is a watchlist
- **From screener**: Screener IS the watchlist
- **Workflow**: Filter Watchlist → Analyze Options → Trade

#### Comparison Features
- **Side-by-side**: Multi-chart grid mode
- **Overlay**: Compare options strategies
- **P&L visualization**: Curve analysis tool

#### Export & Sharing
- **Export options**: Limited
- **Sharing**: Limited
- **API**: No public API

#### Mobile/Responsive
- **Mobile app**: iOS/Android
- **Responsive**: Partially
- **Mobile limitations**: Desktop preferred for options analysis

#### Unique/Standout Features
- **Probability of Profit**: Front-and-center metric for every trade
- **IV Rank filtering**: Screen by implied volatility percentile
- **Curve analysis**: Visualize how positions perform over time
- **Strategy templates**: Pre-built options strategies (strangles, iron condors, etc.)
- **tastylive integration**: Live educational content alongside trading

---

### 2.7 Seeking Alpha

**Overview**: Research-driven platform with integrated screening. Known for quant ratings and contributor analysis. Premium subscription required for full screener access.

#### Grid/Table Design
- **Layout**: Table view with sortable columns
- **Row density**: 20-30 rows
- **Cell styling**: Clean, modern, white background
- **Heat coloring**: Quant rating color coding (Strong Buy = dark green)
- **Price/change display**: Standard price/change columns
- **Background**: White

#### Filter System
- **Location**: Left sidebar with category panels
- **Filter types**:
  - Dropdown selects
  - Range inputs
  - Rating selectors (Strong Buy, Buy, Hold, Sell, Strong Sell)
  - Checkbox toggles
- **Categories**: Ratings, Quants, Trading, Dividend Grades, Earnings, Valuation, Growth, Momentum, Factor Grades
- **Active filter state**: Filters appear in sidebar with values
- **Result count**: Live count of matching stocks
- **Key UX**: "Create New Screen" → select categories → set parameters → save
- **Preset screens**: "Stocks by Quant," "Top Dividend Stocks," etc.

#### Column System
- **Available columns**: 80+ metrics
- **Column customization**: Full add/remove
- **Column resizing**: No
- **Column pinning**: Symbol always first
- **Preset views**: Default, Quant-focused, Fundamental

#### Sorting
- **Multi-column**: Single column
- **Sort indicators**: Click header
- **Visual feedback**: Instant

#### Visual Design
- **Color palette**: White background, blue accents, green/red for ratings
- **Typography**: Clean sans-serif
- **Spacing**: Medium density
- **Borders**: Light borders
- **Elevation/shadow**: Minimal
- **Dark mode**: Available in paid tiers

#### Chart Integration
- **Inline charts**: No sparklines in screener
- **Row expand**: No — click to open symbol page
- **Side panels**: Advanced charting available separately
- **Mini charts**: Not in screener

#### Search & Navigation
- **Global search**: Symbol search at top
- **Ticker search**: Autocomplete
- **Quick-filter presets**: Pre-built screens
- **Keyboard shortcuts**: Limited
- **Saved screens**: Saved in left nav

#### Data Density
- **Rows visible**: 20-30
- **Compact mode**: Not available
- **Information per row**: 6-10 columns

#### Color Coding
- **Quant Rating**: 5-level color scale (Strong Buy to Strong Sell)
- **Factor Grades**: A+ to F grading with color
- **Up/down**: Standard green/red

#### Company Detail Views
- **Transition**: Click ticker → symbol page
- **New page**: Full-page transition
- **Content**: Analysis, ratings, financials, news, quant data

#### Watchlist Integration
- **Watchlists**: Portfolios feature
- **From screener**: Add to portfolio
- **Workflow**: Screen → Add to Portfolio → Set Alerts

#### Comparison Features
- **Side-by-side**: Stock comparison tool (up to 20 stocks)
- **Overlay**: No chart overlay from screener

#### Export & Sharing
- **Export options**: Email, link, download (Premium)
- **Sharing**: Share via link
- **API**: No public API

#### Mobile/Responsive
- **Mobile app**: iOS/Android
- **Responsive**: Yes
- **Mobile experience**: Good

#### Unique/Standout Features
- **Quant ratings**: Proprietary scoring system
- **Factor grades**: Granular A-F grading for valuation, growth, momentum, etc.
- **Contributor ratings**: Analyst community ratings alongside quant
- **Ask Seeking Alpha**: Natural language screening via AI
- **Days at Quant Rating**: How long a stock has held its rating

---

### 2.8 Koyfin

**Overview**: Bloomberg-like experience at retail pricing. 100K+ global securities, 5,900+ filter criteria. Known for clean interface and macro data integration.

#### Grid/Table Design
- **Layout**: Table view with sortable columns
- **Row density**: 20-40 rows
- **Cell styling**: Clean, modern, well-spaced
- **Heat coloring**: Color-coded performance metrics
- **Price/change display**: Comprehensive data columns
- **Background**: White or dark (themeable)

#### Filter System
- **Location**: Left sidebar with category panels
- **Filter types**:
  - Range inputs (min/max with universe range shown in gray)
  - Dropdown selects
  - Text search within filters
  - Checkbox toggles
- **Categories**: Region, Exchange, Sector, Industry, Price, Technicals, Fundamentals, Analyst Estimates, Historical data
- **Active filter state**: Filters in sidebar with values, live count
- **Result count**: Dynamic count
- **Key UX**: 5,900+ filter criteria — the most of any web screener
- **Preset screens**: Templates available

#### Column System
- **Available columns**: 500+ metrics
- **Column customization**: Full add/remove/reorder
- **Column resizing**: Yes
- **Column pinning**: Ticker always visible
- **Preset views**: Import views from watchlists
- **Column sets**: Save and switch between configurations

#### Sorting
- **Multi-column**: Yes
- **Sort indicators**: Click headers
- **Visual feedback**: Instant

#### Visual Design
- **Color palette**: Clean white/dark with blue accents
- **Typography**: Modern sans-serif, well-spaced
- **Spacing**: Medium density
- **Borders**: Subtle
- **Elevation/shadow**: Minimal
- **Dark mode**: Full dark mode with customizable themes

#### Chart Integration
- **Inline charts**: No sparklines in screener
- **Row expand**: No — click to open chart
- **Side panels**: Dashboard widgets can show charts alongside screener
- **Mini charts**: Available in Lots of Charts feature

#### Search & Navigation
- **Global search**: Search console at top
- **Ticker search**: Autocomplete with 2-3 letter shortcuts
- **Quick-filter presets**: Templates and premade screens
- **Keyboard shortcuts**: Extensive hotkeys for every feature
- **2-3 letter shortcuts**: Every navigation item has a short code

#### Data Density
- **Rows visible**: 20-40
- **Compact mode**: Available
- **Information per row**: 8-15 columns

#### Color Coding
- **Performance**: Green/red intensity scale
- **Percentile Ranks**: Color-coded vs history/peers
- **Quality metrics**: Color intensity based on value

#### Company Detail Views
- **Transition**: Click ticker → Insight Panel (same page)
- **Modal**: No
- **Split view**: Dashboard with multiple widgets

#### Watchlist Integration
- **Watchlists**: Deep integration — screens can be exported to watchlists
- **From screener**: One-click add to watchlist
- **Workflow**: Screen → Watchlist → Chart → Dashboard

#### Comparison Features
- **Side-by-side**: Market Scatter (scatter plot comparison)
- **Overlay**: Charts with multiple securities
- **Peer comparison**: Built-in peer groups

#### Export & Sharing
- **Export options**: CSV, Excel
- **Sharing**: Share charts via link
- **API**: No public API

#### Mobile/Responsive
- **Mobile app**: No dedicated app
- **Responsive**: Web-based, works on tablets
- **Desktop-first**: Optimized for large monitors

#### Unique/Standout Features
- **5,900+ filter criteria**: Most extensive filter library
- **Historical screening**: Screen using 10+ years of data
- **Percentile Ranks**: Compare values vs history, peers, or regions
- **Custom formulas**: Create computed columns in tables
- **Macro integration**: Live yields from 40 countries alongside stock screening
- **Earnings transcripts**: Searchable by keyword going back 50 years
- **Clean interface**: Bloomberg-quality data in a modern, clean UI

---

### 2.9 StockAnalysis.com

**Overview**: Fast, clean, data-focused platform. 290+ filters in free tier. Known for speed and value. $79/year for Pro.

#### Grid/Table Design
- **Layout**: Table view with sortable columns
- **Row density**: 20-50 rows
- **Cell styling**: Clean, minimal, modern
- **Heat coloring**: Subtle green/red for price change
- **Price/change display**: Price, Change, Change %, Volume, Market Cap
- **Background**: White (dark mode in Pro)

#### Filter System
- **Location**: Left sidebar with search
- **Filter types**:
  - Range inputs (min/max)
  - Dropdown selects
  - Checkbox toggles
  - Search within filter categories
- **Categories**: Valuation, Growth, Dividends, Profitability, Technical, Sector, Country, Market Cap, Price
- **Active filter state**: Filter chips above results
- **Result count**: Live count
- **Key UX**: 290+ filters — update in real-time as you adjust
- **Preset screens**: Predefined screens available

#### Column System
- **Available columns**: 200+ indicators (Pro)
- **Column customization**: Full add/remove (Pro)
- **Column resizing**: Yes
- **Column pinning**: Symbol always first
- **Preset views**: Overview, Valuation, Financials, Dividends

#### Sorting
- **Multi-column**: Single column
- **Sort indicators**: Click header
- **Visual feedback**: Instant

#### Visual Design
- **Color palette**: White background, clean lines
- **Typography**: Modern sans-serif, excellent readability
- **Spacing**: Clean, well-organized
- **Borders**: Minimal
- **Elevation/shadow**: None
- **Dark mode**: Pro feature

#### Chart Integration
- **Inline charts**: No sparklines in screener
- **Row expand**: No — click to open stock page
- **Side panels**: No
- **Mini charts**: Available on stock pages

#### Search & Navigation
- **Global search**: Prominent search bar at top
- **Ticker search**: Fast autocomplete
- **Quick-filter presets**: Predefined screens
- **Keyboard shortcuts**: Limited
- **Saved screens**: Pro feature

#### Data Density
- **Rows visible**: 20-50
- **Compact mode**: Available
- **Information per row**: 6-12 columns

#### Color Coding
- **Up/down**: Green positive, red negative
- **Intensity**: No gradient
- **Clean**: Minimal color usage — data-focused

#### Company Detail Views
- **Transition**: Click ticker → stock page (same tab)
- **New page**: Full-page transition
- **Content**: Chart, financials, statistics, dividends, profile

#### Watchlist Integration
- **Watchlists**: Built-in watchlists
- **From screener**: One-click add
- **Workflow**: Screen → Add to Watchlist → Monitor

#### Comparison Features
- **Side-by-side**: Peer comparison on stock pages
- **Overlay**: No from screener

#### Export & Sharing
- **Export options**: CSV, Excel (Pro)
- **Sharing**: Link to saved screens
- **API**: No public API

#### Mobile/Responsive
- **Mobile app**: iOS (4.9 stars), Android (4.8 stars)
- **Responsive**: Excellent
- **Mobile experience**: Full screener on mobile

#### Unique/Standout Features
- **Speed**: Fastest page loads of any finance site
- **290+ free filters**: Most free filters of any screener
- **Clean interface**: No ads, no clutter (free tier has ads)
- **Value**: $79/year Pro is exceptional value
- **40+ years of financial data**: Deep historical data on Pro
- **Mobile apps**: Best mobile finance apps by rating

---

### 2.10 Simply Wall St

**Overview**: Visual-first stock analysis platform. Known for the "Snowflake" visualization. 7M+ users. Focus on making investing accessible through visual analysis.

#### Grid/Table Design
- **Layout**: List view or Grid view (toggleable)
- **Row density**: 15-25 rows
- **Cell styling**: Visual cards with Snowflake diagrams
- **Heat coloring**: Snowflake arms are color-coded (green = strong, gray = weak)
- **Price/change display**: Minimal — focus is on fundamental scores
- **Background**: White, clean

#### Filter System
- **Location**: Top panel with category sections
- **Filter types**:
  - Dropdown selects (market, industry)
  - Range sliders for Snowflake scores
  - Draggable Snowflake shape filter (unique!)
  - Checkbox toggles
  - Keyword search (beta)
- **Categories**: Market, Industry, Snowflake Score, Advanced (Value, Future, Past, Health, Dividend)
- **Active filter state**: Applied filters shown above results
- **Result count**: Live count
- **Key UX**: Drag Snowflake arms to filter by shape — intuitive visual filtering
- **Preset screens**: "Dividend Powerhouses," "Undervalued Growth," "High Growth Tech," etc.

#### Column System
- **Available columns**: 30+ metrics
- **Column customization**: Limited
- **Column resizing**: No
- **Column pinning**: No
- **Preset views**: Snowflake-focused

#### Sorting
- **Multi-column**: Single column
- **Sort indicators**: Dropdown menus
- **Visual feedback**: Instant

#### Visual Design
- **Color palette**: Soft pastels, green/gray for Snowflake, clean white
- **Typography**: Friendly, accessible sans-serif
- **Spacing**: Generous — not dense
- **Borders**: Minimal
- **Elevation/shadow**: Subtle card shadows
- **Dark mode**: Not available

#### Chart Integration
- **Inline charts**: Snowflake IS the visual element (5-point diagram)
- **Row expand**: Click → full stock report page
- **Side panels**: No
- **Mini charts**: Snowflake replaces traditional charts

#### Search & Navigation
- **Global search**: Search bar at top
- **Ticker search**: Autocomplete
- **Quick-filter presets**: Popular Screens prominently featured
- **Keyboard shortcuts**: Limited
- **Saved screens**: Save and name screeners

#### Data Density
- **Rows visible**: 15-25
- **Compact mode**: Not available — visual-first
- **Information per row**: Snowflake + key metrics

#### Color Coding
- **Snowflake arms**: Green intensity = strength in each area
  - Value: Green = undervalued, Gray = fairly valued
  - Future: Green = strong growth expected
  - Past: Green = strong historical performance
  - Health: Green = strong balance sheet
  - Dividend: Green = reliable dividend
- **Fair Value**: Green circle = undervalued, Red = overvalued
- **Visual simplicity**: Colors are easy to understand

#### Company Detail Views
- **Transition**: Click → one long scrollable report page
- **New page**: Full-page transition
- **Content**: Valuation, Growth, Financial Health, Dividend, Risks — all in sequence
- **Unique**: Entire analysis on one scrollable page (no tabs)

#### Watchlist Integration
- **Watchlists**: Portfolio tracking
- **From screener**: Add to watchlist
- **Workflow**: Screen → Snowflake → Report → Monitor

#### Comparison Features
- **Side-by-side**: Stock comparison tool
- **Overlay**: No

#### Export & Sharing
- **Export options**: Excel, PDF (Premium)
- **Sharing**: Link to stock reports
- **API**: No public API

#### Mobile/Responsive
- **Mobile app**: iOS/Android
- **Responsive**: Yes
- **Mobile experience**: Good — Snowflake works well on small screens

#### Unique/Standout Features
- **Snowflake visualization**: Unique 5-point diagram showing company health at a glance
- **Visual filtering**: Drag Snowflake shape to filter — unique UX
- **One-page reports**: Entire analysis on one scrollable page
- **Plain language**: Explains every metric in simple terms
- **Screener alerts**: Weekly notifications when new stocks match your criteria
- **Global coverage**: 72,000+ companies across all markets

---

### 2.11 Zacks

**Overview**: Known for the Zacks Rank system. Free screener with 145+ data points. Research-driven platform since 1978.

#### Grid/Table Design
- **Layout**: Table view
- **Row density**: 20-30 rows
- **Cell styling**: Traditional, data-focused
- **Heat coloring**: Zacks Rank color coding (1 = Strong Buy in dark green)
- **Price/change display**: Standard columns
- **Background**: White

#### Filter System
- **Location**: Left sidebar with category panels
- **Filter types**:
  - Dropdown selects
  - Range inputs
  - Boolean toggles
  - Category-based navigation
- **Categories**: Zacks Rank, Company Descriptors, Price/Volume, Fundamentals, Earnings, Estimates, Ownership, Technical
- **Active filter state**: Criteria shown in summary box
- **Result count**: Live count
- **Key UX**: Category headings on left, items on right
- **Preset screens**: Basic, Premium, and Profit Track predefined screens

#### Column System
- **Available columns**: 145+ data points
- **Column customization**: Full via "Edit View"
- **Column resizing**: No
- **Column pinning**: No
- **Preset views**: Default + custom

#### Sorting
- **Multi-column**: Single column
- **Sort indicators**: Click header
- **Visual feedback**: Instant

#### Visual Design
- **Color palette**: White background, green accents (Zacks brand)
- **Typography**: Standard sans-serif
- **Spacing**: Medium density
- **Borders**: Light borders
- **Elevation/shadow**: None
- **Dark mode**: Not available

#### Chart Integration
- **Inline charts**: No
- **Row expand**: No — click for Snapshot report
- **Side panels**: No
- **Mini charts**: No

#### Search & Navigation
- **Global search**: Limited
- **Ticker search**: Standard
- **Quick-filter presets**: Predefined screens
- **Keyboard shortcuts**: Limited
- **Saved screens**: Save and retrieve custom screens

#### Data Density
- **Rows visible**: 20-30
- **Compact mode**: Not available
- **Information per row**: 6-10 columns

#### Color Coding
- **Zacks Rank**: 5-level color scale (1 = Strong Buy, 5 = Strong Sell)
- **Up/down**: Standard green/red
- **Earnings surprises**: Color-coded

#### Company Detail Views
- **Transition**: Click → Snapshot report
- **New page**: Full-page transition
- **Content**: Company description, EPS, ratings, fundamentals

#### Watchlist Integration
- **Watchlists**: Portfolio feature
- **From screener**: Add to portfolio
- **Workflow**: Screen → Add to Portfolio → Monitor

#### Comparison Features
- **Side-by-side**: Limited
- **Overlay**: No

#### Export & Sharing
- **Export options**: Excel (Research Wizard)
- **Sharing**: Limited
- **API**: No public API

#### Mobile/Responsive
- **Mobile app**: iOS/Android
- **Responsive**: Yes
- **Mobile experience**: Basic

#### Unique/Standout Features
- **Zacks Rank**: Proprietary earnings estimate revision ranking
- **Earnings estimate focus**: Strongest screener for earnings-based screening
- **Predefined screens**: 45+ analyst-created screens
- **Research Wizard**: Desktop app for backtesting screens
- **Free tier**: Genuinely useful free screener

---

### 2.12 TipRanks

**Overview**: Analyst rating aggregation platform. Smart Score system combines multiple data sources. Known for democratizing institutional data.

#### Grid/Table Design
- **Layout**: Table view with sortable columns
- **Row density**: 20-30 rows
- **Cell styling**: Clean, modern
- **Heat coloring**: Smart Score color coding (8-10 = dark green)
- **Price/change display**: Price, Smart Score, Analyst consensus
- **Background**: White

#### Filter System
- **Location**: Left sidebar
- **Filter types**:
  - Dropdown selects
  - Range inputs
  - Rating selectors
  - Smart Score range
- **Categories**: Smart Score, Analyst Consensus, Price Target, Market Cap, Sector, Industry
- **Active filter state**: Filters shown in sidebar
- **Result count**: Live count
- **Key UX**: Smart Score is the primary filter/sort mechanism
- **Preset screens**: Top Smart Score stocks, etc.

#### Column System
- **Available columns**: 50+ metrics
- **Column customization**: Moderate
- **Column resizing**: No
- **Column pinning**: No
- **Preset views**: Default

#### Sorting
- **Multi-column**: Single column
- **Sort indicators**: Click header
- **Visual feedback**: Instant

#### Visual Design
- **Color palette**: White background, blue accents
- **Typography**: Modern sans-serif
- **Spacing**: Medium density
- **Borders**: Light
- **Elevation/shadow**: Minimal
- **Dark mode**: Available

#### Chart Integration
- **Inline charts**: No
- **Row expand**: No — click for full analysis
- **Side panels**: No
- **Mini charts**: No

#### Search & Navigation
- **Global search**: Symbol search
- **Ticker search**: Autocomplete
- **Quick-filter presets**: Smart Score-based presets
- **Keyboard shortcuts**: Limited
- **Saved screens**: Limited

#### Data Density
- **Rows visible**: 20-30
- **Compact mode**: Not available
- **Information per row**: 5-8 columns

#### Color Coding
- **Smart Score**: 1-10 color scale (10 = dark green, 1 = dark red)
- **Analyst consensus**: Buy/Hold/Sell with colors
- **Insider trading**: Green for buys, red for sells

#### Company Detail Views
- **Transition**: Click → full analysis page
- **New page**: Full-page transition
- **Content**: Analyst ratings, insider trading, financials, news

#### Watchlist Integration
- **Watchlists**: Portfolio feature
- **From screener**: Add to portfolio
- **Workflow**: Screen → Add to Watchlist → Monitor

#### Comparison Features
- **Side-by-side**: Limited
- **Overlay**: No

#### Export & Sharing
- **Export options**: Limited
- **Sharing**: Link sharing
- **API**: MCP integration available

#### Mobile/Responsive
- **Mobile app**: iOS/Android
- **Responsive**: Yes
- **Mobile experience**: Good

#### Unique/Standout Features
- **Smart Score**: Proprietary 1-10 score combining 8 data signals
- **Analyst consensus**: Aggregates ratings from 100K+ analysts
- **Insider trading data**: Comprehensive insider activity tracking
- **MCP integration**: Can be used with AI agents (Claude, ChatGPT)

---

### 2.13 Stock Rover

**Overview**: Research-focused platform for buy-and-hold investors. 275+ metrics. Known for deep fundamental data and interactive UI.

#### Grid/Table Design
- **Layout**: Spreadsheet-like table (Excel-inspired)
- **Row density**: 20-40 rows
- **Cell styling**: Spreadsheet-style cells
- **Heat coloring**: Conditional formatting for metrics
- **Price/change display**: Full financial data columns
- **Background**: White/gray

#### Filter System
- **Location**: Integrated into table filtering
- **Filter types**:
  - Direct cell filtering (Excel-style)
  - Range inputs
  - Dropdown selects
- **Categories**: All 275+ metrics filterable
- **Active filter state**: Filtered rows highlighted
- **Result count**: Row count
- **Key UX**: Right-click to filter, sort, chart — Excel-like interaction

#### Column System
- **Available columns**: 275+ metrics
- **Column customization**: Full Excel-like control
- **Column resizing**: Yes
- **Column pinning**: Yes
- **Preset views**: Multiple table views as tabs

#### Sorting
- **Multi-column**: Yes (Excel-like)
- **Sort indicators**: Click headers
- **Visual feedback**: Instant

#### Visual Design
- **Color palette**: Professional, Excel-inspired
- **Typography**: Clean sans-serif
- **Spacing**: Spreadsheet-density
- **Borders**: Grid lines
- **Elevation/shadow**: None
- **Dark mode**: Available

#### Chart Integration
- **Inline charts**: Sparklines in cells
- **Row expand**: Right-click → Chart
- **Side panels**: Chart panel alongside table
- **Mini charts**: Sparkline-style in cells

#### Search & Navigation
- **Global search**: Start Menu
- **Ticker search**: Standard
- **Quick-filter presets**: Library of screens
- **Keyboard shortcuts**: Excel-like shortcuts
- **Saved screens**: Full save/load system

#### Data Density
- **Rows visible**: 20-40
- **Compact mode**: Available
- **Information per row**: 10-20 columns (Excel-like)

#### Color Coding
- **Conditional formatting**: Cell color based on values
- **Row coloring**: Custom row colors
- **Performance**: Green/red scales

#### Company Detail Views
- **Transition**: Right-click → various analysis options
- **Modal**: Insight Panel (right side)
- **Split view**: Table + Chart + Insight Panel

#### Watchlist Integration
- **Watchlists**: Core feature
- **From screener**: Save as watchlist
- **Workflow**: Screen → Save as Watchlist → Chart → Analyze

#### Comparison Features
- **Side-by-side**: Peer comparison in table
- **Overlay**: Multiple stocks on one chart
- **Scatter plots**: Compare metrics visually

#### Export & Sharing
- **Export options**: Excel, CSV, PDF
- **Sharing**: Limited
- **API**: No public API

#### Mobile/Responsive
- **Mobile app**: No
- **Responsive**: Desktop-first
- **Best on**: Large monitors

#### Unique/Standout Features
- **Excel-like interaction**: Right-click, drag-and-drop, resize panels
- **275+ metrics**: Deep fundamental coverage
- **Insight Panel**: Multi-functional analysis panel
- **Tooltips**: Rich hover tooltips with detailed data
- **Web 2.0 feel**: Feels like a desktop app in the browser

---

### 2.14 TC2000

**Overview**: Award-winning charting and screening platform. Known for interactive charting experience. $9.99-$59.99/month.

#### Grid/Table Design
- **Layout**: Table + Chart integrated view
- **Row density**: 15-25 rows
- **Cell styling**: Clean, trading-focused
- **Heat coloring**: Condition-based coloring
- **Price/change display**: Price, Volume, technical indicators
- **Background**: Dark theme option

#### Filter System
- **Location**: Left panel
- **Filter types**:
  - Technical condition builder
  - Fundamental range inputs
  - Pattern recognition filters
- **Categories**: Technical, Fundamental, Options
- **Active filter state**: Conditions shown in panel
- **Key UX**: Visual condition builder — no formula syntax needed

#### Column System
- **Available columns**: 100+ metrics
- **Column customization**: Full control
- **Column resizing**: Yes
- **Column pinning**: Yes
- **Preset views**: Multiple

#### Sorting
- **Multi-column**: Yes
- **Sort indicators**: Standard
- **Visual feedback**: Instant

#### Visual Design
- **Color palette**: Dark/light themes, trading-focused
- **Typography**: Clean, readable
- **Spacing**: Medium density
- **Borders**: Minimal
- **Elevation/shadow**: None
- **Dark mode**: Full dark mode

#### Chart Integration
- **Inline charts**: Charts are primary view
- **Row expand**: Click → chart
- **Side panels**: Chart + Table side-by-side
- **Mini charts**: Sparklines in table

#### Search & Navigation
- **Global search**: Symbol search
- **Ticker search**: Autocomplete
- **Quick-filter presets**: Preset scans
- **Keyboard shortcuts**: Extensive trading hotkeys

#### Data Density
- **Rows visible**: 15-25
- **Compact mode**: Available
- **Information per row**: 6-10 columns

#### Color Coding
- **Technical signals**: Color-coded buy/sell
- **Condition coloring**: Green/red based on criteria
- **Volume**: Color-coded by direction

#### Company Detail Views
- **Transition**: Click → chart view
- **Modal**: No
- **Split view**: Chart + Table

#### Watchlist Integration
- **Watchlists**: Deep integration
- **From screener**: Add to watchlist
- **Workflow**: Screen → Chart → Watchlist → Trade

#### Comparison Features
- **Side-by-side**: Multi-chart layout
- **Overlay**: Multiple indicators on one chart

#### Export & Sharing
- **Export options**: Limited
- **Sharing**: Limited
- **API**: No

#### Mobile/Responsive
- **Mobile app**: No
- **Responsive**: Desktop-first
- **Best on**: Large monitors

#### Unique/Standout Features
- **Interactive charting**: Best-in-class chart experience
- **Visual condition builder**: Build filters visually, not with formulas
- **Seamless flow**: Screen → Chart → Watchlist → Trade in one platform
- **Brokerage integration**: Trade directly from TC2000

---

### 2.15 Deepvue

**Overview**: Modern screener built for momentum/growth traders. 1,150+ data points, 80+ presets from top traders. AI terminal for natural language screening.

#### Grid/Table Design
- **Layout**: Table view with mini-chart grid option
- **Row density**: 20-50 rows (virtualized — smooth scroll across 1,000+ results)
- **Cell styling**: Clean, modern
- **Heat coloring**: Cell flash on real-time data change
- **Price/change display**: Full data columns
- **Background**: Dark theme

#### Filter System
- **Location**: Drag-and-drop filter builder
- **Filter types**:
  - Drag-and-drop filter groups
  - ANY/ALL logic composition
  - Numeric ranges
  - Multi-select
  - Text search
  - Checkbox conditions
- **Categories**: EPS, Revenue, Technical, Momentum, Earnings, Fundamentals
- **Active filter state**: Filter chips with logic indicators
- **Result count**: Live count
- **Key UX**: Compose conditions visually — no formula bar
- **Preset screens**: 80+ from named pros (Oliver Kell, Mike Webster, Mark Minervini)

#### Column System
- **Available columns**: 1,152 data points
- **Column customization**: Full control
- **Column resizing**: Yes
- **Column pinning**: Yes
- **Preset views**: Column Sets — save and switch
- **Streaming**: 568 fields stream live via WebSocket

#### Sorting
- **Multi-column**: Yes
- **Sort indicators**: Standard
- **Visual feedback**: Instant

#### Visual Design
- **Color palette**: Dark theme, modern
- **Typography**: Clean sans-serif
- **Spacing**: Medium density
- **Borders**: Minimal
- **Elevation/shadow**: Subtle
- **Dark mode**: Default

#### Chart Integration
- **Inline charts**: Mini-chart grid view for all results
- **Row expand**: Click → full chart
- **Side panels**: Split layout for chart + table
- **Mini charts**: Grid mode shows charts for every result

#### Search & Navigation
- **Global search**: Deepvue Terminal — natural language
- **Ticker search**: Standard
- **Quick-filter presets**: 150+ curated screens
- **Keyboard shortcuts**: Limited
- **Saved screens**: Full save/load system

#### Data Density
- **Rows visible**: 20-50 (virtualized)
- **Compact mode**: Available
- **Information per row**: 6-15 columns

#### Color Coding
- **Real-time flash**: Cells flash when values change
- **Momentum**: Green/red intensity
- **Quality**: Color-coded metrics

#### Company Detail Views
- **Transition**: Click → chart + analysis
- **Modal**: No
- **Split view**: Screener + Chart + Alerts

#### Watchlist Integration
- **Watchlists**: Deep integration
- **From screener**: One-click add
- **Workflow**: Screen → Chart → Watchlist → Alert

#### Comparison Features
- **Side-by-side**: Multi-chart layout
- **Overlay**: Compare on charts

#### Export & Sharing
- **Export options**: CSV
- **Sharing**: Limited
- **API**: No

#### Mobile/Responsive
- **Mobile app**: iOS/Android
- **Responsive**: Yes
- **Mobile experience**: Good

#### Unique/Standout Features
- **AI Terminal**: Natural language screening — type what you want
- **1,150+ data points**: Massive data coverage
- **568 streaming fields**: Real-time WebSocket updates
- **80+ trader presets**: Screens from named professional traders
- **Virtualized table**: Smooth scroll across 1,000+ results
- **ANY/ALL logic**: Visual filter composition with boolean logic
- **Cell flash**: Real-time visual feedback on data changes

---

## 3. Feature Matrix

### Core Features Comparison

| Feature | Bloomberg | TradingView | Finviz | Yahoo Finance | MarketSmith | Koyfin | StockAnalysis | Simply Wall St | Zacks | TipRanks | Deepvue |
|---------|-----------|-------------|--------|---------------|-------------|--------|---------------|----------------|-------|----------|---------|
| **Free Tier** | No | Yes | Yes | Yes | No | Yes | Yes | Yes | Yes | Yes | No |
| **Price** | $24K+/yr | $0-$70/mo | $0-$40/mo | $0-$40/mo | $150/mo | $0-$35/mo | $0-$13/mo | $0-$21/mo | $0-$25/mo | $0-$30/mo | $29/mo |
| **Filter Count** | 800+ | 150+ | 70+ | 30+ | 100+ | 5,900+ | 290+ | 30+ | 145+ | 50+ | 1,152 |
| **Global Coverage** | Yes | Yes | US only | Yes | US/Canada | Yes | Yes | Yes | US | Yes | Yes |
| **Real-time Data** | Yes | Paid | Paid | Yes | Yes | Paid | Paid | No | No | Paid | Yes |
| **Dark Mode** | Default | Yes | Paid | Paid | No | Yes | Paid | No | No | Yes | Default |
| **Mobile App** | Yes | Yes | No | Yes | Yes | No | Yes | Yes | Yes | Yes | Yes |
| **Save Screens** | Yes | Yes | Paid | Yes | Yes | Yes | Paid | Yes | Yes | Yes | Yes |
| **Export CSV** | Yes | Paid | Paid | Paid | Yes | Yes | Paid | Paid | Paid | No | Yes |
| **Preset Screens** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| **Chart Integration** | Separate | Best | Hover | Sparkline | Best | Separate | Separate | Snowflake | No | Separate | Grid |
| **AI/NLP Screening** | BQL | No | No | No | No | No | No | No | No | Ask SA | Yes |
| **Backtesting** | Yes | Yes | Paid | No | No | No | No | No | Paid | No | No |
| **Heatmap** | No | Yes | Yes | Yes | No | No | No | No | No | No | No |
| **Virtualized Table** | No | No | No | No | No | No | No | No | No | No | Yes |
| **Keyboard-first** | Yes | Partial | No | No | No | Partial | No | No | No | No | No |
| **Shareable Screens** | Limited | Yes | URL | Limited | No | No | No | No | No | No | No |
| **Autosave** | No | Yes | No | No | No | No | No | No | No | No | No |
| **Undo/Redo** | No | Yes | No | No | No | No | No | No | No | No | No |

### Filter Type Comparison

| Filter Type | Bloomberg | TradingView | Finviz | Yahoo | Koyfin | Deepvue |
|-------------|-----------|-------------|--------|-------|--------|---------|
| Dropdown | Yes | Yes | Yes | Yes | Yes | Yes |
| Range Slider | Yes | Yes | No | No | Yes | Yes |
| Min/Max Input | Yes | Yes | Yes | Yes | Yes | Yes |
| Boolean Toggle | Yes | Yes | Yes | Yes | Yes | Yes |
| Text Search | Yes | Yes | No | No | Yes | Yes |
| Drag-and-drop | Yes | No | No | No | No | Yes |
| Visual Logic Builder | No | No | No | No | No | Yes |
| Natural Language | BQL | No | No | No | No | Yes |

### Data Visualization Comparison

| Visualization | Bloomberg | TradingView | Finviz | Yahoo | Simply Wall St | Deepvue |
|---------------|-----------|-------------|--------|-------|----------------|---------|
| Sparklines | No | Yes | No | Yes | No | No |
| Mini Charts | No | Chart View | Hover | No | Snowflake | Grid |
| Heatmap | No | Yes | Best | Yes | No | No |
| Bubble Chart | No | No | Yes | No | No | No |
| Scatter Plot | No | No | No | No | No | No |
| Snowflake | No | No | No | No | Best | No |
| Cell Flash | No | No | No | No | No | Yes |
| Conditional Color | Limited | Yes | Limited | Limited | Yes | Yes |

---

## 4. Best Patterns — The Gold Standard

### 4.1 Filter System Patterns

**Pattern: Progressive Disclosure (Finviz, TradingView)**
- Show 5-8 essential filters by default
- "More Filters" or expandable categories for advanced options
- Prevents overwhelm while maintaining power

**Pattern: Filter Chips Above Results (TradingView, Koyfin)**
- Active filters displayed as removable chips/tags
- Live count of matching results
- One-click removal of any filter

**Pattern: Preset Screens as Onboarding (Every Top Screener)**
- Pre-built screens for common use cases
- Users start with presets, then customize
- Reduces time-to-first-insight

**Pattern: URL-Encoded State (Finviz)**
- All filter state in URL
- Bookmarkable, shareable screens
- No account required

**Pattern: Real-time Result Count (All Modern Screeners)**
- "X of Y stocks match" updates as filters change
- Prevents dead-end screens
- Provides immediate feedback

### 4.2 Table/Grid Patterns

**Pattern: Virtualized Table (Deepvue)**
- Render only visible rows
- Smooth scroll across 1,000+ results
- Essential for performance with large datasets

**Pattern: Sticky First Column (Bloomberg, TradingView)**
- Ticker/Name column always visible
- Scroll horizontally without losing context

**Pattern: Inline Sparklines (Stock Rover, Yahoo)**
- Small charts in table cells
- Visual scanning without clicking

**Pattern: Hover Preview (Finviz)**
- Popup chart on hover
- Quick visual assessment without navigation

**Pattern: Chart View Mode (TradingView, Finviz)**
- Toggle between table and chart grid
- See mini charts for all results at once

### 4.3 Color Coding Patterns

**Pattern: Green/Red Intensity Scale (All Screeners)**
- Green = positive/bullish
- Red = negative/bearish
- Intensity = magnitude

**Pattern: Proprietary Rating Colors (MarketSmith, TipRanks)**
- 1-99 or 1-10 scale with color gradient
- At-a-glance quality assessment

**Pattern: Snowflake Diagram (Simply Wall St)**
- 5-point visual score
- Shape = company profile
- Green intensity = strength

**Pattern: Cell Flash on Update (Deepvue)**
- Real-time visual feedback
- Draws attention to changing data

### 4.4 Navigation Patterns

**Pattern: Keyboard-First (Bloomberg)**
- Every action has a keyboard shortcut
- Command line for direct access
- Maximum efficiency for power users

**Pattern: Autosave + Undo (TradingView)**
- Never lose work
- Freely experiment with filters
- 100-step undo buffer

**Pattern: Shareable Screen Links (TradingView, Finviz)**
- Share complete screener configuration
- Collaborative research
- Community-driven discovery

### 4.5 Integration Patterns

**Pattern: Screen → Chart → Watchlist Loop (TradingView)**
- Seamless flow between tools
- No context switching
- One connected workspace

**Pattern: Screener → Alert (TipRanks, Simply Wall St)**
- Save screen → get notified when new stocks match
- Proactive discovery
- Reduces manual monitoring

**Pattern: AI-Assisted Screening (Deepvue, Fey, StockFilters)**
- Natural language → filters
- Lower barrier to entry
- Faster for experienced users too

---

## 5. Anti-Patterns — What NOT To Do

### 5.1 Filter Anti-Patterns

**❌ Show All Filters at Once (Finviz free tier)**
- 70+ dropdowns visible simultaneously
- Overwhelming for new users
- Leads to analysis paralysis

**❌ Dropdowns for Everything (Finviz)**
- Every filter is a dropdown — slow, clicks required
- No sliders for ranges
- No visual feedback on selection

**❌ No Result Count During Filtering**
- User sets multiple filters, then discovers 0 results
- Wasted effort
- Frustrating experience

**❌ Filters Reset on Navigation**
- User navigates away, filters lost
- No autosave
- Forces repetitive work

**❌ No Preset Screens**
- New users face blank slate
- No guidance on what to screen for
- High abandonment rate

### 5.2 Table/Grid Anti-Patterns

**❌ Pagination Instead of Virtual Scroll (Finviz)**
- 20 rows per page, 572 pages
- Clicking "Next" repeatedly
- Can't scan large result sets

**❌ No Column Customization**
- Forced to see columns you don't need
- Can't add columns you do need
- One-size-fits-all approach

**❌ No Sticky First Column**
- Scroll horizontally, lose ticker context
- Must scroll back to see what stock you're looking at

**❌ Static Charts (Finviz free)**
- Charts are images, not interactive
- Can't zoom, draw, or analyze
- Must click through to another tool

### 5.3 Visual Anti-Patterns

**❌ No Dark Mode (Zacks, Simply Wall St)**
- Eye strain during long sessions
- Looks dated compared to competitors
- Missed expectation for financial tools

**❌ Too Much Whitespace (Simply Wall St)**
- Visual-first approach sacrifices data density
- Can't see many results at once
- Frustrating for power users

**❌ Inconsistent Color Language**
- Green means different things in different contexts
- No clear legend or explanation
- Confuses users

**❌ No Visual Feedback on Filter Changes**
- Table updates silently
- No loading indicator
- User unsure if filters applied

### 5.4 Navigation Anti-Patterns

**❌ No Undo/Redo (Most Screeners)**
- Accidentally remove a filter
- Must recreate from scratch
- TradingView is the exception

**❌ No URL Sharing (Most Screeners)**
- Can't share screen configuration
- Must describe filters in text
- Collaboration is impossible

**❌ No Keyboard Shortcuts (Finviz, Yahoo)**
- Mouse-only interaction
- Slow for power users
- Inaccessible for keyboard navigation

### 5.5 Integration Anti-Patterns

**❌ Screener as Island (Most Screeners)**
- Results don't flow into other tools
- Must manually copy tickers
- Broken workflow

**❌ No Alert from Screener**
- User finds good candidates
- Must manually check daily
- Misses opportunities

**❌ No Mobile Experience (Finviz, Stock Rover)**
- Screener unusable on phone
- Can't screen on the go
- Missed mobile-first users

---

## 6. Recommendations for stock-sim

### 6.1 Must-Have Features (P0)

1. **Progressive Disclosure Filter System**
   - Show 6-8 essential filters by default (Price, Market Cap, P/E, Volume, Sector, Change%)
   - Expandable categories for 200+ advanced filters
   - Search within filters
   - Filter chips above results with live count

2. **Preset Screens**
   - 15+ pre-built screens: "Top Gainers," "Value Plays," "Dividend Aristocrats," "Momentum Breakouts," "Oversold Bounces," etc.
   - User can save custom screens
   - Share screens via URL

3. **High-Performance Virtualized Table**
   - Render 1,000+ rows without lag
   - Sticky first column (ticker)
   - Sortable by any column
   - Column resize, reorder, hide
   - Save column presets

4. **Real-time Result Count**
   - "X of Y stocks match" updates instantly
   - Prevent dead-end screens
   - Show count on filter chips

5. **Green/Red Color Coding**
   - Consistent up/down coloring
   - Intensity scale for magnitude
   - Clear legend

6. **Dark Mode**
   - Default to dark mode
   - Toggle to light mode
   - Financial-grade dark theme

7. **Watchlist Integration**
   - One-click add from screener to watchlist
   - Watchlist can be scanned by screener
   - Alert when new stocks match saved screen

### 6.2 Should-Have Features (P1)

8. **Inline Sparklines/Mini Charts**
   - Small chart in table cell (sparkline)
   - Hover for larger preview
   - Chart View mode toggle

9. **Autosave + Undo**
   - Auto-save filter state
   - 50+ step undo/redo
   - Never lose work

10. **Column Customization**
    - Add/remove/reorder columns
    - 100+ available metrics
    - Save column presets
    - Import presets from templates

11. **Keyboard Shortcuts**
    - `/` to focus search
    - `Esc` to clear filters
    - `Cmd+S` to save screen
    - `Arrow keys` to navigate results
    - `Enter` to open stock

12. **Shareable Screens**
    - Share complete configuration via link
    - Fork others' shared screens
    - Community gallery of screens

13. **Export Options**
    - CSV export
    - Copy to clipboard
    - PDF report generation

### 6.3 Nice-to-Have Features (P2)

14. **AI-Assisted Screening**
    - Natural language filter input
    - "Show me undervalued tech stocks with growing earnings"
    - AI translates to filter criteria

15. **Heatmap View**
    - Sector/Market Cap heatmap
    - Color-coded by performance
    - Click to drill down

16. **Screener Alerts**
    - Weekly email when new stocks match
    - Push notification for significant changes
    - Configurable alert thresholds

17. **Backtesting**
    - Test screen historically
    - See how filtered stocks performed
    - Compare to benchmark

18. **Comparison Tool**
    - Side-by-side comparison of 2-10 stocks
    - Overlay on charts
    - Metric-by-metric comparison

### 6.4 Design Principles

1. **Speed First**: Every interaction should feel instant. Virtualize tables, debounce filter updates, cache results.

2. **Progressive Disclosure**: Don't overwhelm. Show essentials first, reveal complexity on demand.

3. **Visual Hierarchy**: Most important information (ticker, price, change) should be most prominent. Less important metrics recede.

4. **Consistent Color Language**: Green = up/good, Red = down/bad. Always. No exceptions.

5. **Keyboard-Accessible**: Every action should be possible without a mouse. Power users will thank you.

6. **Mobile-First Responsive**: Design for mobile, enhance for desktop. The screener should work on any screen.

7. **Save Everything**: Filter state, column configuration, sort order. Users should never lose their work.

8. **Shareable**: Every screen configuration should be shareable via URL. Collaboration drives growth.

9. **Accessible**: WCAG 2.1 AA minimum. Screen reader support, keyboard navigation, high contrast.

10. **Delightful**: Small touches matter. Cell flash on update, smooth transitions, hover previews. Make the data come alive.

### 6.5 Recommended Tech Stack

- **Table**: TanStack Table (virtualized) or AG Grid
- **Charts**: Lightweight Charts (TradingView) or Recharts for sparklines
- **State Management**: Zustand or Jotai for filter state
- **URL State**: nuqs or custom serializer for shareable screens
- **Styling**: Tailwind CSS with CSS variables for theming
- **Dark Mode**: CSS variables + system preference detection
- **Keyboard**: Custom hotkey system with focus management

### 6.6 Screen Layout Blueprint

```
┌─────────────────────────────────────────────────────────────┐
│  [Search Bar]                              [Dark Mode] [⚙️] │
├─────────────────────────────────────────────────────────────┤
│  Preset Screens: [Top Gainers] [Value] [Dividends] [+]     │
├─────────────────────────────────────────────────────────────┤
│  Active Filters: [P/E < 15 ×] [Market Cap > $1B ×] [+]   │
│  Showing 47 of 8,234 stocks                                 │
├─────────────────────────────────────────────────────────────┤
│  ▲ Ticker │ Company │ Sector │ Price │ Change │ P/E │ Vol  │
│  ─────────┼─────────┼────────┼───────┼────────┼─────┼───── │
│  AAPL     │ Apple   │ Tech   │ $185  │ +2.3%  │ 28  │ 52M  │
│  MSFT     │ Micro.. │ Tech   │ $420  │ +1.1%  │ 35  │ 18M  │
│  GOOGL    │ Alpha.. │ Tech   │ $175  │ -0.5%  │ 24  │ 22M  │
│  ...      │ ...     │ ...    │ ...   │ ...    │ ... │ ...  │
├─────────────────────────────────────────────────────────────┤
│  [← Prev]  Page 1 of 3  [Next →]     [Export CSV] [Save]   │
└─────────────────────────────────────────────────────────────┘
```

---

## Appendix A: Screener Pricing Comparison

| Screener | Free Tier | Basic Paid | Premium Paid | Enterprise |
|----------|-----------|------------|--------------|------------|
| Bloomberg | No | $24,000/yr | — | Custom |
| TradingView | Yes (limited) | $14.95/mo | $69.95/mo | $239.95/mo |
| Finviz | Yes (delayed) | $39.50/mo | — | — |
| Yahoo Finance | Yes | $8/mo | $40/mo | — |
| MarketSmith | No | $149.99/mo | — | — |
| Koyfin | Yes | $15/mo | $35/mo | — |
| StockAnalysis | Yes (ads) | $7.99/mo | $13.27/mo | — |
| Simply Wall St | Yes (limited) | $10.95/mo | $21.50/mo | — |
| Zacks | Yes | $249/yr | — | — |
| TipRanks | Yes (limited) | $15.99/mo | $29.99/mo | — |
| Deepvue | No | $29/mo | — | — |

## Appendix B: Glossary

- **Virtualized Table**: Only renders visible rows in the DOM for performance
- **Progressive Disclosure**: Show minimal options initially, reveal more on demand
- **Filter Chips**: Removable tags showing active filters
- **Sparkline**: Mini chart in a table cell
- **Heatmap**: Color-coded grid showing performance by sector/market cap
- **Snowflake**: Simply Wall St's 5-point company health diagram
- **Smart Score**: TipRanks' proprietary 1-10 rating
- **Zacks Rank**: Zacks' proprietary earnings estimate revision ranking
- **RS Rating**: IBD's 1-99 relative strength rating
- **IV Rank**: Implied Volatility Rank — where current IV sits vs 52-week range
- **Pine Script**: TradingView's custom indicator/strategy language
- **BQL**: Bloomberg Query Language for programmatic screening
- **ANY/ALL Logic**: Boolean operators for combining filter conditions

---

*Document generated July 2026. Based on research of 15+ stock screeners across web, desktop, and mobile platforms.*
