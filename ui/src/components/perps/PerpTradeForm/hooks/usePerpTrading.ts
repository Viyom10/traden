"use client";

import { useState } from "react";
import {
  BASE_PRECISION_EXP,
  BigNum,
  PerpMarketConfig,
  PositionDirection,
  PostOnlyParams,
  PRICE_PRECISION_EXP,
  QUOTE_PRECISION_EXP,
  ZERO,
  BN,
} from "@drift-labs/sdk";
import { useDriftStore } from "@/stores/DriftStore";
import { useUserAccountDataStore } from "@/stores/UserAccountDataStore";
import { ENUM_UTILS, PerpOrderParams, GeoBlockError, EnvironmentConstants } from "@drift-labs/common";
import { toast } from "sonner";
import { TransactionSignature, PublicKey } from "@solana/web3.js";
import { BUILDER_AUTHORITY } from "@/constants/builderCode";
import { useMarkPriceStore } from "@/stores/MarkPriceStore";
import { useOraclePriceStore } from "@/stores/OraclePriceStore";
import { MarketId } from "@drift-labs/common";
import { useGetPerpMarketMinOrderSize } from "@/hooks/markets/useGetPerpMarketMinOrderSize";
import { useUserStore } from "@/stores/UserStore";
import { createOpenPerpMarketOrder } from "@drift-labs/common";

export type PerpOrderType = "market" | "limit" | "takeProfit" | "stopLoss" | "oracleLimit";
export type AssetSizeType = "base" | "quote";

export interface UsePerpTradingProps {
  perpMarketConfigs: PerpMarketConfig[];
  selectedMarketIndex: number;
}

export const usePerpTrading = ({ perpMarketConfigs, selectedMarketIndex }: UsePerpTradingProps) => {
  const drift = useDriftStore((s) => s.drift);
  const isSwiftClientHealthy = useDriftStore((s) => s.isSwiftClientHealthy);
  const environment = useDriftStore((s) => s.environment);
  const activeSubAccountId = useUserAccountDataStore((s) => s.activeSubAccountId);
  const currentAccount = useUserAccountDataStore((s) => s.getCurrentAccount());
  const revenueShareEscrow = useUserAccountDataStore((s) => s.revenueShareEscrow);
  const whopUser = useUserStore((s) => s.whopUser);
  const experienceId = useUserStore((s) => s.experienceId);

  const [orderType, setOrderType] = useState<PerpOrderType>("market");
  const [direction, setDirection] = useState<PositionDirection>(PositionDirection.LONG);
  const [sizeType, setSizeType] = useState<AssetSizeType>("base");
  const [size, setSize] = useState("");
  const [leverage, setLeverage] = useState<number>(1);
  const [limitPrice, setLimitPrice] = useState("");
  const [triggerPrice, setTriggerPrice] = useState("");
  const [oraclePriceOffset, setOraclePriceOffset] = useState("");
  const [takeProfitPrice, setTakeProfitPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [reduceOnly, setReduceOnlyState] = useState(false);
  const [postOnly, setPostOnlyState] = useState(false);
  const [useSwift, setUseSwift] = useState(false);

  // Maximum leverage constant
  const MAX_LEVERAGE = 20;

  // Calculate account balance
  const accountBalance = currentAccount?.marginInfo?.netUsdValue?.toNum() || 0;

  // Handle leverage changes - update size based on leverage
  const handleLeverageChange = (newLeverage: number) => {
    setLeverage(newLeverage);
    if (accountBalance > 0) {
      const newSize = accountBalance * newLeverage;
      setSize(newSize.toFixed(2));
      // When leverage is used, always use quote (USDC) size type
      setSizeType("quote");
    }
  };

  // Handle size changes - update leverage based on size
  const handleSizeChange = (newSize: string) => {
    setSize(newSize);
    if (accountBalance > 0 && newSize && !isNaN(parseFloat(newSize))) {
      const sizeNum = parseFloat(newSize);
      const calculatedLeverage = sizeNum / accountBalance;
      // Cap leverage at MAX_LEVERAGE
      setLeverage(Math.min(calculatedLeverage, MAX_LEVERAGE));
    }
  };

  const setReduceOnly = (value: boolean) => {
    setReduceOnlyState(value);
    if (value) {
      setPostOnlyState(false);
    }
  };

  const setPostOnly = (value: boolean) => {
    setPostOnlyState(value);
    if (value) {
      setReduceOnlyState(false);
    }
  };
  const [isLoading, setIsLoading] = useState(false);

  const selectedMarketConfig = perpMarketConfigs.find(
    (config) => config.marketIndex === selectedMarketIndex,
  );

  const minOrderSize = useGetPerpMarketMinOrderSize(selectedMarketIndex);
  
  const selectedMarketId = MarketId.createPerpMarket(selectedMarketIndex);
  const markPrice = useMarkPriceStore((s) => s.lookup[selectedMarketId.key]?.markPrice ?? ZERO);
  const oraclePrice = useOraclePriceStore((s) => s.lookup[selectedMarketId.key]?.price ?? ZERO);
  
  // Use mark price if available, otherwise fallback to oracle price
  const currentPrice = !markPrice.eq(ZERO) ? markPrice : oraclePrice;

  // Function to record trade in database
  const recordTrade = async (txSignature?: string) => {
    if (!whopUser || !experienceId || !selectedMarketConfig) {
      console.warn("Missing user info for trade recording");
      return;
    }

    try {
      const orderSide = ENUM_UTILS.match(direction, PositionDirection.LONG) ? "LONG" : "SHORT";
      
      const tradeData = {
        userId: (whopUser as { id: string }).id,
        experienceId,
        marketIndex: selectedMarketIndex,
        marketSymbol: selectedMarketConfig.symbol,
        orderType,
        direction: orderSide,
        sizeType,
        size,
        limitPrice: limitPrice || undefined,
        triggerPrice: triggerPrice || undefined,
        oraclePriceOffset: oraclePriceOffset || undefined,
        takeProfitPrice: takeProfitPrice || undefined,
        stopLossPrice: stopLossPrice || undefined,
        reduceOnly,
        postOnly,
        useSwift,
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
      } else {
        console.log("Trade recorded successfully");
      }
    } catch (error) {
      console.error("Error recording trade:", error);
      // Don't throw - we don't want trade recording to block the user experience
    }
  };

  const validateForm = (): { isValid: boolean; errorMessage?: string } => {
    if (!selectedMarketConfig) {
      return {
        isValid: false,
        errorMessage: "Please select a valid market",
      };
    }

    if (!size) {
      return {
        isValid: false,
        errorMessage: "Please enter a size",
      };
    }

    if (selectedMarketConfig && !minOrderSize.eq(ZERO)) {
      try {
        const sizePrecisionExp = sizeType === "base" ? BASE_PRECISION_EXP : QUOTE_PRECISION_EXP;
        const sizeBigNum = BigNum.fromPrint(size, sizePrecisionExp);
        
        // For base asset type, directly compare with minimum order size
        if (sizeType === "base") {
          if (sizeBigNum.val.lt(minOrderSize)) {
            const minOrderSizeFormatted = BigNum.from(minOrderSize, BASE_PRECISION_EXP).prettyPrint();
            return {
              isValid: false,
              errorMessage: `Order size must be at least ${minOrderSizeFormatted} ${selectedMarketConfig.baseAssetSymbol}`,
            };
          }
        } else if (sizeType === "quote") {
          // For quote asset type, convert notional amount to base asset amount using current price
          if (currentPrice.eq(ZERO)) {
            return {
              isValid: false,
              errorMessage: "Price data not available. Please try again in a moment.",
            };
          }
          
          // Quote amount / Current price = Base amount
          // To maintain precision, we'll use BN math directly
          const currentPriceBigNum = BigNum.from(currentPrice, PRICE_PRECISION_EXP);
          
          // Convert both to their raw BN values and do the division with proper scaling
          const sizeRaw = sizeBigNum.val; // This is in QUOTE_PRECISION (1e6)
          const priceRaw = currentPriceBigNum.val; // This is in PRICE_PRECISION (1e6)
          
          // sizeRaw (1e6) / priceRaw (1e6) * 1e9 = result in BASE_PRECISION (1e9)
          const basePrecisionMultiplier = new BN(10).pow(new BN(BASE_PRECISION_EXP));
          const baseEquivalentRaw = sizeRaw.mul(basePrecisionMultiplier).div(priceRaw);
          const baseEquivalent = BigNum.from(baseEquivalentRaw, BASE_PRECISION_EXP);
          
          // Debug logging
          // console.log("Quote validation debug (improved):", {
          //   size,
          //   sizeUSDC: sizeBigNum.prettyPrint(),
          //   sizeBigNumVal: sizeBigNum.val.toString(),
          //   currentPrice: currentPriceBigNum.prettyPrint(),
          //   currentPriceVal: currentPriceBigNum.val.toString(),
          //   baseEquivalent: baseEquivalent.prettyPrint(),
          //   baseEquivalentVal: baseEquivalent.val.toString(),
          //   baseEquivalentRaw: baseEquivalentRaw.toString(),
          //   minOrderSize: BigNum.from(minOrderSize, BASE_PRECISION_EXP).prettyPrint(),
          //   minOrderSizeVal: minOrderSize.toString(),
          //   isValid: !baseEquivalent.val.lt(minOrderSize)
          // });
          
          if (baseEquivalent.val.lt(minOrderSize)) {
            const minOrderSizeFormatted = BigNum.from(minOrderSize, BASE_PRECISION_EXP).prettyPrint();
            const minNotionalValue = BigNum.from(minOrderSize, BASE_PRECISION_EXP).mul(currentPriceBigNum);
            return {
              isValid: false,
              errorMessage: `Order size must be at least ${minOrderSizeFormatted} ${selectedMarketConfig.baseAssetSymbol} (≈$${minNotionalValue.prettyPrint()})`,
            };
          }
        }
      } catch (_error) {
        // If size parsing fails, let it be caught by other validations
      }
    }

    if (orderType === "limit" && !limitPrice) {
      return {
        isValid: false,
        errorMessage: "Please enter a limit price for limit orders",
      };
    }

    if ((orderType === "takeProfit" || orderType === "stopLoss") && !triggerPrice) {
      return {
        isValid: false,
        errorMessage: "Please enter a trigger price for take profit/stop loss orders",
      };
    }

    if (orderType === "oracleLimit" && !oraclePriceOffset) {
      return {
        isValid: false,
        errorMessage: "Please enter a price offset for oracle limit orders",
      };
    }

    // Validate take profit and stop loss values are numeric when provided
    if (takeProfitPrice && (isNaN(Number(takeProfitPrice)) || Number(takeProfitPrice) <= 0)) {
      return {
        isValid: false,
        errorMessage: "Take profit price must be a positive number",
      };
    }

    if (stopLossPrice && (isNaN(Number(stopLossPrice)) || Number(stopLossPrice) <= 0)) {
      return {
        isValid: false,
        errorMessage: "Stop loss price must be a positive number",
      };
    }

    return { isValid: true };
  };

  const handleSubmit = async () => {
    if (!drift || activeSubAccountId === undefined || !currentAccount) {
      toast.error("Drift Not Ready", {
        description: "Please ensure Drift is properly initialized and try again.",
        duration: 4000,
      });
      return;
    }

    const validation = validateForm();

    if (!validation.isValid) {
      toast.error("Form Validation Error", {
        description: validation.errorMessage!,
        duration: 4000,
      });
      return;
    }

    setIsLoading(true);

    try {
      const sizePrecisionExp = sizeType === "base" ? BASE_PRECISION_EXP : QUOTE_PRECISION_EXP;
      const sizeBigNum = BigNum.fromPrint(size, sizePrecisionExp);

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

      // Map environment to dlob server key
      const envKey = environment === "mainnet-beta" ? "mainnet" : "dev";
      const dlobServerHttpUrl = (EnvironmentConstants.dlobServerHttpUrl as Record<string, string>)[envKey];

      const isUsingSwift = isSwiftClientHealthy && useSwift && orderType === "market";

      let result: TransactionSignature | void = undefined;
      let toastId = "";

      if (orderType === "market") {
        // Use createOpenPerpMarketOrder for market orders
        const swiftCallbacks = {
          onOrderParamsMessagePrepped: () => {
            toastId = toast.loading("Preparing Order") as string;
          },
          onSigningSuccess: () => {
            toast.success("Order Signed", {
              id: toastId,
            });
          },
          onSent: () => {
            toast.success("Order Sent", {
              id: toastId,
            });
          },
          onConfirmed: () => {
            toast.success("Order Confirmed", {
              id: toastId,
            });
          },
          onExpired: () => {
            toast.error("Order Expired", {
              id: toastId,
            });
          },
          onErrored: () => {
            toast.error("Order Errored", {
              id: toastId,
            });
          },
        };

        const bracketOrders = (takeProfitPrice || stopLossPrice) ? {
          takeProfit: takeProfitPrice ? {
            triggerPrice: BigNum.fromPrint(takeProfitPrice, PRICE_PRECISION_EXP).val,
          } : undefined,
          stopLoss: stopLossPrice ? {
            triggerPrice: BigNum.fromPrint(stopLossPrice, PRICE_PRECISION_EXP).val,
          } : undefined,
        } : undefined;

        if (isUsingSwift && drift.driftClient.wallet) {
          const wallet = drift.driftClient.wallet as unknown as { signMessage: (message: Uint8Array) => Promise<Uint8Array>; publicKey: PublicKey };
          
          await createOpenPerpMarketOrder({
            driftClient: drift.driftClient,
            user: currentAccount.userClient,
            assetType: sizeType,
            marketIndex: selectedMarketIndex,
            direction,
            amount: sizeBigNum.val,
            dlobServerHttpUrl,
            useSwift: true,
            swiftOptions: {
              wallet: {
                signMessage: wallet.signMessage.bind(wallet),
                takerAuthority: wallet.publicKey,
              },
              swiftServerUrl: drift.driftEndpoints.swiftServerUrl,
              callbacks: swiftCallbacks,
            },
            bracketOrders,
            builderParams,
          });
        } else {
          const txn = await createOpenPerpMarketOrder({
            driftClient: drift.driftClient,
            user: currentAccount.userClient,
            assetType: sizeType,
            marketIndex: selectedMarketIndex,
            direction,
            amount: sizeBigNum.val,
            dlobServerHttpUrl,
            useSwift: false,
            bracketOrders,
          });
          
          // Send the transaction
          const txResult = await drift.driftClient.sendTransaction(txn);
          result = txResult.txSig;
        }
      } else {
        // Use drift.openPerpOrder for non-market orders (limit, takeProfit, stopLoss, oracleLimit)
        let orderConfig: PerpOrderParams["orderConfig"];
        
        switch (orderType) {
          case "limit": {
            const limitPriceBigNum = BigNum.fromPrint(limitPrice, QUOTE_PRECISION_EXP);
            orderConfig = {
              orderType: "limit",
              limitPrice: limitPriceBigNum,
              disableSwift: true,
              bracketOrders: {
                takeProfitPrice: takeProfitPrice
                  ? BigNum.fromPrint(takeProfitPrice, PRICE_PRECISION_EXP)
                  : undefined,
                stopLossPrice: stopLossPrice
                  ? BigNum.fromPrint(stopLossPrice, PRICE_PRECISION_EXP)
                  : undefined,
              },
            };
            break;
          }
          case "takeProfit":
          case "stopLoss": {
            const triggerPriceBigNum = BigNum.fromPrint(triggerPrice, QUOTE_PRECISION_EXP);
            const limitPriceTakeProfitBigNum = limitPrice
              ? BigNum.fromPrint(limitPrice, QUOTE_PRECISION_EXP)
              : undefined;
            orderConfig = {
              orderType: orderType,
              triggerPrice: triggerPriceBigNum,
              limitPrice: limitPriceTakeProfitBigNum,
            };
            break;
          }
          case "oracleLimit": {
            const oraclePriceOffsetBigNum = BigNum.fromPrint(oraclePriceOffset, QUOTE_PRECISION_EXP);
            orderConfig = {
              orderType: "oracleLimit",
              oraclePriceOffset: oraclePriceOffsetBigNum,
            };
            break;
          }
          default:
            throw new Error(`Invalid order type: ${orderType}`);
        }

        result = await drift.openPerpOrder({
          subAccountId: activeSubAccountId,
          marketIndex: selectedMarketIndex,
          orderConfig,
          direction,
          assetType: sizeType,
          size: sizeBigNum,
          reduceOnly,
          postOnly: postOnly ? PostOnlyParams.MUST_POST_ONLY : PostOnlyParams.NONE,
        });
      }

      const orderSide = ENUM_UTILS.match(direction, PositionDirection.LONG) ? "LONG" : "SHORT";
      const successMessage = `${orderType.toUpperCase()} ${orderSide} order placed successfully!`;

      let txSignature: string | undefined;
      if (!isUsingSwift && result) {
        txSignature = result as TransactionSignature;

        toast.success("Order Placed", {
          description: successMessage,
          duration: 4000,
        });
      }

      // Record trade in database (non-blocking)
      recordTrade(txSignature);

      // Reset form
      resetForm();
    } catch (e) {
      console.error("Error in handleSubmit", e);

      // Handle GeoBlockError specifically
      if (e instanceof GeoBlockError) {
        toast.error("Trading Restricted", {
          description: "Trading is not available in your region due to geographical restrictions.",
          duration: 6000,
        });
      } else {
        // Handle other errors with generic toast
        toast.error("Order Failed", {
          description: `Failed to place ${orderType} order. Please check your connection and try again.`,
          duration: 4000,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSize("");
    setLeverage(1);
    setLimitPrice("");
    setTriggerPrice("");
    setOraclePriceOffset("");
    setTakeProfitPrice("");
    setStopLossPrice("");
  };

  return {
    // State
    orderType,
    direction,
    sizeType,
    size,
    leverage,
    limitPrice,
    triggerPrice,
    oraclePriceOffset,
    takeProfitPrice,
    stopLossPrice,
    reduceOnly,
    postOnly,
    useSwift,
    isLoading,
    selectedMarketConfig,
    minOrderSize,
    accountBalance,
    maxLeverage: MAX_LEVERAGE,

    // Actions
    setOrderType,
    setDirection,
    setSizeType,
    setSize: handleSizeChange,
    setLeverage: handleLeverageChange,
    setLimitPrice,
    setTriggerPrice,
    setOraclePriceOffset,
    setTakeProfitPrice,
    setStopLossPrice,
    setReduceOnly,
    setPostOnly,
    setUseSwift,
    handleSubmit,
    resetForm,

    // Computed
    isFormValid: validateForm().isValid,
    canSubmit: !isLoading && perpMarketConfigs.length > 0 && validateForm().isValid,
  };
};
