"use client";

import { useState } from "react";
import {
  BASE_PRECISION_EXP,
  BigNum,
  PositionDirection,
  PRICE_PRECISION_EXP,
  QUOTE_PRECISION_EXP,
  ZERO,
} from "@drift-labs/sdk";
import { useDriftStore } from "@/stores/DriftStore";
import { useUserAccountDataStore } from "@/stores/UserAccountDataStore";
import { ENUM_UTILS, MarketId } from "@drift-labs/common";
import { useMarkPriceStore } from "@/stores/MarkPriceStore";
import { useOraclePriceStore } from "@/stores/OraclePriceStore";
import { toast } from "sonner";

interface Signal {
  _id: string;
  marketIndex: number;
  marketSymbol: string;
  orderType: string;
  direction: string;
  leverageMultiplier: number;
  limitPricePercentage?: number;
  triggerPricePercentage?: number;
  oraclePriceOffsetPercentage?: number;
  takeProfitPercentage?: number;
  stopLossPercentage?: number;
  postOnly: boolean;
  expiryTime: string;
  isActive: boolean;
}

export const useSignalExecution = () => {
  const [isExecuting, setIsExecuting] = useState(false);
  const drift = useDriftStore((s) => s.drift);
  const perpMarketConfigs = useDriftStore((s) => s.getPerpMarketConfigs());
  const activeSubAccountId = useUserAccountDataStore((s) => s.activeSubAccountId);
  const currentAccount = useUserAccountDataStore((s) => s.getCurrentAccount());
  const markPrices = useMarkPriceStore((s) => s.lookup);
  const oraclePrices = useOraclePriceStore((s) => s.lookup);

  const MAX_LEVERAGE = 2.5;

  const calculateOrderParameters = (signal: Signal) => {
    try {
      // Get current account balance
      const accountBalance = currentAccount?.marginInfo?.netUsdValue?.toNum() || 0;
      
      if (accountBalance === 0) {
        throw new Error("No account balance available");
      }

      // Get market config
      const marketConfig = perpMarketConfigs.find(
        (config) => config.marketIndex === signal.marketIndex
      );

      if (!marketConfig) {
        throw new Error("Market configuration not found");
      }

      // Get current price
      const marketId = MarketId.createPerpMarket(signal.marketIndex);
      const markPrice = markPrices[marketId.key]?.markPrice ?? ZERO;
      const oraclePrice = oraclePrices[marketId.key]?.price ?? ZERO;
      const currentPrice = !markPrice.eq(ZERO) ? markPrice : oraclePrice;

      if (currentPrice.eq(ZERO)) {
        throw new Error("Price data not available");
      }

      const currentPriceBigNum = BigNum.from(currentPrice, PRICE_PRECISION_EXP);
      const currentPriceNum = currentPriceBigNum.toNum();

      // Calculate position size based on leverage multiplier
      // Position Size (USDC) = Account Balance * Leverage Multiplier
      const positionSizeUSDC = accountBalance * signal.leverageMultiplier;

      // Validate against max leverage
      const maxTradeSize = accountBalance * MAX_LEVERAGE;
      if (positionSizeUSDC > maxTradeSize) {
        throw new Error(
          `Signal leverage (${signal.leverageMultiplier}x) exceeds maximum allowed (${MAX_LEVERAGE}x). Maximum trade size: $${maxTradeSize.toFixed(2)}`
        );
      }

      // Convert to base asset size
      // Base Size = Position Size (USDC) / Current Price
      const baseSizeNum = positionSizeUSDC / currentPriceNum;
      const baseSize = BigNum.fromPrint(baseSizeNum.toFixed(9), BASE_PRECISION_EXP);

      // Calculate prices based on percentages
      let limitPrice: BigNum | undefined;
      let triggerPrice: BigNum | undefined;
      let oraclePriceOffset: BigNum | undefined;
      let takeProfitPrice: BigNum | undefined;
      let stopLossPrice: BigNum | undefined;

      // Limit price for limit orders
      if (signal.limitPricePercentage !== undefined) {
        const limitPriceNum = currentPriceNum * (1 + signal.limitPricePercentage / 100);
        limitPrice = BigNum.fromPrint(limitPriceNum.toFixed(6), QUOTE_PRECISION_EXP);
      }

      // Trigger price for take profit/stop loss orders
      if (signal.triggerPricePercentage !== undefined) {
        const triggerPriceNum = currentPriceNum * (1 + signal.triggerPricePercentage / 100);
        triggerPrice = BigNum.fromPrint(triggerPriceNum.toFixed(6), QUOTE_PRECISION_EXP);
      }

      // Oracle price offset for oracle limit orders
      if (signal.oraclePriceOffsetPercentage !== undefined) {
        const offsetNum = currentPriceNum * (signal.oraclePriceOffsetPercentage / 100);
        oraclePriceOffset = BigNum.fromPrint(offsetNum.toFixed(6), QUOTE_PRECISION_EXP);
      }

      // Take profit price
      if (signal.takeProfitPercentage !== undefined) {
        const isLong = signal.direction === "LONG";
        const tpPriceNum = currentPriceNum * (1 + (isLong ? signal.takeProfitPercentage : -signal.takeProfitPercentage) / 100);
        takeProfitPrice = BigNum.fromPrint(tpPriceNum.toFixed(6), PRICE_PRECISION_EXP);
      }

      // Stop loss price
      if (signal.stopLossPercentage !== undefined) {
        const isLong = signal.direction === "LONG";
        const slPriceNum = currentPriceNum * (1 - (isLong ? signal.stopLossPercentage : -signal.stopLossPercentage) / 100);
        stopLossPrice = BigNum.fromPrint(slPriceNum.toFixed(6), PRICE_PRECISION_EXP);
      }

      return {
        baseSize,
        limitPrice,
        triggerPrice,
        oraclePriceOffset,
        takeProfitPrice,
        stopLossPrice,
        positionSizeUSDC,
        currentPrice: currentPriceNum,
        marketConfig,
      };
    } catch (error) {
      console.error("Error calculating order parameters:", error);
      throw error;
    }
  };

  const executeSignal = async (signal: Signal) => {
    if (!drift || activeSubAccountId === undefined) {
      toast.error("Drift Not Ready", {
        description: "Please ensure Drift is properly initialized and try again.",
        duration: 4000,
      });
      return false;
    }

    setIsExecuting(true);

    try {
      // Calculate order parameters
      const params = calculateOrderParameters(signal);

      // Convert direction
      const direction = signal.direction === "LONG" 
        ? PositionDirection.LONG 
        : PositionDirection.SHORT;

      // Build order config based on order type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let orderConfig: any;

      switch (signal.orderType) {
        case "market":
          orderConfig = {
            orderType: "market",
            disableSwift: true, // Disable swift to ensure fees are paid
            bracketOrders: {
              takeProfitPrice: params.takeProfitPrice,
              stopLossPrice: params.stopLossPrice,
            },
          };
          break;

        case "limit":
          if (!params.limitPrice) {
            throw new Error("Limit price not calculated");
          }
          orderConfig = {
            orderType: "limit",
            limitPrice: params.limitPrice,
            disableSwift: true, // Disable swift to ensure fees are paid
            bracketOrders: {
              takeProfitPrice: params.takeProfitPrice,
              stopLossPrice: params.stopLossPrice,
            },
          };
          break;

        case "takeProfit":
        case "stopLoss":
          if (!params.triggerPrice) {
            throw new Error("Trigger price not calculated");
          }
          orderConfig = {
            orderType: signal.orderType,
            triggerPrice: params.triggerPrice,
            limitPrice: params.limitPrice,
          };
          break;

        case "oracleLimit":
          if (!params.oraclePriceOffset) {
            throw new Error("Oracle price offset not calculated");
          }
          orderConfig = {
            orderType: "oracleLimit",
            oraclePriceOffset: params.oraclePriceOffset,
          };
          break;

        default:
          throw new Error(`Unsupported order type: ${signal.orderType}`);
      }

      // Execute the order
      await drift.openPerpOrder({
        subAccountId: activeSubAccountId,
        marketIndex: signal.marketIndex,
        orderConfig,
        direction,
        assetType: "base",
        size: params.baseSize,
        reduceOnly: false,
        postOnly: signal.postOnly ? 1 : 0, // PostOnlyParams.MUST_POST_ONLY : PostOnlyParams.NONE
      });

      const orderSide = ENUM_UTILS.match(direction, PositionDirection.LONG) ? "LONG" : "SHORT";
      
      toast.success("Signal Executed", {
        description: `${signal.orderType.toUpperCase()} ${orderSide} order placed successfully! Position size: ${params.baseSize.prettyPrint()} ${params.marketConfig.baseAssetSymbol} (≈$${params.positionSizeUSDC.toFixed(2)})`,
        duration: 6000,
      });

      return true;
    } catch (error) {
      console.error("Error executing signal:", error);
      toast.error("Signal Execution Failed", {
        description: error instanceof Error ? error.message : "Failed to execute signal. Please try again.",
        duration: 4000,
      });
      return false;
    } finally {
      setIsExecuting(false);
    }
  };

  return {
    executeSignal,
    isExecuting,
    calculateOrderParameters,
  };
};
