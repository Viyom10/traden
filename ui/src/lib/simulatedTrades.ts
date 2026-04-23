/**
 * Simulated trade signatures.
 *
 * When the live Drift connection is unavailable (devnet RPC down, no funded
 * sub-account, etc.) the trade form opens a Phantom-style "approve" modal
 * instead of failing with "Drift Not Ready". After the user clicks Approve,
 * we mint a Solana-shaped 88-char base58 signature, persist the trade in
 * localStorage, and the /explorer page knows how to render it as if it had
 * been fetched from chain — three green pills + a CPI tree showing the
 * System.transfer (fee) and Drift PlacePerpOrder (trade) at depth 0.
 *
 * This is purely for the demo path. Real trades through the real
 * `DriftClientWrapper.ts` interceptor still produce real on-chain signatures.
 */

const STORAGE_KEY = "traden:simulatedTrades:v1";
const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export interface SimulatedTrade {
  signature: string;
  marketIndex: number;
  marketSymbol: string;
  side: "long" | "short";
  size: string;
  sizeType: "base" | "quote";
  feeLamports: string;
  feeSol: string;
  recipient: string;
  payer: string;
  oraclePriceUsd: number;
  timestamp: string;
  blockTime: number;
  slot: number;
  /** Real on-chain transactions never set this; demo-only marker. */
  simulated: true;
}

/**
 * Returns a 88-character base58 string that is the same shape as a real
 * Solana transaction signature (64 bytes encoded in base58 ≈ 87-88 chars).
 */
export function generateSimulatedSignature(): string {
  const len = 88;
  const out = new Array(len);
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const buf = new Uint32Array(len);
    window.crypto.getRandomValues(buf);
    for (let i = 0; i < len; i++) {
      out[i] = BASE58_ALPHABET[buf[i] % BASE58_ALPHABET.length];
    }
  } else {
    for (let i = 0; i < len; i++) {
      out[i] = BASE58_ALPHABET[Math.floor(Math.random() * BASE58_ALPHABET.length)];
    }
  }
  return out.join("");
}

export function saveSimulatedTrade(trade: SimulatedTrade): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getSimulatedTrades();
    existing.unshift(trade);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(existing.slice(0, 50)),
    );
  } catch (err) {
    console.warn("Failed to persist simulated trade", err);
  }
}

export function getSimulatedTrades(): SimulatedTrade[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SimulatedTrade[];
  } catch {
    return [];
  }
}

export function getSimulatedTrade(signature: string): SimulatedTrade | null {
  const all = getSimulatedTrades();
  return all.find((t) => t.signature === signature) ?? null;
}

/**
 * Compute the 5-bps fee in lamports for a given order, using the live oracle
 * price when the size is denominated in the quote asset (USDC).
 */
export function computeSimulatedFee(args: {
  size: number;
  sizeType: "base" | "quote";
  oraclePriceUsd: number;
}): { feeLamports: bigint; feeSol: number } {
  const { size, sizeType, oraclePriceUsd } = args;
  const LAMPORTS_PER_SOL = 1_000_000_000n;
  if (sizeType === "base") {
    const lamports = BigInt(Math.floor(size * 1e9 * 5)) / 10000n;
    return {
      feeLamports: lamports,
      feeSol: Number(lamports) / 1e9,
    };
  }
  const usdcFee = (size * 5) / 10000;
  const safePrice = oraclePriceUsd > 0 ? oraclePriceUsd : 1;
  const sol = usdcFee / safePrice;
  const lamports = BigInt(Math.floor(sol * Number(LAMPORTS_PER_SOL)));
  return { feeLamports: lamports, feeSol: sol };
}
