import { AuthorityDrift } from "@drift-labs/common";
import { BigNum, TxSigAndSlot } from "@drift-labs/sdk";
import {
  Transaction,
  Signer,
  ConfirmOptions,
  VersionedTransaction,
  SystemProgram,
  TransactionMessage,
} from "@solana/web3.js";
import { addTradingFeeToTransaction, getBuilderAuthorityPublicKey } from "./tradingFee";

interface PendingPerpOrderFee {
  orderSize: BigNum;
  assetType: "base" | "quote";
}

export interface TradingFeeInterceptorConfig {
  enableForPerpOrders?: boolean;
  enableForSwaps?: boolean;
  enableForOtherOperations?: boolean;
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
        
        // Calculate 0.05% fee
        // For base assets: orderSize is in base precision (1e9 for SOL)
        // For quote assets: orderSize is in quote precision (1e6 for USDC)
        // Fee = orderSize * 0.05 / 100 = orderSize * 5 / 10000
        const feeAmount = orderSizeRaw.muln(5).divn(10000);
        
        // For base assets, feeAmount is already in base precision (lamports for SOL)
        // For quote assets, we need to convert USDC to SOL
        // For now, using a simple conversion: 1 USDC ≈ 0.01 SOL (placeholder)
        const feeInLamports = pendingPerpOrderFee.assetType === 'base' 
          ? feeAmount  // Already in lamports
          : feeAmount.muln(10000); // Convert USDC (1e6) to rough SOL equivalent
        
        const feeInSol = feeInLamports.toNumber() / 1_000_000_000;
        
        console.log("Trading fee calculation:", {
          orderSize: pendingPerpOrderFee.orderSize.prettyPrint(),
          orderSizeRaw: orderSizeRaw.toString(),
          assetType: pendingPerpOrderFee.assetType,
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
