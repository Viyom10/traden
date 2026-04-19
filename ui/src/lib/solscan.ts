import type { DriftEnvironment } from "@/stores/DriftStore";

/**
 * Build a Solscan transaction URL that respects the active Drift environment.
 *
 * @param signature - base58-encoded Solana transaction signature
 * @param environment - "devnet" or "mainnet-beta"; defaults to mainnet
 */
export function getSolscanTxUrl(
  signature: string,
  environment?: DriftEnvironment | string,
): string {
  const base = `https://solscan.io/tx/${signature}`;
  return environment === "devnet" ? `${base}?cluster=devnet` : base;
}

/** Solscan account/address URL — useful for builder authorities, recipients, etc. */
export function getSolscanAddressUrl(
  address: string,
  environment?: DriftEnvironment | string,
): string {
  const base = `https://solscan.io/account/${address}`;
  return environment === "devnet" ? `${base}?cluster=devnet` : base;
}

/** Truncate a long base58 signature/address for display: "abcd1234…wxyz9876". */
export function shortSig(value: string, head = 8, tail = 6): string {
  if (!value) return "";
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
