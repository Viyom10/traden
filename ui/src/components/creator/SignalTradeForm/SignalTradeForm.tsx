"use client";

import React from "react";
import { PerpMarketConfig, PositionDirection } from "@drift-labs/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { FormInput } from "../../ui/form-input";
import { FormSelect } from "../../ui/form-select";
import { Radio, TrendingUp, TrendingDown } from "lucide-react";
import {
  useSignalCreation,
  SignalOrderType,
} from "./hooks/useSignalCreation";
import { ENUM_UTILS } from "@drift-labs/common";

interface SignalTradeFormProps {
  perpMarketConfigs: PerpMarketConfig[];
  selectedMarketIndex: number;
}

export function SignalTradeForm({
  perpMarketConfigs,
  selectedMarketIndex,
}: SignalTradeFormProps) {
  const {
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
    maxLeverage,
    setOrderType,
    setDirection,
    setLeverageMultiplier,
    setLeverage,
    setLimitPricePercentage,
    setTriggerPricePercentage,
    setOraclePriceOffsetPercentage,
    setTakeProfitPercentage,
    setStopLossPercentage,
    setPostOnly,
    setExpiryDuration,
    setExpiryUnit,
    handleSubmit,
    canSubmit,
  } = useSignalCreation({ perpMarketConfigs, selectedMarketIndex });

  const isLongSide = ENUM_UTILS.match(direction, PositionDirection.LONG);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSubmit();
  };

  if (perpMarketConfigs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-yellow-400" />
            Create Signal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">
            <Radio className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No markets available</p>
            <p className="text-sm">Connect to Drift to start creating signals</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-yellow-400" />
          Create Trading Signal
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          {/* Position Side */}
          <div className="space-y-1">
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
                Short
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full *:flex-1">
            {/* Order Type Selection */}
            <FormSelect
              label="Order Type"
              value={orderType}
              onValueChange={(value) => setOrderType(value as SignalOrderType)}
              required
              options={[
                { value: "market", label: "Market" },
                { value: "limit", label: "Limit" },
                { value: "takeProfit", label: "Take Profit" },
                { value: "stopLoss", label: "Stop Loss" },
                { value: "oracleLimit", label: "Oracle Limit" },
              ]}
            />
          </div>

          {/* Leverage Multiplier */}
          <div className="space-y-2">
            <FormInput
              type="number"
              label={`Leverage Multiplier (0.1x - ${maxLeverage}x)`}
              placeholder="1.0"
              value={leverageMultiplier}
              onChange={(e) => setLeverageMultiplier(e.target.value)}
              step="0.1"
              min="0.1"
              max={maxLeverage}
              required
            />
            
            {/* Leverage Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-200">
                  Leverage: {leverage.toFixed(1)}x
                </label>
              </div>
              <div className="space-y-1">
                <input
                  type="range"
                  min="0"
                  max={maxLeverage}
                  step="0.1"
                  value={leverage}
                  onChange={(e) => setLeverage(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0x</span>
                  <span>{(maxLeverage / 2).toFixed(0)}x</span>
                  <span>{maxLeverage}x</span>
                </div>
              </div>
            </div>
            
            <p className="text-xs text-gray-400">
              This multiplier will be applied to each customer&apos;s collateral to calculate their position size
            </p>
          </div>

          {/* Price Inputs Based on Order Type */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Limit Price Percentage for limit orders */}
            {orderType === "limit" && (
              <div className="space-y-1">
                <FormInput
                  type="number"
                  label="Limit Price Offset (%)"
                  placeholder="0.5"
                  value={limitPricePercentage}
                  onChange={(e) => setLimitPricePercentage(e.target.value)}
                  step="0.1"
                  required
                />
                <p className="text-xs text-gray-400">
                  Percentage offset from current price (e.g., -2 for 2% below)
                </p>
              </div>
            )}

            {/* Trigger Price Percentage for take profit/stop loss orders */}
            {(orderType === "takeProfit" || orderType === "stopLoss") && (
              <>
                <div className="space-y-1">
                  <FormInput
                    type="number"
                    label="Trigger Price Offset (%)"
                    placeholder="5"
                    value={triggerPricePercentage}
                    onChange={(e) => setTriggerPricePercentage(e.target.value)}
                    step="0.1"
                    required
                  />
                  <p className="text-xs text-gray-400">
                    Percentage offset from current price
                  </p>
                </div>
                <div className="space-y-1">
                  <FormInput
                    type="number"
                    label="Limit Price Offset (%) - Optional"
                    placeholder="0"
                    value={limitPricePercentage}
                    onChange={(e) => setLimitPricePercentage(e.target.value)}
                    step="0.1"
                  />
                  <p className="text-xs text-gray-400">
                    Optional limit price offset
                  </p>
                </div>
              </>
            )}

            {/* Oracle Price Offset Percentage for oracle limit orders */}
            {orderType === "oracleLimit" && (
              <div className="space-y-1">
                <FormInput
                  type="number"
                  label="Oracle Price Offset (%)"
                  placeholder="0.5"
                  value={oraclePriceOffsetPercentage}
                  onChange={(e) => setOraclePriceOffsetPercentage(e.target.value)}
                  step="0.1"
                  required
                />
                <p className="text-xs text-gray-400">
                  Percentage offset from oracle price
                </p>
              </div>
            )}
          </div>

          {/* Take Profit/Stop Loss for Market and Limit Orders */}
          {(orderType === "market" || orderType === "limit") && (
            <div className="space-y-2">
              <div className="border-t border-gray-700 pt-2">
                <h4 className="text-sm font-medium text-gray-300 mb-2">
                  Optional Take Profit / Stop Loss (%)
                </h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <FormInput
                      type="number"
                      label="Take Profit Percentage"
                      placeholder="10"
                      value={takeProfitPercentage}
                      onChange={(e) => setTakeProfitPercentage(e.target.value)}
                      step="0.1"
                      min="0"
                    />
                    <p className="text-xs text-gray-400">
                      Percentage gain to trigger take profit
                    </p>
                  </div>
                  <div className="space-y-1">
                    <FormInput
                      type="number"
                      label="Stop Loss Percentage"
                      placeholder="5"
                      value={stopLossPercentage}
                      onChange={(e) => setStopLossPercentage(e.target.value)}
                      step="0.1"
                      min="0"
                    />
                    <p className="text-xs text-gray-400">
                      Percentage loss to trigger stop loss
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Signal Expiry */}
          <div className="border-t border-gray-700 pt-3 space-y-2">
            <h4 className="text-sm font-medium text-gray-300">Signal Expiry</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <FormInput
                type="number"
                label="Duration"
                placeholder="15"
                value={expiryDuration}
                onChange={(e) => setExpiryDuration(e.target.value)}
                step="1"
                min="1"
                required
              />
              <FormSelect
                label="Unit"
                value={expiryUnit}
                onValueChange={(value) => setExpiryUnit(value as "minutes" | "hours")}
                required
                options={[
                  { value: "minutes", label: "Minutes" },
                  { value: "hours", label: "Hours" },
                ]}
              />
            </div>
            <p className="text-xs text-gray-400">
              Signal will expire after the specified duration
            </p>
          </div>

          {/* Order Flags */}
          {orderType !== "market" &&
            orderType !== "stopLoss" &&
            orderType !== "takeProfit" && (
              <div className="flex items-center gap-4">
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

          <Button
            type="submit"
            className={`w-full ${
              isLongSide
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
            size="lg"
            disabled={!canSubmit}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Creating Signal...
              </div>
            ) : (
              <>
                {isLongSide ? (
                  <TrendingUp className="h-4 w-4 mr-2" />
                ) : (
                  <TrendingDown className="h-4 w-4 mr-2" />
                )}
                Create {isLongSide ? "Long" : "Short"} Signal
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
