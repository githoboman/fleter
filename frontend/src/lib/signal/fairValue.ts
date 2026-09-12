/**
 * BitDrum Edge — an explainable fair-value signal for Up/Down Event Contracts.
 *
 * Model: over short horizons BTC log-returns are ~driftless Brownian motion, so
 *   P(close >= open) = Phi( ln(S / K) / (sigma * sqrt(tau)) )
 * where S = live index price, K = the market's opening (reference) price,
 * tau = seconds to expiry, sigma = per-second realized vol from 1m candles.
 *
 * Edge = model P(UP) - market-implied P(UP) (YES mid). The signal only fires
 * when |edge| clears the spread plus a margin, so it never recommends paying
 * through a wide book. Pure functions — no I/O — so it's unit-testable.
 */

export type Candle = [number, number, number, number, number, number]; // [ms,o,h,l,c,vol]

export type EdgeInput = {
  livePrice: number;
  openingPrice: number;
  secondsLeft: number;
  windowSec: number;
  impliedUp: number | null;
  spread: number | null;
  candles: Candle[];
};

export type EdgeSignal = {
  direction: "UP" | "DOWN" | "NEUTRAL";
  modelUp: number;
  impliedUp: number | null;
  edge: number | null;
  confidence: number; // 0..100
  sigmaPerMin: number;
  zScore: number;
  rationale: string;
};

/** Standard normal CDF (Abramowitz–Stegun 7.1.26, |err| < 7.5e-8). */
export function phi(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p =
    d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

/** Per-minute stdev of log returns from close-to-close 1m candles. */
export function realizedSigmaPerMin(candles: Candle[]): number {
  const closes = candles.map((c) => c[4]).filter((c) => c > 0);
  if (closes.length < 5) return 0.0008; // ~0.08%/min fallback for BTC
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const v = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / Math.max(rets.length - 1, 1);
  return Math.max(Math.sqrt(v), 1e-5);
}

export function computeEdge(i: EdgeInput, minEdge = 0.03): EdgeSignal {
  const sigmaMin = realizedSigmaPerMin(i.candles);
  const tauMin = Math.max(i.secondsLeft, 1) / 60;
  const z = Math.log(i.livePrice / i.openingPrice) / (sigmaMin * Math.sqrt(tauMin));
  const modelUp = Math.min(Math.max(phi(z), 0.01), 0.99);

  const edge = i.impliedUp === null ? null : modelUp - i.impliedUp;
  const hurdle = minEdge + (i.spread ?? 0) / 2;

  let direction: EdgeSignal["direction"] = "NEUTRAL";
  if (edge !== null && Math.abs(edge) > hurdle) direction = edge > 0 ? "UP" : "DOWN";

  // Confidence: how far the edge clears the hurdle, damped very early in the
  // window (opening price barely tested) and in the last few seconds (fills risk).
  const elapsed = 1 - i.secondsLeft / Math.max(i.windowSec, 1);
  const timing = Math.min(1, elapsed / 0.2) * (i.secondsLeft > 5 ? 1 : 0.3);
  const clear = edge === null ? 0 : Math.max(0, Math.abs(edge) - hurdle) / 0.15;
  const confidence = Math.round(Math.min(1, clear) * timing * 100);

  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const move = ((i.livePrice / i.openingPrice - 1) * 100).toFixed(3);
  const rationale =
    edge === null
      ? `BTC is ${move}% from the open with ${Math.round(i.secondsLeft)}s left; model says ${pct(modelUp)} UP, but the book is empty so there is no price to beat.`
      : direction === "NEUTRAL"
        ? `Model ${pct(modelUp)} UP vs market ${pct(i.impliedUp!)} — inside the spread-adjusted hurdle, no edge.`
        : `Price is ${move}% from the open with ${Math.round(i.secondsLeft)}s left (z=${z.toFixed(2)}). Model ${pct(modelUp)} UP vs market ${pct(i.impliedUp!)}: ${direction} is underpriced by ${pct(Math.abs(edge))}.`;

  return { direction, modelUp, impliedUp: i.impliedUp, edge, confidence, sigmaPerMin: sigmaMin, zScore: z, rationale };
}
