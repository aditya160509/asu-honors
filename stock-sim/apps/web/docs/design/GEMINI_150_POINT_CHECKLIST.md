# Institutional Trading Terminal — 150-Point Checklist
Status: Inspiration / Design Reference
Source: Gemini
Purpose: This is a visual design specification only. It must never override architecture or business logic. Future implementation should follow this document where technically feasible.

---

As the Design Director for an institutional trading platform, my philosophy is absolute: we are building a high-precision instrument, not a consumer app. Our users manage billions of dollars and stare at these screens for twelve hours a day. Every pixel must serve a purpose. We optimize for data density, cognitive clarity, and execution speed.

Here is the ultimate 150-point checklist for an institutional trading terminal, grouped by category and ranked by impact within each section.

---

## Navigation

1. **Global Command Line:** Implement a persistent, keyboard-first command line with instant semantic parsing (e.g., typing "AAPL Equity GP" instantly loads the price chart).
2. **Custom Shortcut Architecture:** Allow traders to map any function, screen, or order type to customized macro keystrokes.
3. **Multi-Monitor Tear-Offs:** Ensure every widget, chart, and order ticket can be torn off and snapped seamlessly across a 4-to-8 monitor workspace.
4. **Workspace State Memory:** Automatically save the exact state, position, and ticker linkage of all windows to a cloud profile upon exit.
5. **Contextual Right-Click Menus:** Provide immediate access to "Buy," "Sell," "Alert," and "Deep Dive" upon right-clicking any ticker anywhere in the terminal.
6. **Cross-Link Grouping:** Allow users to assign color-coded "link groups" to widgets so changing the ticker in a Level 2 order book updates the adjacent chart and news feed.
7. **Breadcrumb Trails:** Use deep-dive breadcrumbs (e.g., *Equities > Tech > Semiconductors > NVDA*) to allow rapid upward traversal.
8. **Recent Asset Drawer:** Create a highly accessible, auto-updating panel of the last 20 accessed instruments.
9. **No Mega-Menus:** Eliminate nested hover-menus; navigation must be flat, searchable, and immediate.
10. **Emergency Workspace Reset:** Provide a one-click macro to instantly revert all screens to the user's primary morning layout.

## Dashboard

11. **Above-the-Fold Prioritization:** Reserve the most prominent screen real estate strictly for live P&L, active risk metrics, and pending order statuses.
12. **Modular Snap-to-Grid:** Utilize a rigid grid system where all dashboard modules snap together perfectly with zero wasted pixels.
13. **Unified Global Alerts:** Aggregate fill confirmations, risk limit warnings, and breaking news into a single, high-contrast ticker stream.
14. **Dynamic Market-State Layouts:** Allow the dashboard to automatically shift layouts based on Pre-Market, Market Open, and After-Hours states.
15. **Compact Mode:** Provide a toggle to strip all padding and headers, converting widgets into maximum-density data blocks.
16. **Persistent Margin & Buying Power:** Keep critical account capital metrics visible at all times, independent of scrolling.
17. **Inline Mini-Sparklines:** Embed tiny 30-day trend lines next to portfolio holdings to provide historical context without opening a chart.
18. **"Liquidate All" Safeguard:** Design an "Emergency Flat" macro button protected by a rigid, two-step physical confirmation friction.
19. **Correlated Asset Visuals:** Visually group assets that are currently showing high correlation or divergence based on user-defined algorithms.
20. **Collapsible Non-Core Widgets:** Allow secondary tools (like economic calendars) to collapse into minimalist tabs when not actively used.

## Market Explorer

21. **Boolean Screener Logic:** Build an advanced screener supporting multi-variate logic (e.g., P/E < 15 AND Yield > 4% NOT Sector: Energy).
22. **Real-Time Heat Maps:** Implement sector and index heat maps that update instantly and allow semantic zooming from macro-sector down to individual tickers.
23. **Cross-Asset Matrix:** Provide a correlation matrix visualizing relationships between equities, fixed income, FX, and commodities.
24. **Abnormal Volume Surfacing:** Push immediate visual alerts into the explorer when options or equity volumes exceed standard standard deviations.
25. **Macro Event Linking:** Tie the economic calendar directly to the explorer, automatically highlighting assets impacted by upcoming data drops.
26. **Pre/Post-Market Mover Panels:** Create a dedicated, auto-sorting panel strictly for liquidity and movement outside standard trading hours.
27. **Aggregated Sentiment Gauges:** Visualize institutional sentiment by scraping and quantifying analyst upgrades, news tone, and block trade ratios.
28. **One-Click Screener Save:** Allow traders to save complex screener parameters as single-click workspace widgets.
29. **Split-Pane Historical Comparison:** Allow side-by-side comparison of live order books against historical analogues.
30. **Geographic Status Indicators:** Use concise, color-coded dots to denote which global exchanges are currently open, closed, or on holiday.

## Company Details

31. **Executive Tear Sheet:** Consolidate EPS, P/E, Dividend Yield, and Market Cap into a high-density, top-level summary strip.
32. **Visual Capital Structure:** Graphically represent the company's debt maturity schedule and equity tranches to instantly communicate leverage risk.
33. **Filtered News Stream:** Integrate a live news feed strictly filtered to the active ticker, stripping out generic market noise.
34. **Insider Action Timeline:** Plot institutional ownership changes and executive buying/selling on a chronological visual timeline.
35. **Segmented Revenue Graphics:** Display revenue breakdowns by geographic region and product line using precise stacked bar charts.
36. **Direct Peer Comparison:** Embed a localized data table comparing the active ticker's valuation metrics against its top 5 direct competitors.
37. **Earnings Consensus Highlight:** Prominently display upcoming earnings dates alongside the street's consensus estimates.
38. **Supply Chain Node Graph:** Visualize the company's dependency risk by mapping top suppliers and largest customers.
39. **Live Transcript Viewer:** Include an earnings call transcript reader that automatically highlights key terms (e.g., "guidance," "headwinds").
40. **ESG & Compliance Module:** Integrate a quick-reference scoring module for institutional funds with strict ESG mandates.

## Charts

41. **Zero-Latency Rendering:** Build charts on WebGL/Canvas to ensure smooth rendering of sub-second tick data without browser lag.
42. **Magnetic Drawing Tools:** Ensure trendlines and Fibonacci retracements automatically snap to the exact OHLC (Open, High, Low, Close) data points.
43. **Fundamental Overlays:** Allow users to overlay fundamental data metrics (like historical P/E or revenue) directly onto price action.
44. **Split-Timeframe Mode:** Enable users to view the same asset across multiple timeframes (e.g., 1-minute, 1-hour, 1-day) in adjacent, synchronized panes.
45. **VWAP and Volume Profile Defaults:** Make Volume Weighted Average Price and horizontal Volume Profiles one-click toggleable overlays.
46. **Synchronized Crosshairs:** When a trader hovers over one chart, synchronize the crosshair across all other charts linked to that asset group.
47. **Log-Scale Hotkey:** Allow instant switching to logarithmic scaling via a single key press for long-term equity analysis.
48. **Custom Algorithmic Scripting:** Provide a built-in interface for quants to write, test, and visually overlay custom trading algorithms.
49. **Bar-by-Bar Replay:** Implement a simulation mode that allows users to replay historical market action tick-by-tick for strategy testing.
50. **Semantic Zooming:** Ensure zooming smoothly transitions from multi-year monthly candles down to millisecond-level tick lines.

## Tables

51. **Instant Client-Side Sorting:** Guarantee that sorting, filtering, and scrolling through grids with 100,000+ rows happens with zero buffering.
52. **Frozen Anchors:** Lock critical columns (Ticker, Last Price, Position) and header rows so context is never lost during deep horizontal scrolling.
53. **Right-Aligned Magnitudes:** Right-align all numerical data to allow rapid vertical scanning of decimal placements and magnitude.
54. **Directional Color Coding:** Use stark red/green coloring for numerical changes to bypass the need for scanning minus signs.
55. **Adjustable Row Density:** Allow traders to compress row heights to as little as 16px to maximize the number of tickers visible simultaneously.
56. **Excel-Style Navigation:** Support full keyboard navigation within data grids (arrows, shift-select, enter to edit).
57. **Bulk Action Routing:** Enable checkbox multi-selection for bulk order routing, canceling, or watchlist grouping.
58. **Inline Sparklines:** Place tiny trend lines directly inside table cells to provide historical context next to the current price.
59. **Drag-and-Drop Columns:** Allow seamless column reordering and width adjustments that automatically save to the user's layout profile.
60. **One-Click Data Export:** Provide a permanent header icon to instantly dump the current table view into a clean CSV format.

## Animations

61. **Motion for Status Only:** Eliminate all decorative animations; motion must strictly communicate data updates or execution status.
62. **300ms Tick Flashes:** Flash cells brightly on a tick update, fading to the background neutral color within exactly 300 milliseconds.
63. **Zero-Delay Tab Switching:** Use instantaneous (0ms) visual transitions when switching tabs to preserve the trader's cognitive flow.
64. **Order Book Slide:** Animate new rows entering a live order book with a rapid, subtle slide-down to help the eye track the price movement.
65. **Determinate Progress:** Only use loading animations when a specific duration can be estimated; otherwise, use skeleton screens.
66. **Price Alert Pulses:** Use a highly localized, high-contrast pulse effect to draw the eye precisely to a triggered user alert.
67. **Instant Tooltips:** Ensure contextual tooltips appear within 50ms of a hover, with absolutely no fade-in styling.
68. **Rigid Window Docking:** Make widget snapping and window docking feel magnetic, immediate, and rigid—never bouncy or elastic.
69. **Execution Overlays:** Animate successful order executions with a brief, translucent overlay that automatically disappears without user action.
70. **Global Motion Kill-Switch:** Provide a systemic accessibility toggle to disable all motion for users who require absolute static density.

## Micro Interactions

71. **Immediate Depression States:** Ensure buttons visually depress the millisecond they are clicked to provide undeniable feedback before the server responds.
72. **Dynamic Cursors:** Change the mouse cursor based on context (e.g., precise crosshairs over charts, horizontal resize arrows over columns).
73. **Row Hover Highlights:** Highlight the entire row in a dense table upon hover to prevent a user from misreading data across distant columns.
74. **Click-to-Copy Data:** Make every CUSIP, ISIN, and Order ID one-click copyable, confirming with a micro-checkmark.
75. **Inline Order Validation:** Validate quantity and limit price inputs instantaneously as the user types, highlighting errors before submission.
76. **Scroll-Wheel Tick Increments:** Allow users to hover over a price input and use the mouse wheel to notch the limit price up or down by exact tick sizes.
77. **Auditory Execution Cues:** Provide distinct, toggleable, low-frequency sounds for successful fills, and harsh alerts for rejected orders.
78. **Smart Default Sizing:** Auto-populate order quantity fields based on the trader's historical average lot size for that specific asset class.
79. **Draft Order Indicators:** Visually distinguish staged, un-routed orders from live orders using a distinct dashed border or muted opacity.
80. **Absolute Time Tooltips:** When displaying relative timestamps (e.g., "3m ago"), show the exact server time down to the second upon hover.

## Loading

81. **UI Shell Prioritization:** Load the terminal's structural grid and static UI elements instantly, then stream the real-time data sequentially.
82. **Skeleton Screens:** Use skeleton wireframes matching the exact dimensions of incoming data grids to prevent any layout shifting.
83. **Stale Data Indicators:** If a WebSocket disconnects, immediately gray-out the stale pricing data and display a "Reconnecting" badge.
84. **IndexedDB Caching:** Cache non-volatile fundamental data locally in the browser to ensure instantaneous loads on repeated views.
85. **Localized Spinners:** Place loading indicators strictly within the specific widget fetching data, never blocking the entire screen or workspace.
86. **Optimistic Watchlist Updates:** Instantly reflect added tickers in the UI while the server confirmation happens silently in the background.
87. **Sub-3 Second Boot:** Optimize the entire application bundle so the terminal goes from cold-start to fully actionable in under three seconds.
88. **Volatility Throttling:** Program the UI to automatically throttle non-critical background data fetches during extreme market volatility to preserve bandwidth for order routing.
89. **Query Progress Estimates:** For massive historical data pulls, provide a deterministic read-out (e.g., "Parsing row 45k of 120k").
90. **Latency Ping Display:** Maintain a permanent, low-opacity indicator in the bottom corner showing the exact millisecond ping to the exchange servers.

## Accessibility

91. **Total Keyboard Control:** Guarantee that every single action, trade, and navigation path can be executed flawlessly without a mouse.
92. **WCAG AAA Contrast:** Maintain strict maximum-contrast ratios between text and the dark terminal background for flawless readability.
93. **Screen Reader Chart Tables:** Ensure all visual charts have an invisible, highly structured data table behind them for screen reader accessibility.
94. **Colorblind-Safe Heatmaps:** Replace standard Red/Green heatmaps with Blue/Orange or monochromatic scales for users with Protanopia/Deuteranopia.
95. **Non-Breaking Text Scaling:** Allow traders to increase global font size without causing table columns to overlap or widgets to break.
96. **High-Contrast Theme:** Offer a brutalist theme option that removes all shades of gray, utilizing only pure black, pure white, and pure action colors.
97. **Explicit Aria-Labels:** Assign precise, descriptive labels to all icon-only buttons (e.g., "Tear off options chain widget").
98. **Stark Focus States:** Ensure the current keyboard focus is highlighted by a thick, unmistakable border.
99. **Anti-Seizure Modes:** Allow users to entirely disable the rapid flashing of Level 2 order books to prevent photic triggers.
100. **Dyslexia Font Support:** Allow the uploading or selection of specialized fonts (like OpenDyslexic) for text-heavy news feeds.

## Design System

101. **Strict Token Architecture:** Control every color, spacing unit, and font size through a single source of truth (design tokens) to ensure absolute consistency.
102. **Financial Component Library:** Build a customized library of complex, reusable components unique to finance (e.g., depth-of-market ladders, yield curves).
103. **Rigid 4px Grid:** Align all UI elements to a strict 4-pixel baseline grid to guarantee mathematically perfect vertical and horizontal alignment.
104. **Standardized Lexicon:** Enforce universal terminology across the platform (e.g., explicitly choosing "Bid/Ask" over "Buy/Sell" in market depth views).
105. **Predictable Z-Index Hierarchy:** Establish strict layering rules so a critical order confirmation modal is never accidentally hidden behind a chart tooltip.
106. **Domain-Specific Iconography:** Design a bespoke icon set where a bond, an equity, and a derivative have distinctly different silhouettes.
107. **Universal State Definitions:** Document and build every component to support Default, Hover, Focus, Active, Disabled, Error, and Loading states.
108. **Workflow Interaction Patterns:** Standardize exactly how a user transitions from research, to staging, to execution, so muscle memory applies universally.
109. **Isolated Sandbox Testing:** Maintain a component playground where the development team can stress-test UI elements with simulated market data.
110. **Design QA Enforcement:** Require that every new feature passes a strict visual QA against the design system guidelines before deployment.

## Spacing

111. **Maximum Data Density:** Reduce cell padding to 2px or 4px vertically to ensure the maximum number of rows fits on screen without scrolling.
112. **Gestalt Proximity on Tickets:** Group related inputs tightly together on an order ticket (e.g., Quantity and Price) while separating the final Submit button.
113. **Strategic Negative Space:** Use narrow bands of negative space, rather than heavy borders, to delineate separate asset classes on a crowded dashboard.
114. **Compact Target Areas:** Keep desktop click targets highly compact; prioritize the density of information over generous touch-friendly padding.
115. **Mathematical Margin Consistency:** Ensure the gutter width between widgets is identical across the entire grid to maintain a disciplined aesthetic.
116. **Border Elimination:** Remove redundant visual borders within tables and lists; rely on background row striping (zebra striping) to guide the eye.
117. **Minimal Vertical Navigation:** Shrink the global header and footer to the absolute minimum vertical height to prioritize the data payload.
118. **Accordion Spacing Control:** Use tight, collapsible accordion menus in deep-dive panels to hide secondary metrics until requested.
119. **Natural Alignment Columns:** Strictly enforce left-alignment for text and right-alignment for numbers to create natural, invisible vertical columns.
120. **Density Toggles:** Provide a global setting allowing the user to switch between "Standard," "Compact," and "Ultra" spacing modes.

## Typography

121. **Monospaced Numerics:** Mandate a highly legible, monospaced font for all pricing and numerical data to ensure decimal points align perfectly in columns.
122. **High-Legibility Sans-Serif:** Use a clean, highly readable system font (like Inter, Roboto, or a custom build) for all UI labels and text.
123. **Tabular Figure Formatting:** Ensure all fonts utilize tabular figures (fixed width for each number) so rapid price ticks do not cause the text to jitter horizontally.
124. **Hierarchy via Weight:** Distinguish critical information (like Last Traded Price) by using a heavier font weight rather than increasing the font size.
125. **Slashed Zeros:** Require a font that features slashed or dotted zeros to immediately differentiate '0' from 'O'.
126. **Distinct Character Forms:** Select typography that clearly distinguishes between the number '1', lowercase 'l', and uppercase 'I'.
127. **Restricted Font Scaling:** Limit the terminal to a strict 4-to-5 point font scale to maintain a tight, uniform, engineered look.
128. **Selective ALL CAPS:** Reserve uppercase strictly for Tickers, CUSIPs, and Exchange Codes; never use it for continuous reading.
129. **Muting by Color, Not Size:** Deprioritize secondary info (like exchange codes next to a price) by shifting the text to a darker gray, rather than shrinking it to an unreadable size.
130. **Crisp Anti-Aliasing:** Configure CSS/rendering properties to ensure text remains razor-sharp across both standard and 4K displays.

## Color

131. **True Dark Theme Base:** Anchor the terminal in a deep charcoal or true black background to significantly reduce eye fatigue over 12-to-14 hour shifts.
132. **Universal Semantic Meaning:** Reserve Pure Green strictly for Up/Bid/Profit and Pure Red strictly for Down/Ask/Loss. Never use these for generic UI states.
133. **Exclusive Action Hue:** Dedicate a distinct, high-contrast color (e.g., Bloomberg Orange or a sharp Cobalt) exclusively for primary execution buttons.
134. **Restricted Palette:** Limit the total UI palette to no more than six primary colors to eliminate visual noise and maintain professional sobriety.
135. **Hierarchy via Opacity:** Denote background hierarchy by altering the lightness of the dark theme (e.g., darker for the canvas, slightly lighter for active panels).
136. **Critical Warning Amber:** Reserve bright yellow or amber exclusively for warnings, risk limit breaches, and system alerts.
137. **Flat and Matte:** Eliminate all gradients, gloss, and drop shadows; flat, matte colors communicate utilitarian precision.
138. **Selection Contrast:** Ensure that highlighting text or selecting a row inverts the color or provides a background with a WCAG AAA contrast ratio.
139. **Saturation for Volume:** In heat maps and volume profiles, use color saturation (brightness/intensity) to denote trading volume rather than shifting the hue.
140. **De-saturated Neutrals:** Use heavily de-saturated grays for all borders, dividers, and inactive icons so they recede from the user's attention.

## Professionalism

141. **Zero Gamification:** Ban all gamified UI elements; there are no animations, confetti, badges, or "streaks" when dealing with institutional capital.
142. **Deterministic Reliability:** Design every element to project absolute stability; the interface must feel like a robust, industrial instrument.
143. **Actionable Error States:** Write error messages that are brutally clear, diagnosing the exact problem (e.g., "Margin Limit Exceeded by $40M") without colloquialisms.
144. **Data Neutrality:** Ensure layout choices never inadvertently bias a trader; avoid making "Buy" buttons visually larger or more appealing than "Sell" buttons.
145. **Undeniable Destructive Confirmation:** Require explicit, multi-step confirmation for mass-cancellations or liquidations, removing any chance of "fat-finger" errors.
146. **Expert-Level Assumption:** Hide introductory tooltips and onboarding flows; design for experts who know the domain and optimize for their speed.
147. **Raw Data Exposure:** Provide native UI hooks allowing quantitative analysts to easily query the underlying database or copy raw API calls.
148. **Surface-Level Functionality:** Never hide execution-critical features inside a hamburger menu; if it affects P&L, it lives on the surface.
149. **Visual Sobriety:** Ensure the terminal’s aesthetic communicates security, precision, and institutional trust at a glance.
150. **Respect for Attention:** Treat the trader's attention as the platform's most expensive resource; design every component to minimize cognitive load and visual search time.
