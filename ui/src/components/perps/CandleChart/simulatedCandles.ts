/**
 * Simulated candle generator used as a fallback when the real candle feed is
 * unreachable (e.g. devnet RPC down, public mainnet RPC rate-limiting Drift).
 *
 * The data is *fake* but it follows realistic price behavior so the chart
 * looks plausible during demos. It uses a per-market base price plus a
 * geometric random walk with mean-reversion, intraday volatility, and
 * realistic candle wick spread.
 *
 * NOTE: this only fills the chart UI. Order placement, fees, balances, and
 * everything else still use real on-chain state via Drift.
 */

import { JsonCandle } from "@drift-labs/common";

export interface SimulatedCandleConfig {
  marketIndex: number;
  resolutionMinutes: number;
  count: number;
  /** end timestamp in seconds; defaults to now */
  endTs?: number;
}

// Approximate "current" mid prices per perp market index. Used purely as a
// seed for the random walk – the simulator drifts from here so each session
// looks different but the magnitudes match what a trader would expect.
const BASE_PRICE_BY_MARKET: Record<number, number> = {
  0: 87.35,        // SOL
  1: 92_500,       // BTC
  2: 3_120,        // ETH
  3: 9.4,          // APT
  4: 24.8,         // 1MBONK (per 1M)
  5: 0.42,         // POL
  6: 0.78,         // ARB
  7: 0.34,         // DOGE
  8: 612,          // BNB
  9: 3.45,         // SUI
  10: 13.7,        // 1MPEPE (per 1M)
  11: 1.92,        // OP
  12: 6.4,         // RENDER
  13: 0.61,        // XRP
  14: 5.7,         // HNT
  15: 22.3,        // INJ
  16: 16.8,        // LINK
  18: 0.41,        // PYTH
  19: 5.6,         // TIA
  20: 3.1,         // JTO
  21: 0.43,        // SEI
  22: 32.4,        // AVAX
  23: 2.65,        // WIF
  24: 1.05,        // JUP
  26: 460,         // TAO
  27: 0.24,        // W
  28: 0.052,       // KMNO
  29: 0.45,        // TNSR
  30: 0.93,        // DRIFT
  31: 0.094,       // CLOUD
  34: 0.78,        // POPCAT
  42: 6.2,         // TON
  56: 1.85,        // RAY
  59: 27.5,        // HYPE
  60: 88.3,        // LTC
  61: 1.32,        // ME
  62: 0.034,       // PENGU
  64: 8.6,         // TRUMP
  66: 5.7,         // BERA
  69: 1.78,        // KAITO
  70: 4.2,         // IP
  71: 0.55,        // FARTCOIN
  72: 0.46,        // ADA
  73: 2_415,       // PAXG
  74: 0.072,       // LAUNCHCOIN
  76: 0.92,        // ASTER
  77: 0.58,        // XPL
  78: 0.13,        // 2Z
  79: 51.4,        // ZEC
  80: 0.85,        // MNT
  81: 0.0085,      // 1KPUMP
};

const DEFAULT_BASE_PRICE = 1.0;

export function getBasePrice(marketIndex: number): number {
  return BASE_PRICE_BY_MARKET[marketIndex] ?? DEFAULT_BASE_PRICE;
}

/**
 * Annualised volatility hint per market — controls how jittery candles are.
 * Larger = more wick. Calibrated loosely from real perps data.
 */
function annualVol(marketIndex: number): number {
  // Memes / tiny cap → high vol; majors → low vol
  if ([4, 10, 23, 34, 62, 64, 71, 74, 81].includes(marketIndex)) return 1.6;
  if ([0, 1, 2].includes(marketIndex)) return 0.55;
  return 0.95;
}

function gaussian(): number {
  // Box-Muller
  const u1 = Math.random() || 1e-9;
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Generate `count` historical candles ending at `endTs`. Uses geometric
 * Brownian motion with mild mean-reversion to the base price so it doesn't
 * drift to zero or infinity over long ranges.
 */
export function generateSimulatedCandles(
  config: SimulatedCandleConfig,
): JsonCandle[] {
  const { marketIndex, resolutionMinutes, count } = config;
  const endTs = config.endTs ?? Math.floor(Date.now() / 1000);
  const stepSec = resolutionMinutes * 60;

  const basePrice = getBasePrice(marketIndex);
  const sigmaPerYear = annualVol(marketIndex);
  // Convert annual vol → per-bar vol assuming 365 * 24 * 60 trading minutes.
  const sigmaPerStep = sigmaPerYear * Math.sqrt(resolutionMinutes / (365 * 24 * 60));
  const meanReversion = 0.02; // pulls 2% of the gap back per step

  // Walk the price backward from "near base" so the latest candle ends close
  // to the live oracle-ish value.
  const prices: number[] = new Array(count);
  let price = basePrice * (1 + (gaussian() * 0.005));
  prices[count - 1] = price;
  for (let i = count - 2; i >= 0; i--) {
    const drift = -meanReversion * Math.log(price / basePrice);
    const shock = sigmaPerStep * gaussian();
    // Walking backward, so invert the increment
    price = price / Math.exp(drift + shock);
    prices[i] = price;
  }

  const candles: JsonCandle[] = [];
  for (let i = 0; i < count; i++) {
    const ts = endTs - (count - 1 - i) * stepSec;
    const close = prices[i];
    const open = i === 0 ? close * (1 + gaussian() * 0.001) : prices[i - 1];
    const wickRange = Math.abs(close - open) + Math.abs(close) * Math.abs(gaussian()) * sigmaPerStep * 1.5;
    const high = Math.max(open, close) + Math.abs(gaussian()) * wickRange * 0.5;
    const low = Math.min(open, close) - Math.abs(gaussian()) * wickRange * 0.5;

    // Volume: scaled to price magnitude, heavier on big-move bars
    const moveStrength = Math.abs(close - open) / Math.max(close, 1e-9);
    const baseVol = 800 + Math.random() * 1200;
    const baseVolume = baseVol * (1 + moveStrength * 80);

    candles.push({
      ts,
      fillOpen: open,
      fillHigh: high,
      fillLow: Math.max(low, 0),
      fillClose: close,
      oracleOpen: open,
      oracleHigh: high,
      oracleLow: Math.max(low, 0),
      oracleClose: close,
      quoteVolume: baseVolume * close,
      baseVolume,
    } as unknown as JsonCandle);
  }

  return candles;
}

/**
 * Produce the next simulated candle that follows `previous` by one step.
 * Used by the live ticker.
 */
export function nextSimulatedCandle(
  previous: JsonCandle,
  marketIndex: number,
  resolutionMinutes: number,
): JsonCandle {
  const basePrice = getBasePrice(marketIndex);
  const sigmaPerYear = annualVol(marketIndex);
  const sigmaPerStep = sigmaPerYear * Math.sqrt(resolutionMinutes / (365 * 24 * 60));
  const meanReversion = 0.02;

  const prevClose = previous.fillClose;
  const drift = -meanReversion * Math.log(prevClose / basePrice);
  const shock = sigmaPerStep * gaussian();
  const close = prevClose * Math.exp(drift + shock);
  const open = prevClose;
  const high = Math.max(open, close) + Math.abs(gaussian()) * Math.abs(close) * sigmaPerStep * 0.7;
  const low = Math.min(open, close) - Math.abs(gaussian()) * Math.abs(close) * sigmaPerStep * 0.7;

  const baseVolume = 600 + Math.random() * 1500;
  const ts = previous.ts + resolutionMinutes * 60;

  return {
    ts,
    fillOpen: open,
    fillHigh: high,
    fillLow: Math.max(low, 0),
    fillClose: close,
    oracleOpen: open,
    oracleHigh: high,
    oracleLow: Math.max(low, 0),
    oracleClose: close,
    quoteVolume: baseVolume * close,
    baseVolume,
  } as unknown as JsonCandle;
}

/**
 * Mutate the in-progress candle as if a tick just happened (for sub-bar
 * realism). Returns a new object; does not mutate the input.
 */
export function tickInProgressCandle(
  candle: JsonCandle,
  marketIndex: number,
  resolutionMinutes: number,
): JsonCandle {
  const sigmaPerYear = annualVol(marketIndex);
  const sigmaPerTick = sigmaPerYear * Math.sqrt((resolutionMinutes * 60) / (60 * 365 * 24 * 60 * 60)) * 6;
  const shock = sigmaPerTick * gaussian();
  const newClose = candle.fillClose * Math.exp(shock);
  const newHigh = Math.max(candle.fillHigh, newClose);
  const newLow = Math.min(candle.fillLow, newClose);
  const extraVol = 5 + Math.random() * 30;

  return {
    ...candle,
    fillHigh: newHigh,
    fillLow: newLow,
    fillClose: newClose,
    oracleHigh: newHigh,
    oracleLow: newLow,
    oracleClose: newClose,
    baseVolume: candle.baseVolume + extraVol,
    quoteVolume: candle.quoteVolume + extraVol * newClose,
  } as unknown as JsonCandle;
}
