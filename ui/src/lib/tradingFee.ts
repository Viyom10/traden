import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { BigNum } from "@drift-labs/sdk";

const TRADING_FEE_BPS = 5; // 0.05% = 5 basis points

/**
 * Creates a trading fee transfer instruction
 * @param orderSize - The size of the order in BigNum format
 * @param assetType - Whether the size is in 'base' or 'quote' asset
 * @param payer - The public key of the user paying the fee
 * @param recipient - The public key receiving the trading fee
 * @returns TransactionInstruction for the fee transfer
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
  // For quote assets, we need to convert USDC to SOL
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
 * Get the builder authority public key from environment variables
 * @returns PublicKey of the builder authority or null if not set
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
 * Adds trading fee instruction to a transaction
 * @param transaction - The transaction to add the fee to
 * @param orderSize - The size of the order
 * @param assetType - Whether the size is in 'base' or 'quote' asset
 * @param payer - The public key of the user paying the fee
 * @returns Modified transaction with fee instruction prepended
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
