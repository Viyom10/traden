/**
 * Lightweight fallback PerpMarketConfig-shaped objects used when the live
 * Drift subscription has not (or cannot) populate the real market list.
 *
 * These contain just enough fields for the trade form, the market dropdown,
 * and the price tiles to render. Real on-chain trades are NOT executed
 * against these — they only feed the demo / simulation flow.
 */

import { BN } from "@drift-labs/sdk";

const e9 = (n: number) => new BN(Math.floor(n * 1e9));

interface SimulatedPerpMarket {
  marketIndex: number;
  symbol: string;
  baseAssetSymbol: string;
  /** Indicative current price in USD. Used as oracle/mark fallback. */
  basePriceUsd: number;
  /** Min order size in BASE_PRECISION (1e9). */
  minOrderSize: BN;
  /** Tick size (price precision steps). */
  tickSizeDecimals: number;
}

export const SIMULATED_PERP_MARKETS: SimulatedPerpMarket[] = [
  { marketIndex: 0, symbol: "SOL-PERP", baseAssetSymbol: "SOL", basePriceUsd: 87.35, minOrderSize: e9(0.01), tickSizeDecimals: 4 },
  { marketIndex: 1, symbol: "BTC-PERP", baseAssetSymbol: "BTC", basePriceUsd: 92500, minOrderSize: e9(0.0001), tickSizeDecimals: 1 },
  { marketIndex: 2, symbol: "ETH-PERP", baseAssetSymbol: "ETH", basePriceUsd: 3120, minOrderSize: e9(0.001), tickSizeDecimals: 2 },
  { marketIndex: 3, symbol: "APT-PERP", baseAssetSymbol: "APT", basePriceUsd: 9.4, minOrderSize: e9(0.5), tickSizeDecimals: 4 },
  { marketIndex: 7, symbol: "DOGE-PERP", baseAssetSymbol: "DOGE", basePriceUsd: 0.34, minOrderSize: e9(10), tickSizeDecimals: 6 },
  { marketIndex: 8, symbol: "BNB-PERP", baseAssetSymbol: "BNB", basePriceUsd: 612, minOrderSize: e9(0.01), tickSizeDecimals: 2 },
  { marketIndex: 9, symbol: "SUI-PERP", baseAssetSymbol: "SUI", basePriceUsd: 3.45, minOrderSize: e9(1), tickSizeDecimals: 4 },
  { marketIndex: 13, symbol: "XRP-PERP", baseAssetSymbol: "XRP", basePriceUsd: 0.61, minOrderSize: e9(5), tickSizeDecimals: 5 },
  { marketIndex: 22, symbol: "AVAX-PERP", baseAssetSymbol: "AVAX", basePriceUsd: 32.4, minOrderSize: e9(0.1), tickSizeDecimals: 3 },
  { marketIndex: 30, symbol: "DRIFT-PERP", baseAssetSymbol: "DRIFT", basePriceUsd: 0.93, minOrderSize: e9(1), tickSizeDecimals: 5 },
];

export const SIMULATED_PERP_MARKET_BY_INDEX: Record<number, SimulatedPerpMarket> =
  SIMULATED_PERP_MARKETS.reduce(
    (acc, m) => ({ ...acc, [m.marketIndex]: m }),
    {} as Record<number, SimulatedPerpMarket>,
  );

export function getSimulatedMarketSymbol(marketIndex: number): string {
  return SIMULATED_PERP_MARKET_BY_INDEX[marketIndex]?.symbol ?? `MKT-${marketIndex}`;
}

export function getSimulatedMarketPrice(marketIndex: number): number {
  return SIMULATED_PERP_MARKET_BY_INDEX[marketIndex]?.basePriceUsd ?? 0;
}
