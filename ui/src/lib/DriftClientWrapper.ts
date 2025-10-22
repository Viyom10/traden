import { AuthorityDrift, MarketId } from "@drift-labs/common";
import { BigNum, TxSigAndSlot, PRICE_PRECISION_EXP, BN } from "@drift-labs/sdk";
import {
  Transaction,
  Signer,
  ConfirmOptions,
  VersionedTransaction,
  SystemProgram,
  TransactionMessage,
} from "@solana/web3.js";
import { addTradingFeeToTransaction, getBuilderAuthorityPublicKey } from "./tradingFee";
import { useUserStore } from "@/stores/UserStore";

interface PendingPerpOrderFee {
  orderSize: BigNum;
  assetType: "base" | "quote";
  marketIndex: number;
}

export interface TradingFeeInterceptorConfig {
  enableForPerpOrders?: boolean;
  enableForSwaps?: boolean;
  enableForOtherOperations?: boolean;
}

/**
 * Helper function to record fee to database
 */
async function recordFeeToDatabase(
  orderSize: BigNum,
  assetType: "base" | "quote",
  feeInSol: number,
  feeInLamports: BN,
  userId?: string,
  experienceId?: string,
) {
  if (!userId || !experienceId) {
    console.log("Skipping fee recording - userId or experienceId not available");
    return;
  }

  try {
    const response = await fetch("/api/fee", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        experienceId,
        feeAmount: feeInSol.toString(),
        feeInLamports: feeInLamports.toString(),
        orderSize: orderSize.prettyPrint(),
        assetType,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Failed to record fee:", errorData);
    } else {
      console.log("✅ Fee recorded to database successfully");
    }
  } catch (error) {
    console.error("Error recording fee to database:", error);
  }
}

/**
 * Installs a transaction interceptor on the DriftClient to add trading fees
 * to perp order transactions
 */
export function installTradingFeeInterceptor(
  drift: AuthorityDrift,
  config: TradingFeeInterceptorConfig = {
    enableForPerpOrders: true,
    enableForSwaps: false,
    enableForOtherOperations: false,
  }
) {
  const driftClient = drift.driftClient;
  
  if (!driftClient) {
    console.error("DriftClient not available for fee interceptor");
    return;
  }

  // Store reference to original sendTransaction method
  const originalSendTransaction = driftClient.sendTransaction.bind(driftClient);
  
  // Track pending perp orders
  let pendingPerpOrderFee: PendingPerpOrderFee | null = null;
  
  // Override the drift.openPerpOrder method to track when perp orders are being placed
  if (config.enableForPerpOrders) {
    const originalOpenPerpOrder = drift.openPerpOrder.bind(drift);
    
    drift.openPerpOrder = async function(params) {
      console.log("🎯 openPerpOrder called with params:", {
        orderType: params.orderConfig.orderType,
        size: params.size.prettyPrint(),
        assetType: params.assetType,
        marketIndex: params.marketIndex,
        direction: params.direction,
      });
      
      // Check if this is a Swift order
      const isSwiftOrder = 
        (params.orderConfig.orderType === 'market' && !params.orderConfig.disableSwift) ||
        (params.orderConfig.orderType === 'limit' && !params.orderConfig.disableSwift);
      
      const disableSwiftValue = (params.orderConfig.orderType === 'market' || params.orderConfig.orderType === 'limit') 
        ? params.orderConfig.disableSwift 
        : 'N/A';
      
      console.log(`🔍 Order type check:`, {
        orderType: params.orderConfig.orderType,
        disableSwift: disableSwiftValue,
        isSwiftOrder,
      });
      
      if (isSwiftOrder) {
        console.warn("⚠️ Trading fees NOT applied - Swift orders use different execution flow");
        console.warn("💡 To apply fees, disable Swift in the trade form");
        // Don't track fee for Swift orders
        return await originalOpenPerpOrder(params);
      }
      
      console.log("✅ Non-Swift order detected - trading fee will be applied");
      
      // Store the order details for fee calculation (only for non-Swift orders)
      pendingPerpOrderFee = {
        orderSize: params.size,
        assetType: params.assetType,
        marketIndex: params.marketIndex,
      };
      
      console.log("📝 Stored pending perp order fee:", pendingPerpOrderFee);
      
      try {
        // Call the original implementation
        const result = await originalOpenPerpOrder(params);
        return result;
      } finally {
        // Clear the pending fee after execution (success or failure)
        console.log("🧹 Clearing pending perp order fee");
        pendingPerpOrderFee = null;
      }
    };
  }
  
  // Override driftClient.sendTransaction to intercept and modify transactions
  driftClient.sendTransaction = async function(
    tx: Transaction | VersionedTransaction,
    additionalSigners?: Signer[],
    opts?: ConfirmOptions,
    preSigned?: boolean,
  ): Promise<TxSigAndSlot> {
    console.log("📡 sendTransaction called:", {
      hasPendingFee: !!pendingPerpOrderFee,
      isTransaction: tx instanceof Transaction,
      isVersionedTransaction: tx instanceof VersionedTransaction,
      hasWallet: !!driftClient.wallet?.publicKey,
    });
    
    // If there's a pending perp order, add the trading fee
    if (pendingPerpOrderFee && driftClient.wallet?.publicKey) {
      try {
        console.log("🔄 Intercepting perp order transaction to add trading fee");
        
        // Get fee details
        const recipient = getBuilderAuthorityPublicKey();
        if (!recipient) {
          throw new Error("Builder authority not configured. Cannot process trading fee.");
        }
        
        const orderSizeRaw = pendingPerpOrderFee.orderSize.val;
        
        // Calculate 0.05% fee on the order size
        // For base assets: orderSize is in base precision (1e9 for SOL)
        // For quote assets: orderSize is in quote precision (1e6 for USDC)
        // Fee = orderSize * 0.05 / 100 = orderSize * 5 / 10000
        const feeAmount = orderSizeRaw.muln(5).divn(10000);
        
        let feeInLamports: typeof orderSizeRaw;
        
        if (pendingPerpOrderFee.assetType === 'base') {
          // For base assets (SOL), feeAmount is already in base precision (lamports)
          feeInLamports = feeAmount;
        } else {
          // For quote assets (USDC), we need to convert the USDC fee to SOL using oracle price
          // Get the SOL oracle price (market index 1 for SOL spot market)
          const solMarketId = MarketId.createSpotMarket(1); // SOL is typically market index 1
          const solOraclePrice = drift.oraclePriceCache[solMarketId.key]?.price;
          
          if (!solOraclePrice || solOraclePrice.isZero()) {
            console.warn("⚠️ SOL oracle price not available, using fallback conversion");
            // Fallback: 1 USDC ≈ 0.01 SOL (if oracle price unavailable)
            feeInLamports = feeAmount.muln(10000);
          } else {
            // Convert USDC fee to SOL fee using oracle price
            // feeAmount is in USDC (1e6 precision)
            // solOraclePrice is in PRICE_PRECISION (1e6)
            // We want result in lamports (1e9)
            
            // Formula: (feeInUSDC * 1e9) / oraclePrice
            // This gives us SOL amount in lamports
            const LAMPORTS_PER_SOL = new BN(1_000_000_000);
            feeInLamports = feeAmount.mul(LAMPORTS_PER_SOL).div(solOraclePrice);
            
            console.log("Oracle price conversion:", {
              feeInUSDC: feeAmount.toString(),
              solOraclePrice: solOraclePrice.toString(),
              solOraclePriceUSD: BigNum.from(solOraclePrice, PRICE_PRECISION_EXP).toNum(),
              feeInLamports: feeInLamports.toString(),
            });
          }
        }
        
        const feeInSol = feeInLamports.toNumber() / 1_000_000_000;
        
        console.log("Trading fee calculation:", {
          orderSize: pendingPerpOrderFee.orderSize.prettyPrint(),
          orderSizeRaw: orderSizeRaw.toString(),
          assetType: pendingPerpOrderFee.assetType,
          marketIndex: pendingPerpOrderFee.marketIndex,
          feeAmount: feeAmount.toString(),
          feeInLamports: feeInLamports.toString(),
          feeInSOL: `${feeInSol} SOL`,
          feePercentage: "0.05%",
        });
        
        // Handle VersionedTransaction - add fee instruction to it
        if (tx instanceof VersionedTransaction) {
          console.log("📦 VersionedTransaction detected - bundling fee instruction");
          
          // Create fee instruction
          const feeInstruction = SystemProgram.transfer({
            fromPubkey: driftClient.wallet.publicKey,
            toPubkey: recipient,
            lamports: feeInLamports.toNumber(),
          });
          
          console.log("✅ Trading fee instruction created");
          console.log(`📊 Fee Details:`, {
            from: driftClient.wallet.publicKey.toBase58(),
            to: recipient.toBase58(),
            orderSize: pendingPerpOrderFee.orderSize.prettyPrint(),
            assetType: pendingPerpOrderFee.assetType,
            feePercentage: "0.05%",
            feeAmount: `${feeInSol} SOL (${feeInLamports.toString()} lamports)`,
          });
          
          // Get the original message
          const originalMessage = tx.message;
          
          // Resolve address lookup table accounts if they exist
          let addressLookupTableAccounts = undefined;
          if (originalMessage.addressTableLookups && originalMessage.addressTableLookups.length > 0) {
            console.log(`🔍 Resolving ${originalMessage.addressTableLookups.length} address lookup table(s)...`);
            
            try {
              const lookupTableAddresses = originalMessage.addressTableLookups.map(
                lookup => lookup.accountKey
              );
              
              const lookupTableAccounts = await Promise.all(
                lookupTableAddresses.map(address => 
                  driftClient.connection.getAddressLookupTable(address)
                )
              );
              
              addressLookupTableAccounts = lookupTableAccounts
                .map(account => account.value)
                .filter((account): account is NonNullable<typeof account> => account !== null);
              
              console.log(`✅ Resolved ${addressLookupTableAccounts.length} lookup table account(s)`);
            } catch (error) {
              console.error("Failed to resolve address lookup tables:", error);
              throw new Error("Failed to resolve address lookup tables: " + String(error));
            }
          }
          
          // Decompile the original message to get instructions
          const decompiled = addressLookupTableAccounts 
            ? TransactionMessage.decompile(originalMessage, { addressLookupTableAccounts })
            : TransactionMessage.decompile(originalMessage);
          
          // Prepend the fee instruction to the existing instructions
          const allInstructions = [feeInstruction, ...decompiled.instructions];
          
          // Create a new TransactionMessage with all instructions
          const modifiedMessage = new TransactionMessage({
            payerKey: decompiled.payerKey,
            instructions: allInstructions,
            recentBlockhash: decompiled.recentBlockhash,
          }).compileToV0Message(addressLookupTableAccounts || []);
          
          // Create a new VersionedTransaction with the modified message
          const modifiedTx = new VersionedTransaction(modifiedMessage);
          
          console.log("📦 Created bundled transaction with fee + order");
          console.log(`📤 Sending bundled transaction to network...`);
          
          // Send the bundled transaction
          const result = await originalSendTransaction(
            modifiedTx,
            additionalSigners,
            opts,
            preSigned,
          );
          
          console.log("✅ Bundled transaction sent successfully!");
          console.log(`📝 Transaction Signature: ${result.txSig}`);
          console.log(`💰 Fee Amount Charged: ${feeInSol} SOL (${feeInLamports.toString()} lamports)`);
          console.log(`🎯 Fee sent to: ${recipient.toBase58()}`);
          
          // Record fee to database (non-blocking)
          const { userId, experienceId } = useUserStore.getState();
          recordFeeToDatabase(
            pendingPerpOrderFee.orderSize,
            pendingPerpOrderFee.assetType,
            feeInSol,
            feeInLamports,
            userId || undefined,
            experienceId || undefined,
          ).catch(err => console.error("Fee recording error:", err));
          
          return result;
        }
        
        // Handle regular Transaction - add fee to same transaction
        if (tx instanceof Transaction) {
          console.log("📦 Regular Transaction - adding fee instruction");
          
          // Add trading fee instruction to the transaction
          const modifiedTransaction = addTradingFeeToTransaction(
            tx,
            pendingPerpOrderFee.orderSize,
            pendingPerpOrderFee.assetType,
            driftClient.wallet.publicKey,
          );
          
          console.log("📤 Sending transaction with trading fee to network...");
          
          // Send the modified transaction using the original method
          const result = await originalSendTransaction(
            modifiedTransaction,
            additionalSigners,
            opts,
            preSigned,
          );
          
          console.log("✅ Transaction with trading fee sent successfully!");
          console.log(`📝 Transaction Signature: ${result.txSig}`);
          
          // Calculate fee for recording (same logic as in createTradingFeeInstruction)
          const orderSizeRaw = pendingPerpOrderFee.orderSize.val;
          const feeAmount = orderSizeRaw.muln(5).divn(10000); // 5 bps = 0.05%
          const feeInLamports = pendingPerpOrderFee.assetType === 'base' 
            ? feeAmount
            : feeAmount.muln(10000);
          const feeInSol = feeInLamports.toNumber() / 1_000_000_000;
          
          // Record fee to database (non-blocking)
          const { userId, experienceId } = useUserStore.getState();
          recordFeeToDatabase(
            pendingPerpOrderFee.orderSize,
            pendingPerpOrderFee.assetType,
            feeInSol,
            feeInLamports,
            userId || undefined,
            experienceId || undefined,
          ).catch(err => console.error("Fee recording error:", err));
          console.log(`💰 Fee Amount Charged: ${feeInSol} SOL (${feeInLamports.toString()} lamports)`);
          console.log(`🎯 Fee sent to: ${recipient.toBase58()}`);
          
          return result;
        }
      } catch (error) {
        console.error("❌ Error adding trading fee to transaction:", error);
        // If fee addition fails, don't send the transaction
        throw new Error("Failed to add trading fee. Transaction cancelled: " + String(error));
      }
    }
    
    // If no pending perp order fee, send transaction normally
    return await originalSendTransaction(tx, additionalSigners, opts, preSigned);
  };
  
  console.log("Trading fee interceptor installed successfully", config);
}
