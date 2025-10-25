"use client";

import { useState } from "react";
import {
  PerpMarketConfig,
  PositionDirection,
  ZERO,
} from "@drift-labs/sdk";
import { ENUM_UTILS, MarketId } from "@drift-labs/common";
import { useMarkPriceStore } from "@/stores/MarkPriceStore";
import { useOraclePriceStore } from "@/stores/OraclePriceStore";
import { useUserStore } from "@/stores/UserStore";
import { toast } from "sonner";

export type SignalOrderType = "market" | "limit" | "takeProfit" | "stopLoss" | "oracleLimit";

export interface UseSignalCreationProps {
  perpMarketConfigs: PerpMarketConfig[];
  selectedMarketIndex: number;
}

export const useSignalCreation = ({ perpMarketConfigs, selectedMarketIndex }: UseSignalCreationProps) => {
  const whopUser = useUserStore((s) => s.whopUser);
  const experienceId = useUserStore((s) => s.experienceId);

  const [orderType, setOrderType] = useState<SignalOrderType>("market");
  const [direction, setDirection] = useState<PositionDirection>(PositionDirection.LONG);
  const [leverageMultiplier, setLeverageMultiplier] = useState("");
  const [leverage, setLeverageSlider] = useState<number>(1);
  const [limitPricePercentage, setLimitPricePercentage] = useState("");
  const [triggerPricePercentage, setTriggerPricePercentage] = useState("");
  const [oraclePriceOffsetPercentage, setOraclePriceOffsetPercentage] = useState("");
  const [takeProfitPercentage, setTakeProfitPercentage] = useState("");
  const [stopLossPercentage, setStopLossPercentage] = useState("");
  const [postOnly, setPostOnly] = useState(false);
  const [expiryDuration, setExpiryDuration] = useState("");
  const [expiryUnit, setExpiryUnit] = useState<"minutes" | "hours">("minutes");
  const [isLoading, setIsLoading] = useState(false);

  // Maximum leverage constant
  const MAX_LEVERAGE = 20;

  // Handle leverage slider changes - update leverageMultiplier
  const handleLeverageChange = (newLeverage: number) => {
    setLeverageSlider(newLeverage);
    setLeverageMultiplier(newLeverage.toFixed(1));
  };

  // Handle leverageMultiplier text input changes - update slider
  const handleLeverageMultiplierChange = (value: string) => {
    setLeverageMultiplier(value);
    if (value && !isNaN(parseFloat(value))) {
      const leverageNum = parseFloat(value);
      // Cap leverage at MAX_LEVERAGE
      setLeverageSlider(Math.min(leverageNum, MAX_LEVERAGE));
    }
  };

  const selectedMarketConfig = perpMarketConfigs.find(
    (config) => config.marketIndex === selectedMarketIndex,
  );

  const selectedMarketId = MarketId.createPerpMarket(selectedMarketIndex);
  const markPrice = useMarkPriceStore((s) => s.lookup[selectedMarketId.key]?.markPrice ?? ZERO);
  const oraclePrice = useOraclePriceStore((s) => s.lookup[selectedMarketId.key]?.price ?? ZERO);
  
  // Use mark price if available, otherwise fallback to oracle price
  const currentPrice = !markPrice.eq(ZERO) ? markPrice : oraclePrice;

  const validateForm = (): { isValid: boolean; errorMessage?: string } => {
    if (!selectedMarketConfig) {
      return {
        isValid: false,
        errorMessage: "Please select a valid market",
      };
    }

    if (!whopUser || !experienceId) {
      return {
        isValid: false,
        errorMessage: "User information not available",
      };
    }

    if (!leverageMultiplier) {
      return {
        isValid: false,
        errorMessage: "Please enter a leverage multiplier",
      };
    }

    const leverage = parseFloat(leverageMultiplier);
    if (isNaN(leverage) || leverage < 0.1 || leverage > 20) {
      return {
        isValid: false,
        errorMessage: "Leverage multiplier must be between 0.1 and 20",
      };
    }

    if (!expiryDuration) {
      return {
        isValid: false,
        errorMessage: "Please enter expiry duration",
      };
    }

    const duration = parseInt(expiryDuration);
    if (isNaN(duration) || duration < 1) {
      return {
        isValid: false,
        errorMessage: "Expiry duration must be at least 1",
      };
    }

    // Validate based on order type
    if (orderType === "limit" && !limitPricePercentage) {
      return {
        isValid: false,
        errorMessage: "Please enter a limit price percentage for limit orders",
      };
    }

    if ((orderType === "takeProfit" || orderType === "stopLoss") && !triggerPricePercentage) {
      return {
        isValid: false,
        errorMessage: "Please enter a trigger price percentage for take profit/stop loss orders",
      };
    }

    if (orderType === "oracleLimit" && !oraclePriceOffsetPercentage) {
      return {
        isValid: false,
        errorMessage: "Please enter a price offset percentage for oracle limit orders",
      };
    }

    // Validate percentage values when provided
    if (takeProfitPercentage && (isNaN(Number(takeProfitPercentage)) || Number(takeProfitPercentage) <= 0)) {
      return {
        isValid: false,
        errorMessage: "Take profit percentage must be a positive number",
      };
    }

    if (stopLossPercentage && (isNaN(Number(stopLossPercentage)) || Number(stopLossPercentage) <= 0)) {
      return {
        isValid: false,
        errorMessage: "Stop loss percentage must be a positive number",
      };
    }

    return { isValid: true };
  };

  const handleSubmit = async () => {
    const validation = validateForm();

    if (!validation.isValid) {
      toast.error("Form Validation Error", {
        description: validation.errorMessage!,
        duration: 4000,
      });
      return;
    }

    if (!whopUser || !experienceId || !selectedMarketConfig) {
      toast.error("Missing Information", {
        description: "User or experience information not available",
        duration: 4000,
      });
      return;
    }

    setIsLoading(true);

    try {
      const orderSide = ENUM_UTILS.match(direction, PositionDirection.LONG) ? "LONG" : "SHORT";
      
      const signalData = {
        creatorId: (whopUser as { id: string }).id,
        experienceId,
        marketIndex: selectedMarketIndex,
        marketSymbol: selectedMarketConfig.symbol,
        orderType,
        direction: orderSide,
        leverageMultiplier: parseFloat(leverageMultiplier),
        limitPricePercentage: limitPricePercentage ? parseFloat(limitPricePercentage) : undefined,
        triggerPricePercentage: triggerPricePercentage ? parseFloat(triggerPricePercentage) : undefined,
        oraclePriceOffsetPercentage: oraclePriceOffsetPercentage ? parseFloat(oraclePriceOffsetPercentage) : undefined,
        takeProfitPercentage: takeProfitPercentage ? parseFloat(takeProfitPercentage) : undefined,
        stopLossPercentage: stopLossPercentage ? parseFloat(stopLossPercentage) : undefined,
        postOnly,
        expiryDuration: parseInt(expiryDuration),
        expiryUnit,
      };

      const response = await fetch("/api/signal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(signalData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create signal");
      }

      const result = await response.json();

      toast.success("Signal Created", {
        description: `Signal will expire at ${new Date(result.expiryTime).toLocaleString()}`,
        duration: 4000,
      });

      // Reset form
      resetForm();
    } catch (error) {
      console.error("Error creating signal:", error);
      toast.error("Signal Creation Failed", {
        description: error instanceof Error ? error.message : "Failed to create signal. Please try again.",
        duration: 4000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setLeverageMultiplier("");
    setLeverageSlider(1);
    setLimitPricePercentage("");
    setTriggerPricePercentage("");
    setOraclePriceOffsetPercentage("");
    setTakeProfitPercentage("");
    setStopLossPercentage("");
    setExpiryDuration("");
  };

  return {
    // State
    orderType,
    direction,
    leverageMultiplier,
    leverage,
    limitPricePercentage,
    triggerPricePercentage,
    oraclePriceOffsetPercentage,
    takeProfitPercentage,
    stopLossPercentage,
    postOnly,
    expiryDuration,
    expiryUnit,
    isLoading,
    selectedMarketConfig,
    currentPrice,
    maxLeverage: MAX_LEVERAGE,

    // Actions
    setOrderType,
    setDirection,
    setLeverageMultiplier: handleLeverageMultiplierChange,
    setLeverage: handleLeverageChange,
    setLimitPricePercentage,
    setTriggerPricePercentage,
    setOraclePriceOffsetPercentage,
    setTakeProfitPercentage,
    setStopLossPercentage,
    setPostOnly,
    setExpiryDuration,
    setExpiryUnit,
    handleSubmit,
    resetForm,

    // Computed
    isFormValid: validateForm().isValid,
    canSubmit: !isLoading && perpMarketConfigs.length > 0 && validateForm().isValid,
  };
};
