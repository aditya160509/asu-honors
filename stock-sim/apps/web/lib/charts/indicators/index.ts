export { computeSMA } from "./sma";
export { computeEMA } from "./ema";
export { computeRSI } from "./rsi";
export { computeMACD } from "./macd";
export { computeBollinger } from "./bollinger";
export { computeStochastic } from "./stochastic";
export { computeADX } from "./adx";
export { computeATR } from "./atr";
export { computeOBV } from "./obv";
export { computeVWAP } from "./vwap";
export { computeIchimoku } from "./ichimoku";
export { computeSuperTrend } from "./superTrend";
export { computeCCI } from "./cci";
export { computeWilliamsR } from "./williamsR";
export { computeMFI } from "./mfi";
export { computeROC } from "./roc";
export { computeCMF } from "./cmf";

import type { PriceHistoryItem } from "@/lib/api/types";
import { computeSMA } from "./sma";
import { computeEMA } from "./ema";
import { computeRSI } from "./rsi";
import { computeMACD } from "./macd";
import { computeBollinger } from "./bollinger";
import { computeStochastic } from "./stochastic";
import { computeADX } from "./adx";
import { computeATR } from "./atr";
import { computeOBV } from "./obv";
import { computeVWAP } from "./vwap";
import { computeIchimoku } from "./ichimoku";
import { computeSuperTrend } from "./superTrend";
import { computeCCI } from "./cci";
import { computeWilliamsR } from "./williamsR";
import { computeMFI } from "./mfi";
import { computeROC } from "./roc";
import { computeCMF } from "./cmf";

export type IndicatorType =
  | "rsi"
  | "macd"
  | "bollinger"
  | "stochastic"
  | "adx"
  | "atr"
  | "obv"
  | "vwap"
  | "ichimoku"
  | "superTrend"
  | "cci"
  | "williamsR"
  | "mfi"
  | "roc"
  | "cmf"
  | "sma20"
  | "sma50"
  | "ema12";

export type IndicatorKind = "overlay" | "subchart";

export interface IndicatorConfig {
  label: string;
  type: IndicatorKind;
  category: string;
  defaultParams: Record<string, number>;
  colors: string[];
}

export const INDICATOR_REGISTRY: Record<IndicatorType, IndicatorConfig> = {
  sma20: { label: "SMA 20", type: "overlay", category: "Trend", defaultParams: { period: 20 }, colors: ["#f59e0b"] },
  sma50: { label: "SMA 50", type: "overlay", category: "Trend", defaultParams: { period: 50 }, colors: ["#3b82f6"] },
  ema12: { label: "EMA 12", type: "overlay", category: "Trend", defaultParams: { period: 12 }, colors: ["#14b8a6"] },
  bollinger: { label: "Bollinger", type: "overlay", category: "Trend", defaultParams: { period: 20, stdDev: 2 }, colors: ["#a78bfa", "#a78bfa", "#a78bfa"] },
  ichimoku: { label: "Ichimoku", type: "overlay", category: "Trend", defaultParams: {}, colors: ["#22c55e", "#ef4444", "#22c55e44", "#ef444444", "#3b82f6"] },
  superTrend: { label: "SuperTrend", type: "overlay", category: "Trend", defaultParams: { period: 10, multiplier: 3 }, colors: ["#22c55e", "#ef4444"] },
  rsi: { label: "RSI", type: "subchart", category: "Momentum", defaultParams: { period: 14 }, colors: ["#a78bfa"] },
  macd: { label: "MACD", type: "subchart", category: "Momentum", defaultParams: { fast: 12, slow: 26, signal: 9 }, colors: ["#3b82f6", "#ef4444", "#6b7280"] },
  stochastic: { label: "Stochastic", type: "subchart", category: "Momentum", defaultParams: { kPeriod: 14, dPeriod: 3 }, colors: ["#f59e0b", "#3b82f6"] },
  cci: { label: "CCI", type: "subchart", category: "Momentum", defaultParams: { period: 20 }, colors: ["#14b8a6"] },
  williamsR: { label: "Williams %R", type: "subchart", category: "Momentum", defaultParams: { period: 14 }, colors: ["#f472b6"] },
  mfi: { label: "MFI", type: "subchart", category: "Momentum", defaultParams: { period: 14 }, colors: ["#c084fc"] },
  roc: { label: "ROC", type: "subchart", category: "Momentum", defaultParams: { period: 12 }, colors: ["#22d3ee"] },
  obv: { label: "OBV", type: "subchart", category: "Volume", defaultParams: {}, colors: ["#3b82f6"] },
  vwap: { label: "VWAP", type: "overlay", category: "Volume", defaultParams: {}, colors: ["#f59e0b"] },
  cmf: { label: "CMF", type: "subchart", category: "Volume", defaultParams: { period: 20 }, colors: ["#6b7280"] },
  atr: { label: "ATR", type: "subchart", category: "Volatility", defaultParams: { period: 14 }, colors: ["#f59e0b"] },
  adx: { label: "ADX", type: "subchart", category: "Strength", defaultParams: { period: 14 }, colors: ["#a78bfa", "#22c55e", "#ef4444"] },
};

export function computeIndicator(
  type: IndicatorType,
  data: PriceHistoryItem[],
  params?: Record<string, number>
): any {
  const closes = data.map((d) => d.close);
  const highs = data.map((d) => d.high);
  const lows = data.map((d) => d.low);
  const volumes = data.map((d) => d.volume);
  const p = { ...INDICATOR_REGISTRY[type].defaultParams, ...params };

  switch (type) {
    case "sma20":
      return computeSMA(closes, p.period ?? 20);
    case "sma50":
      return computeSMA(closes, p.period ?? 50);
    case "ema12":
      return computeEMA(closes, p.period ?? 12);
    case "rsi":
      return computeRSI(closes, p.period);
    case "macd":
      return computeMACD(closes, p.fast, p.slow, p.signal);
    case "bollinger":
      return computeBollinger(closes, p.period, p.stdDev);
    case "stochastic":
      return computeStochastic(highs, lows, closes, p.kPeriod, p.dPeriod);
    case "adx":
      return computeADX(highs, lows, closes, p.period);
    case "atr":
      return computeATR(highs, lows, closes, p.period);
    case "obv":
      return computeOBV(closes, volumes);
    case "vwap":
      return computeVWAP(highs, lows, closes, volumes);
    case "ichimoku":
      return computeIchimoku(highs, lows, closes);
    case "superTrend":
      return computeSuperTrend(highs, lows, closes, p.period, p.multiplier);
    case "cci":
      return computeCCI(highs, lows, closes, p.period);
    case "williamsR":
      return computeWilliamsR(highs, lows, closes, p.period);
    case "mfi":
      return computeMFI(highs, lows, closes, volumes, p.period);
    case "roc":
      return computeROC(closes, p.period);
    case "cmf":
      return computeCMF(highs, lows, closes, volumes, p.period);
    default:
      return null;
  }
}
