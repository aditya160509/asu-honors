# Future Lab & Macro Shocks — Explained Simply

This document explains, in plain language, how the **Future Lab** feature works: what happens when you pick a "macro shock" scenario and a strength factor, and how that turns into a simulated price graph for a company. It's written for someone who understands markets and systems generally but doesn't want to read raw source code to understand the mechanism.

For the precise technical/mathematical spec (formulas, config values, file references), see [price-value-engine.md](./price-value-engine.md). This document is the "explain it like I'm smart but new to this codebase" version.

---

## 1. The one-sentence version

**A macro shock doesn't touch any company's price directly.** It forces the *simulated economy* into a chosen state (e.g. "recession"), and every company then reacts to that forced economy through its own personal sensitivity, volatility, and pull-toward-fair-value — exactly the same way it always reacts to normal economic ups and downs. You're not hand-painting the chart; you're changing the weather and watching each company's own physics respond to it.

---

## 2. What a "branch" is

Every simulated company has a running price history — day by day, computed by the simulation engine. **Future Lab lets you fork that history at any point in time**, like a save-file branch in a game:

- The fork is called a **Timeline** (a "branch").
- It starts as an exact copy of everything up to the fork date — same prices, same company fundamentals, same economic state.
- From that point on, it runs forward independently, using whatever scenario settings you attach to it.
- You can create multiple branches from the same fork point (e.g. "no shock" vs. "mild recession" vs. "severe recession") and compare them side-by-side.

That's what the **Timeline Comparison** chart shows: several branches, all starting from the same point, drawn on the same "days since fork" axis so you can see how they diverge.

---

## 3. What a "macro shock" actually configures

When you pick a macro shock in the Branch Wizard, you're setting three things:

| Setting | What it means |
|---|---|
| **Forced phase** | Which economic phase to force: `expansion`, `peak`, `contraction`, or `trough` |
| **Strength / factor** (0.0 – 1.0) | How hard to force it (see below) |
| **Duration** | How many simulated days the forcing lasts |

### Understanding "strength"

Normally, the simulated economy moves between phases on its own, like a weather system — each day there's some probability it stays in the current phase or transitions to the next one (this is a random process called a **Markov chain**: the next phase depends only on the current phase and a set of transition probabilities).

The **strength** setting controls how much you're overriding that natural randomness:

- **Strength = 1.0 (hard lock):** The economy is *guaranteed* to be in your chosen phase every single day of the shock. No dice roll, no exceptions.
- **Strength = 0.5 (a nudge):** Your chosen phase gets extra weight added to the dice roll — more likely, but not guaranteed. The economy can still naturally drift to a different phase if the random draw goes that way.
- **Strength = 0.0:** No effect — the economy behaves exactly as it would with no shock at all.

Named presets like "Mild Recession" or "Severe Recession" are just pre-packaged combinations of these three settings (e.g. Severe Recession = force `contraction`, strength `1.0`, for 250 days, plus an extra penalty to financial-quality scores for leverage-heavy industries like banking and real estate).

---

## 4. What happens on each simulated day (the "tick")

The simulation advances one day at a time. Each day is called a **tick**. Here's what happens on every tick, in order:

### Step A — Decide the economic weather for the day

1. **Roll (or force) the cycle phase.** If your shock is active for this day, the phase-transition dice are loaded in your favor (or locked entirely, if strength = 1.0).
2. **Convert the phase into macro numbers**, each with a small dash of randomness so it doesn't feel robotic:
   - Overall market direction for the day (`market_factor_return`)
   - GDP growth
   - Interest rate
   - Market sentiment

   For example, a "contraction" phase's baseline numbers are roughly: market down ~0.03% that day, GDP growth ~‑1.5%, sentiment negative — each nudged up or down slightly by a random draw so two contraction days aren't identical.

3. **Compute a sector-level shock** for each industry, based on how sensitive that industry is to the economy, plus its own bit of randomness. A cyclical industry like construction reacts more to a recession than a defensive one like utilities.

At this point, nothing company-specific has happened yet — we've just decided "what kind of economic day is this."

### Step B — Each company reacts to that day

This is the actual price-update formula, applied to every company independently, every tick:

```
new_deviation = old_deviation
               − (pull-back-to-fair-value term)
               + (this company's own news/momentum/earnings signal)
               + (this company's sensitivity to the overall market) × (today's market shock)
               + (this company's sensitivity to its sector) × (today's sector shock)
               + (this company's own random noise for today)

Price = FairValue × e^(new_deviation)
```

In plain words:

- Every company has a **"fair value"** (intrinsic value) it keeps drifting back toward — like a rubber band pulling price back to what the company is actually worth. This is called **mean reversion**.
- Each day, that pull is offset by a mix of: the company's own story (earnings surprises, news, momentum), how strongly it's tied to the broader market, how strongly it's tied to its sector, and pure randomness unique to that company.
- The macro shock **only changes two of those inputs** — the market-wide shock and the sector shock. It never touches the company's own fair value calculation, its own news, or its own personal randomness directly.

### Why every company reacts differently to the same shock

Because each company has its own:
- **Market beta** — how much it amplifies or dampens overall market swings (a high-beta growth stock swings harder; a low-beta utility barely moves)
- **Sector beta** — how exposed it is to its specific industry
- **Volatility** — how noisy/jumpy its price naturally is
- **Fair value trajectory** — its own earnings and fundamentals, independent of the shock

So during the same forced recession, a highly-leveraged real-estate company might crash, while a defensive consumer-staples company barely dips — exactly like real markets. The betas themselves also get a tiny random jitter every day, so even two similar companies in the same sector won't move in perfect lockstep.

---

## 5. Where does randomness come in, exactly?

There isn't one dice roll — there are several layered ones, each doing a different job:

| Layer | What it randomizes |
|---|---|
| Phase transition | Whether the economy moves to a new phase (irrelevant if shock strength = 1.0) |
| Macro numbers | Small jitter on GDP/rate/sentiment/market-return around the phase's baseline |
| Sector shock | Small jitter per industry |
| Company beta | Small daily jitter on each company's market/sector sensitivity (keeps companies from moving in perfect lockstep) |
| Company price step | Company-specific noise term in the price formula itself |

This makes the simulation a **mean-reverting random process** (technically an Ornstein–Uhlenbeck process running in log-price space) — not a plain random walk, and not a full Monte Carlo simulation (which would run many random paths and average them). Each branch you create is **one single path**, determined by its own random seed. Two branches with identical shock settings but different seeds will still diverge slightly, just like two different "runs" of the same scenario would in real life.

---

## 6. Putting it all together: from click to chart

1. **You configure a branch** in the wizard: pick a macro shock scenario (or build one manually), set duration, confirm.
2. **The system forks a new Timeline**, copies over the current prices/fundamentals, and attaches your shock setting as a time-boxed override.
3. **The engine fast-forwards** that branch day by day. Each day:
   - It checks whether your shock is active today.
   - It computes the day's economic weather (forced or natural).
   - It runs the price formula for every company, factoring in that day's weather plus each company's own personal characteristics and randomness.
4. **Every day's closing price is saved** to that branch's price history.
5. **The comparison chart** simply plots each branch's saved price history side by side, aligned by "days since the branch point," and flags where two branches' prices diverge by more than 3%.

No extra math happens at chart time — the chart is just a direct plot of the day-by-day prices that were already computed and saved during the fast-forward.

---

## 7. Quick glossary

- **Timeline / branch** — an independent forked copy of the simulation from a chosen point in time.
- **Tick** — one simulated day.
- **Cycle phase** — the economy's current state: expansion, peak, contraction, or trough.
- **Strength** — how forcefully a macro shock overrides the natural phase transitions (0 = no effect, 1 = total lock).
- **Fair value / intrinsic value** — what a company "should" be worth based on its fundamentals; price is pulled toward this over time.
- **Mean reversion** — the tendency of price to drift back toward fair value rather than wander off forever.
- **Beta (market/sector)** — how sensitive a company's price is to overall market or sector-wide moves.
- **Volatility** — how large a company's random day-to-day price swings tend to be.
- **Divergence marker** — the point on the comparison chart where two branches' prices have drifted more than 3% apart.

---

*For exact formulas, config parameter names, and file/line references, see [price-value-engine.md](./price-value-engine.md).*
