"use client";

import { useState } from "react";
import {
  BigNum,
  PositionDirection,
  PostOnlyParams,
  PRICE_PRECISION_EXP,
  QUOTE_PRECISION_EXP,
} from "@drift-labs/sdk";
import { useDriftStore } from "@/stores/DriftStore";
import { useUserAccountDataStore } from "@/stores/UserAccountDataStore";
import { PerpOrderParams, GeoBlockError } from "@drift-labs/common";
import { toast } from "sonner";
import { TransactionSignature } from "@solana/web3.js";
import { BUILDER_AUTHORITY } from "@/constants/builderCode";
import { TradeSignalRecord, isSignalExpired } from "@/lib/signalApi";
import { useUserStore } from "@/stores/UserStore";

export const useSignalExecution = () => {
  const drift = useDriftStore((s) => s.drift);
  const isSwiftClientHealthy = useDriftStore((s) => s.isSwiftClientHealthy);
  const activeSubAccountId = useUserAccountDataStore((s) => s.activeSubAccountId);
  const revenueShareEscrow = useUserAccountDataStore((s) => s.revenueShareEscrow);
  const whopUser = useUserStore((s) => s.whopUser);
  const experienceId = useUserStore((s) => s.experienceId);

  const [isExecuting, setIsExecuting] = useState(false);

  const recordTrade = async (signal: TradeSignalRecord, tradeSizeInQuote: number, txSignature?: string) => {
    if (!whopUser || !experienceId) {
      console.warn("Missing user info for trade recording");
      return;
    }

    try {
      const tradeData = {
        userId: (whopUser as { id: string }).id,
        experienceId,
        marketIndex: signal.marketIndex,
        marketSymbol: signal.marketSymbol,
        orderType: signal.orderType,
        direction: signal.direction,
        sizeType: "quote", // Always use quote (USDC) since we calculate from collateral
        size: tradeSizeInQuote.toString(),
        limitPrice: signal.limitPrice,
        triggerPrice: signal.triggerPrice,
        oraclePriceOffset: signal.oraclePriceOffset,
        reduceOnly: signal.reduceOnly,
        postOnly: signal.postOnly,
        useSwift: false,
        subAccountId: activeSubAccountId,
        txSignature,
      };

      const response = await fetch("/api/trade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tradeData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to record trade:", errorData);
      }
    } catch (error) {
      console.error("Error recording trade:", error);
    }
  };

  const executeSignal = async (signal: TradeSignalRecord): Promise<boolean> => {
    if (!drift || activeSubAccountId === undefined) {
      toast.error("Drift Not Ready", {
        description: "Please ensure Drift is properly initialized and try again.",
        duration: 4000,
      });
      return false;
    }

    // Check if signal is expired
    if (isSignalExpired(signal)) {
      toast.error("Signal Expired", {
        description: "This trade signal has expired and can no longer be executed.",
        duration: 4000,
      });
      return false;
    }

    setIsExecuting(true);

    try {
      // Get the current user account to access their collateral
      const currentUserAccount = drift.driftClient.getUser(activeSubAccountId);
      if (!currentUserAccount) {
        throw new Error("User account not found");
      }

      // Calculate the trade size based on customer's collateral and leverage multiplier
      // Use netUsdValue as the collateral amount
      const collateralValue = currentUserAccount.getNetUsdValue();
      const tradeSizeInQuote = collateralValue.toNum() * signal.leverageMultiplier;
      
      // Convert to BigNum in quote precision (USDC)
      const sizeBigNum = BigNum.fromPrint(tradeSizeInQuote.toString(), QUOTE_PRECISION_EXP);
      const direction = signal.direction === "LONG" ? PositionDirection.LONG : PositionDirection.SHORT;

      // Get current oracle price for TP/SL calculation
      const marketAccount = drift.driftClient.getPerpMarketAccount(signal.marketIndex);
      if (!marketAccount) {
        throw new Error("Market account not found");
      }
      const currentOraclePrice = drift.driftClient.getOracleDataForPerpMarket(signal.marketIndex).price;
      const entryPrice = currentOraclePrice.toNum();

      // Calculate TP/SL prices from percentages if provided
      let takeProfitPrice: BigNum | undefined;
      let stopLossPrice: BigNum | undefined;

      if (signal.takeProfitPercentage) {
        // For LONG: TP = entry * (1 + percentage/100)
        // For SHORT: TP = entry * (1 - percentage/100)
        const tpMultiplier = direction === PositionDirection.LONG 
          ? 1 + (signal.takeProfitPercentage / 100)
          : 1 - (signal.takeProfitPercentage / 100);
        const tpPrice = entryPrice * tpMultiplier;
        takeProfitPrice = BigNum.fromPrint(tpPrice.toString(), PRICE_PRECISION_EXP);
      }

      if (signal.stopLossPercentage) {
        // For LONG: SL = entry * (1 - percentage/100)
        // For SHORT: SL = entry * (1 + percentage/100)
        const slMultiplier = direction === PositionDirection.LONG
          ? 1 - (signal.stopLossPercentage / 100)
          : 1 + (signal.stopLossPercentage / 100);
        const slPrice = entryPrice * slMultiplier;
        stopLossPrice = BigNum.fromPrint(slPrice.toString(), PRICE_PRECISION_EXP);
      }

      let orderConfig: PerpOrderParams["orderConfig"];

      // Get builder configuration from environment
      let builderParams = undefined;

      if (BUILDER_AUTHORITY && revenueShareEscrow) {
        const builderIdx = revenueShareEscrow.approvedBuilders.findIndex((builder) =>
          builder.authority.equals(BUILDER_AUTHORITY!),
        );

        if (builderIdx !== -1) {
          builderParams = {
            builderIdx,
            builderFeeTenthBps: revenueShareEscrow.approvedBuilders[builderIdx].maxFeeTenthBps,
          };
        }
      }

      switch (signal.orderType) {
        case "market": {
          const isUsingSwift = isSwiftClientHealthy;
          let toastId = "";
          orderConfig = {
            orderType: "market",
            disableSwift: !isUsingSwift,
            bracketOrders: {
              takeProfitPrice: takeProfitPrice,
              stopLossPrice: stopLossPrice,
            },
            swiftOptions: {
              callbacks: {
                onOrderParamsMessagePrepped: () => {
                  toastId = toast.loading("Preparing Order") as string;
                },
                onSigningSuccess: () => {
                  toast.success("Order Signed", { id: toastId });
                },
                onSent: () => {
                  toast.success("Order Sent", { id: toastId });
                },
                onConfirmed: () => {
                  toast.success("Order Confirmed", { id: toastId });
                },
                onExpired: () => {
                  toast.error("Order Expired", { id: toastId });
                },
                onErrored: () => {
                  toast.error("Order Errored", { id: toastId });
                },
              },
            },
          };
          break;
        }
        case "limit": {
          if (!signal.limitPrice) {
            throw new Error("Limit price is required for limit orders");
          }
          const limitPriceBigNum = BigNum.fromPrint(signal.limitPrice, QUOTE_PRECISION_EXP);
          const isUsingSwift = isSwiftClientHealthy;
          let toastId = "";
          orderConfig = {
            orderType: "limit",
            limitPrice: limitPriceBigNum,
            disableSwift: !isUsingSwift,
            bracketOrders: {
              takeProfitPrice: takeProfitPrice,
              stopLossPrice: stopLossPrice,
            },
            swiftOptions: {
              callbacks: {
                onOrderParamsMessagePrepped: () => {
                  toastId = toast.loading("Preparing Order") as string;
                },
                onSigningSuccess: () => {
                  toast.success("Order Signed", { id: toastId });
                },
                onSent: () => {
                  toast.success("Order Sent", { id: toastId });
                },
                onConfirmed: () => {
                  toast.success("Order Confirmed", { id: toastId });
                },
                onExpired: () => {
                  toast.error("Order Expired", { id: toastId });
                },
                onErrored: () => {
                  toast.error("Order Errored", { id: toastId });
                },
              },
            },
          };
          break;
        }
        case "takeProfit":
        case "stopLoss": {
          if (!signal.triggerPrice) {
            throw new Error("Trigger price is required for take profit/stop loss orders");
          }
          const triggerPriceBigNum = BigNum.fromPrint(signal.triggerPrice, QUOTE_PRECISION_EXP);
          const limitPriceBigNum = signal.limitPrice
            ? BigNum.fromPrint(signal.limitPrice, QUOTE_PRECISION_EXP)
            : undefined;
          orderConfig = {
            orderType: signal.orderType,
            triggerPrice: triggerPriceBigNum,
            limitPrice: limitPriceBigNum,
          };
          break;
        }
        case "oracleLimit": {
          if (!signal.oraclePriceOffset) {
            throw new Error("Oracle price offset is required for oracle limit orders");
          }
          const oraclePriceOffsetBigNum = BigNum.fromPrint(signal.oraclePriceOffset, QUOTE_PRECISION_EXP);
          orderConfig = {
            orderType: "oracleLimit",
            oraclePriceOffset: oraclePriceOffsetBigNum,
          };
          break;
        }
        default:
          throw new Error(`Invalid order type: ${signal.orderType}`);
      }

      const result = await drift.openPerpOrder({
        subAccountId: activeSubAccountId,
        marketIndex: signal.marketIndex,
        orderConfig,
        direction,
        assetType: "quote", // Always use quote since we calculate from collateral
        size: sizeBigNum,
        reduceOnly: signal.reduceOnly,
        postOnly: signal.postOnly ? PostOnlyParams.MUST_POST_ONLY : PostOnlyParams.NONE,
        builderParams: builderParams,
      });

      const successMessage = `${signal.orderType.toUpperCase()} ${signal.direction} order executed successfully!`;

      let txSignature: string | undefined;
      const isUsingSwift = isSwiftClientHealthy;
      if (!isUsingSwift) {
        txSignature = result as TransactionSignature;
        toast.success("Signal Executed", {
          description: successMessage,
          duration: 4000,
        });
      }

      // Record trade in database (non-blocking)
      recordTrade(signal, tradeSizeInQuote, txSignature);

      return true;
    } catch (e) {
      console.error("Error executing signal", e);

      if (e instanceof GeoBlockError) {
        toast.error("Trading Restricted", {
          description: "Trading is not available in your region due to geographical restrictions.",
          duration: 6000,
        });
      } else {
        toast.error("Execution Failed", {
          description: `Failed to execute signal. Please check your connection and try again.`,
          duration: 4000,
        });
      }
      return false;
    } finally {
      setIsExecuting(false);
    }
  };

  return {
    executeSignal,
    isExecuting,
  };
};
