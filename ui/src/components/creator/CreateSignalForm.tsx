"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { FormInput } from "../ui/form-input";
import { FormSelect } from "../ui/form-select";
import { Radio, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { handleErrorToast } from "@/utils/toastUtils";
import { PerpMarketConfig, PositionDirection } from "@drift-labs/sdk";
import { ENUM_UTILS } from "@drift-labs/common";
import { createSignal } from "@/lib/signalApi";

interface CreateSignalFormProps {
  perpMarketConfigs: PerpMarketConfig[];
  experienceId: string;
}

type OrderType = "market" | "limit" | "takeProfit" | "stopLoss" | "oracleLimit";
type ExpiryUnit = "min" | "hour" | "day";

export const CreateSignalForm = ({
  perpMarketConfigs,
  experienceId,
}: CreateSignalFormProps) => {
  const [selectedMarketIndex, setSelectedMarketIndex] = useState(0);
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [direction, setDirection] = useState<PositionDirection>(PositionDirection.LONG);
  const [leverageMultiplier, setLeverageMultiplier] = useState("2");
  const [limitPrice, setLimitPrice] = useState("");
  const [triggerPrice, setTriggerPrice] = useState("");
  const [oraclePriceOffset, setOraclePriceOffset] = useState("");
  const [takeProfitPercentage, setTakeProfitPercentage] = useState("");
  const [stopLossPercentage, setStopLossPercentage] = useState("");
  const [reduceOnly, setReduceOnly] = useState(false);
  const [postOnly, setPostOnly] = useState(false);
  const [expiryDuration, setExpiryDuration] = useState("15");
  const [expiryUnit, setExpiryUnit] = useState<ExpiryUnit>("min");
  const [isLoading, setIsLoading] = useState(false);

  const selectedMarketConfig = perpMarketConfigs.find(
    (config) => config.marketIndex === selectedMarketIndex
  );

  const isLongSide = ENUM_UTILS.match(direction, PositionDirection.LONG);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedMarketConfig) {
      toast.error("Please select a valid market");
      return;
    }

    setIsLoading(true);

    try {
      const response = await createSignal({
        experienceId,
        marketIndex: selectedMarketIndex,
        marketSymbol: selectedMarketConfig.symbol,
        orderType,
        direction: isLongSide ? "LONG" : "SHORT",
        leverageMultiplier: parseFloat(leverageMultiplier),
        limitPrice: limitPrice || undefined,
        triggerPrice: triggerPrice || undefined,
        oraclePriceOffset: oraclePriceOffset || undefined,
        takeProfitPercentage: takeProfitPercentage ? parseFloat(takeProfitPercentage) : undefined,
        stopLossPercentage: stopLossPercentage ? parseFloat(stopLossPercentage) : undefined,
        reduceOnly,
        postOnly,
        expiryDuration: parseInt(expiryDuration),
        expiryUnit,
      });

      toast.success("Trade signal created successfully!");
      
      // Reset form
      setLeverageMultiplier("2");
      setLimitPrice("");
      setTriggerPrice("");
      setOraclePriceOffset("");
      setTakeProfitPercentage("");
      setStopLossPercentage("");
      setExpiryDuration("15");
      
      console.log("Signal created:", response);
    } catch (error) {
      handleErrorToast(error, "Failed to create trade signal. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-purple-400" />
          Create Trade Signal
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Market Selection */}
          <FormSelect
            label="Select Market"
            value={selectedMarketIndex.toString()}
            onValueChange={(value) => setSelectedMarketIndex(Number(value))}
            required
            options={perpMarketConfigs.map((config) => ({
              value: config.marketIndex.toString(),
              label: `${config.symbol} (${config.baseAssetSymbol})`,
            }))}
          />

          {/* Direction Toggle */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-200">Direction</label>
            <div className="flex bg-gray-800 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setDirection(PositionDirection.LONG)}
                className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isLongSide
                    ? "bg-green-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <TrendingUp className="h-4 w-4 inline mr-1" />
                Long
              </button>
              <button
                type="button"
                onClick={() => setDirection(PositionDirection.SHORT)}
                className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  !isLongSide
                    ? "bg-red-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <TrendingDown className="h-4 w-4 inline mr-1" />
                Short
              </button>
            </div>
          </div>

          {/* Order Type */}
          <FormSelect
            label="Order Type"
            value={orderType}
            onValueChange={(value) => setOrderType(value as OrderType)}
            required
            options={[
              { value: "market", label: "Market" },
              { value: "limit", label: "Limit" },
              { value: "takeProfit", label: "Take Profit" },
              { value: "stopLoss", label: "Stop Loss" },
              { value: "oracleLimit", label: "Oracle Limit" },
            ]}
          />

          {/* Leverage Multiplier */}
          <div>
            <FormInput
              type="number"
              label="Leverage Multiplier"
              placeholder="2"
              value={leverageMultiplier}
              onChange={(e) => setLeverageMultiplier(e.target.value)}
              step="0.01"
              min="0.01"
              max="10"
              required
              helperText="Trade size = Customer's collateral × leverage multiplier (e.g., 2x means if customer has 10 SOL, trade will be for 20 SOL worth)"
            />
          </div>

          {/* Price Inputs Based on Order Type */}
          {orderType === "limit" && (
            <FormInput
              type="number"
              label="Limit Price (USDC)"
              placeholder="0.00"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              step="any"
              min="0"
              required
            />
          )}

          {(orderType === "takeProfit" || orderType === "stopLoss") && (
            <div className="grid md:grid-cols-2 gap-4">
              <FormInput
                type="number"
                label="Trigger Price (USDC)"
                placeholder="0.00"
                value={triggerPrice}
                onChange={(e) => setTriggerPrice(e.target.value)}
                step="any"
                min="0"
                required
              />
              <FormInput
                type="number"
                label="Limit Price (Optional)"
                placeholder="0.00"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                step="any"
                min="0"
              />
            </div>
          )}

          {orderType === "oracleLimit" && (
            <FormInput
              type="number"
              label="Price Offset (USDC)"
              placeholder="0.00"
              value={oraclePriceOffset}
              onChange={(e) => setOraclePriceOffset(e.target.value)}
              step="any"
              required
            />
          )}

          {/* Take Profit/Stop Loss for Market and Limit Orders */}
          {(orderType === "market" || orderType === "limit") && (
            <div className="space-y-2 pt-2 border-t border-gray-700">
              <h4 className="text-sm font-medium text-gray-300">
                Optional Take Profit / Stop Loss
              </h4>
              <div className="grid md:grid-cols-2 gap-4">
                <FormInput
                  type="number"
                  label="Take Profit (%)"
                  placeholder="10"
                  value={takeProfitPercentage}
                  onChange={(e) => setTakeProfitPercentage(e.target.value)}
                  step="0.01"
                  min="0"
                  max="1000"
                  helperText="Percentage gain for take profit (e.g., 10 = 10% gain)"
                />
                <FormInput
                  type="number"
                  label="Stop Loss (%)"
                  placeholder="5"
                  value={stopLossPercentage}
                  onChange={(e) => setStopLossPercentage(e.target.value)}
                  step="0.01"
                  min="0"
                  max="100"
                  helperText="Percentage loss for stop loss (e.g., 5 = 5% loss)"
                />
              </div>
            </div>
          )}

          {/* Order Flags */}
          {orderType !== "market" &&
            orderType !== "stopLoss" &&
            orderType !== "takeProfit" && (
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reduceOnly}
                    onChange={(e) => setReduceOnly(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-sm text-gray-200">Reduce Only</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={postOnly}
                    onChange={(e) => setPostOnly(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-sm text-gray-200">Post Only</span>
                </label>
              </div>
            )}

          {/* Expiry Settings */}
          <div className="space-y-2 pt-2 border-t border-gray-700">
            <h4 className="text-sm font-medium text-gray-300">Signal Expiry</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <FormInput
                type="number"
                label="Duration"
                placeholder="15"
                value={expiryDuration}
                onChange={(e) => setExpiryDuration(e.target.value)}
                min="1"
                required
              />
              <FormSelect
                label="Unit"
                value={expiryUnit}
                onValueChange={(value) => setExpiryUnit(value as ExpiryUnit)}
                required
                options={[
                  { value: "min", label: "Minutes" },
                  { value: "hour", label: "Hours" },
                  { value: "day", label: "Days" },
                ]}
              />
            </div>
            <p className="text-xs text-gray-400">
              Signal will expire in {expiryDuration} {expiryUnit}
              {parseInt(expiryDuration) !== 1 && expiryUnit !== "min" ? "s" : expiryUnit === "min" && parseInt(expiryDuration) !== 1 ? "s" : ""}
            </p>
          </div>

          <Button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700"
            size="lg"
            disabled={!leverageMultiplier || isLoading}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Creating Signal...
              </div>
            ) : (
              <>
                <Radio className="h-4 w-4 mr-2" />
                Create Signal
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
