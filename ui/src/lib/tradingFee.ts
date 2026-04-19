/**
 * @module lib/tradingFee
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  TRADING FEE INSTRUCTION BUILDER
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This module produces the `SystemProgram.transfer` instruction that is
 * prepended to every perpetual trade by `DriftClientWrapper`. The instruction
 * is what makes the fee "atomic with the trade" — once the wallet signs the
 * combined transaction, Solana's runtime guarantees both succeed or both
 * revert.
 *
 * ## Why SystemProgram.transfer?
 *  • Native Solana program → cannot be tampered with at the byte level.
 *  • Smallest possible compute footprint (no custom program invocation).
 *  • Universally indexable by explorers (Solscan, SolanaFM, …) without a
 *    custom IDL.
 *
 * ## Why prepend (not append)?
 *  • Logical first-payment semantics: fee comes before service.
 *  • If a future Drift instruction inadvertently consumes the entire account
 *    balance, the fee instruction has already been included in the same
 *    atomic unit — so either the fee was paid AND the trade ran, or both
 *    reverted. (Order of intra-transaction instructions does not change the
 *    all-or-nothing semantic, but it makes inspection by humans clearer.)
 *
 * ## Cryptographic note
 * The `SystemProgram.transfer` instruction's bytes (program id, account
 * indices, lamport amount) become part of the transaction message. The
 * single Ed25519 signature the wallet produces covers SHA-256 of that full
 * message — meaning the lamport amount and recipient are both signed-over.
 * A relayer or MITM cannot alter either without invalidating the signature.
 */

import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { BigNum } from "@drift-labs/sdk";

/** Trading fee in basis points (1 bp = 0.01%). 5 bps = 0.05%. */
const TRADING_FEE_BPS = 5;

/**
 * Build a fee `SystemProgram.transfer` instruction sized to the order.
 *
 * Fee math:
 *   fee_raw = orderSize.val * TRADING_FEE_BPS / 10_000
 *
 * Unit handling:
 *   • base asset (e.g. SOL):  raw is already in lamports (1e9 precision).
 *   • quote asset (e.g. USDC): raw is in 1e6 precision; I currently apply a
 *     placeholder ×10_000 conversion to lamports. The production path uses
 *     a live oracle SOL price (see `DriftClientWrapper`) and overrides this
 *     calculation before submission.
 *
 * @param orderSize  trade size as a `BigNum` (precision depends on assetType)
 * @param assetType  `"base"` or `"quote"`
 * @param payer      wallet paying the fee
 * @param recipient  builder authority that receives the fee
 * @returns          a Solana `TransactionInstruction` ready to prepend
 */
export function createTradingFeeInstruction(
  orderSize: BigNum,
  assetType: "base" | "quote",
  payer: PublicKey,
  recipient: PublicKey,
): TransactionInstruction {
  // Calculate 0.05% of the order size
  // For base asset: orderSize is in base precision (1e9 for SOL)
  // For quote asset: orderSize is in quote precision (1e6 for USDC)
  
  const orderSizeRaw = orderSize.val;
  
  // Calculate fee: 0.05% = 5/10000
  const feeAmount = orderSizeRaw.muln(TRADING_FEE_BPS).divn(10000);
  
  // For base assets, feeAmount is already in base precision (lamports for SOL)
  // For quote assets, convert USDC to SOL
  // Using a simple conversion: 1 USDC ≈ 0.01 SOL (placeholder)
  const feeInLamports = assetType === 'base' 
    ? feeAmount  // Already in lamports
    : feeAmount.muln(10000); // Convert USDC (1e6) to rough SOL equivalent
  
  const feeInSol = feeInLamports.toNumber() / 1_000_000_000;
  
  console.log("Trading fee calculation:", {
    orderSize: orderSize.prettyPrint(),
    assetType,
    feeAmount: feeAmount.toString(),
    feeInLamports: feeInLamports.toString(),
    feeInSOL: `${feeInSol} SOL`,
  });
  
  // Create a system program transfer instruction for the fee
  return SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: recipient,
    lamports: feeInLamports.toNumber(),
  });
}

/**
 * Resolve the builder-authority public key from the build-time env var
 * `NEXT_PUBLIC_BUILDER_AUTHORITY`.
 *
 * Returning `null` (rather than throwing) lets the UI render a friendly
 * "fees not configured" warning instead of crashing the bundle.
 *
 * @returns the recipient `PublicKey`, or `null` if missing/invalid
 */
export function getBuilderAuthorityPublicKey(): PublicKey | null {
  const builderAuthority = process.env.NEXT_PUBLIC_BUILDER_AUTHORITY;
  
  if (!builderAuthority) {
    console.warn("NEXT_PUBLIC_BUILDER_AUTHORITY not set in environment variables");
    return null;
  }
  
  try {
    return new PublicKey(builderAuthority);
  } catch (error) {
    console.error("Invalid NEXT_PUBLIC_BUILDER_AUTHORITY:", error);
    return null;
  }
}

/**
 * Mutate a legacy `Transaction` in place by prepending the fee instruction.
 *
 * Used by the legacy-transaction branch of the interceptor. The V0 branch
 * uses {@link createTradingFeeInstruction} directly because it has to
 * decompile/recompile the message via `TransactionMessage`.
 *
 * Throws if `NEXT_PUBLIC_BUILDER_AUTHORITY` is not configured — I'd rather
 * fail loudly than silently submit a fee-less trade.
 *
 * @returns the same `transaction` reference, now with fee instruction at index 0
 */
export function addTradingFeeToTransaction(
  transaction: Transaction,
  orderSize: BigNum,
  assetType: "base" | "quote",
  payer: PublicKey,
): Transaction {
  const recipient = getBuilderAuthorityPublicKey();
  
  if (!recipient) {
    throw new Error("Builder authority not configured. Cannot process trading fee.");
  }
  
  const feeInstruction = createTradingFeeInstruction(
    orderSize,
    assetType,
    payer,
    recipient,
  );
  
  // Prepend the fee instruction to the beginning of the transaction
  // This ensures the fee is paid first, and if it fails, the whole transaction fails
  transaction.instructions.unshift(feeInstruction);
  
  console.log(`✅ Trading fee instruction added to transaction`);
  console.log(`📊 Fee Details:`, {
    from: payer.toBase58(),
    to: recipient.toBase58(),
    orderSize: orderSize.prettyPrint(),
    assetType,
    feePercentage: `${TRADING_FEE_BPS / 100}%`,
    totalInstructions: transaction.instructions.length,
  });
  
  return transaction;
}

