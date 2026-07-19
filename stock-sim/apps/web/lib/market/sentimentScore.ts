import type { CompanyGridItem, NewsItem, PriceHistoryItem } from "@/lib/api/types";

/**
 * Trailing-window z-score tracker. Each driver keeps its own rolling window of
 * raw values; a fresh reading is expressed as standard deviations from that
 * window's own mean, so no driver's contribution is capped by an arbitrary
 * absolute scale (e.g. "avg day change * 12") — it's judged against its own
 * recent normal range instead.
 */
const WINDOW_SIZE = 60;
const MIN_SAMPLES_FOR_STDDEV = 8;

export class TrailingZScore {
  private readonly window: number[] = [];

  get sampleCount(): number {
    return this.window.length;
  }

  /** True once push() scores against a real trailing window rather than
   *  falling back to the neutral 0 z-score used pre-warm-up. */
  get isWarm(): boolean {
    return this.window.length >= MIN_SAMPLES_FOR_STDDEV;
  }

  /** Seed the trailing window from historical data (e.g. price history) without
   *  scoring anything, so the tracker starts warm instead of cold. Ignored once
   *  the window already has live-pushed samples, to avoid overwriting real data. */
  seed(rawValues: number[]): void {
    if (this.window.length > 0) return;
    for (const v of rawValues.slice(-WINDOW_SIZE)) {
      this.window.push(v);
    }
  }

  /** Push a new raw reading and return its z-score against the trailing window (pre-push). */
  push(raw: number): number {
    const z = this.score(raw);
    this.window.push(raw);
    if (this.window.length > WINDOW_SIZE) {
      this.window.shift();
    }
    return z;
  }

  private score(raw: number): number {
    if (this.window.length < MIN_SAMPLES_FOR_STDDEV) {
      return 0;
    }
    const mean = this.window.reduce((sum, v) => sum + v, 0) / this.window.length;
    const variance = this.window.reduce((sum, v) => sum + (v - mean) ** 2, 0) / this.window.length;
    const stddev = Math.sqrt(variance);
    if (stddev === 0) {
      return 0;
    }
    return (raw - mean) / stddev;
  }
}

/** Maps a z-score to a 0-100 scale via a logistic squash, centered at 50. */
export function zScoreToPercent(z: number, steepness = 22): number {
  const squashed = 1 / (1 + Math.exp(-z));
  return Math.max(0, Math.min(100, 50 + (squashed - 0.5) * 2 * (50 + steepness)));
}

function toNumber(value: number | string | null | undefined, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export interface SentimentRawInputs {
  /** Engine's per-cycle-phase sentiment constant, already on a -1..1 scale. */
  cycleRaw: number;
  /** Fraction (0..1) of companies with a non-negative day change. */
  breadthRaw: number;
  /** Average day-change percent across all companies. */
  momentumRaw: number;
  /** Severity-weighted average news sentiment (-1..1 scale, magnitude-scaled by severity). */
  newsRaw: number;
  /** Cross-sectional average volatility across all companies — a fear/uncertainty proxy. */
  volatilityRaw: number;
  /** % of companies trading within 5% of their 52w high minus % within 5% of their 52w low. */
  highLowBreadthRaw: number;
}

export interface SentimentDrivers {
  cycle: number;
  breadth: number;
  momentum: number;
  news: number;
  volatility: number;
  highLowBreadth: number;
  composite: number;
  /** Which drivers still have too few trailing samples for a trustworthy z-score
   *  (reading a placeholder neutral 50 rather than a real signal). */
  warmingUp: {
    cycle: boolean;
    breadth: boolean;
    momentum: boolean;
    news: boolean;
    volatility: boolean;
    highLowBreadth: boolean;
  };
}

/** Fixed blend weights across the six drivers (sum to 1). Cycle carries the largest
 *  single weight since it reflects the simulation's ground-truth macro regime;
 *  the remaining weight is split across market-observable signals. */
const WEIGHTS = {
  cycle: 0.25,
  breadth: 0.15,
  momentum: 0.2,
  news: 0.1,
  volatility: 0.15,
  highLowBreadth: 0.15,
} as const;

export function computeRawInputs(
  companies: CompanyGridItem[],
  cycleMarketSentiment: number | null | undefined,
  relevantNews: NewsItem[]
): SentimentRawInputs {
  const cycleRaw = cycleMarketSentiment ?? 0;

  const breadthRaw = companies.length > 0
    ? companies.filter((c) => toNumber(c.day_change_pct) >= 0).length / companies.length
    : 0.5;

  const momentumRaw = companies.length > 0
    ? companies.reduce((sum, c) => sum + toNumber(c.day_change_pct), 0) / companies.length
    : 0;

  const newsWeightedSum = relevantNews.reduce((sum, item) => {
    const sign = item.sentiment === "positive" ? 1 : item.sentiment === "negative" ? -1 : 0;
    return sum + sign * toNumber(item.severity, 0);
  }, 0);
  const newsSeverityTotal = relevantNews.reduce((sum, item) => sum + Math.abs(toNumber(item.severity, 0)), 0);
  const newsRaw = newsSeverityTotal > 0 ? newsWeightedSum / newsSeverityTotal : 0;

  const volSamples = companies.map((c) => toNumber(c.volatility, NaN)).filter((v) => Number.isFinite(v));
  const volatilityRaw = volSamples.length > 0
    ? volSamples.reduce((sum, v) => sum + v, 0) / volSamples.length
    : 0;

  const NEAR_RANGE_PCT = 0.05;
  let nearHigh = 0;
  let nearLow = 0;
  let rangeEligible = 0;
  for (const c of companies) {
    const price = toNumber(c.current_price, NaN);
    const high = toNumber(c.high_52w, NaN);
    const low = toNumber(c.low_52w, NaN);
    if (!Number.isFinite(price) || !Number.isFinite(high) || !Number.isFinite(low) || high <= 0) continue;
    rangeEligible += 1;
    if (high - price <= high * NEAR_RANGE_PCT) nearHigh += 1;
    if (price - low <= high * NEAR_RANGE_PCT) nearLow += 1;
  }
  const highLowBreadthRaw = rangeEligible > 0 ? (nearHigh - nearLow) / rangeEligible : 0;

  return { cycleRaw, breadthRaw, momentumRaw, newsRaw, volatilityRaw, highLowBreadthRaw };
}

/** Holds one TrailingZScore tracker per driver, reused across ticks. */
export class SentimentTrackers {
  readonly cycle = new TrailingZScore();
  readonly breadth = new TrailingZScore();
  readonly momentum = new TrailingZScore();
  readonly news = new TrailingZScore();
  readonly volatility = new TrailingZScore();
  readonly highLowBreadth = new TrailingZScore();
}

/**
 * Seeds the Momentum and Volatility trackers from a single company's OHLCV
 * history so the gauge reflects real deviation immediately on page load,
 * instead of reading a flat neutral 50 for every driver until ~8 live ticks
 * have accumulated in-browser. Cycle/Breadth/News have no per-company
 * historical equivalent (they're market-wide/event-driven) and are left to
 * warm up from live ticks.
 */
export function bootstrapFromPriceHistory(trackers: SentimentTrackers, history: PriceHistoryItem[]): void {
  if (history.length < 2) return;

  const dayChangePcts: number[] = [];
  const intradayVols: number[] = [];
  for (let i = 1; i < history.length; i++) {
    const prevClose = history[i - 1].close;
    const bar = history[i];
    if (prevClose > 0) {
      dayChangePcts.push(((bar.close - prevClose) / prevClose) * 100);
    }
    if (bar.close > 0) {
      intradayVols.push(((bar.high - bar.low) / bar.close) * 100);
    }
  }

  trackers.momentum.seed(dayChangePcts);
  trackers.volatility.seed(intradayVols);
}

export function computeSentimentDrivers(
  trackers: SentimentTrackers,
  raw: SentimentRawInputs
): SentimentDrivers {
  // Capture warmth before push() so it reflects the trailing window the
  // z-score below was actually computed against, not the window after
  // this tick's sample has been added to it.
  const warmingUp = {
    cycle: !trackers.cycle.isWarm,
    breadth: !trackers.breadth.isWarm,
    momentum: !trackers.momentum.isWarm,
    news: !trackers.news.isWarm,
    volatility: !trackers.volatility.isWarm,
    highLowBreadth: !trackers.highLowBreadth.isWarm,
  };

  const cycle = zScoreToPercent(trackers.cycle.push(raw.cycleRaw));
  const breadth = zScoreToPercent(trackers.breadth.push(raw.breadthRaw));
  const momentum = zScoreToPercent(trackers.momentum.push(raw.momentumRaw));
  const news = zScoreToPercent(trackers.news.push(raw.newsRaw));
  // Volatility is a fear signal: higher-than-usual volatility should pull sentiment
  // down, so its z-score is inverted before squashing.
  const volatility = zScoreToPercent(-trackers.volatility.push(raw.volatilityRaw));
  const highLowBreadth = zScoreToPercent(trackers.highLowBreadth.push(raw.highLowBreadthRaw));

  const composite =
    cycle * WEIGHTS.cycle +
    breadth * WEIGHTS.breadth +
    momentum * WEIGHTS.momentum +
    news * WEIGHTS.news +
    volatility * WEIGHTS.volatility +
    highLowBreadth * WEIGHTS.highLowBreadth;

  return {
    cycle,
    breadth,
    momentum,
    news,
    volatility,
    highLowBreadth,
    composite: Math.max(0, Math.min(100, composite)),
    warmingUp,
  };
}
