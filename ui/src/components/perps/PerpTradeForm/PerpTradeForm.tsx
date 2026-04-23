"use client";

import React from "react";
import { PerpMarketConfig, PositionDirection, BigNum, BASE_PRECISION_EXP, PRICE_PRECISION_EXP, ZERO } from "@drift-labs/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { FormInput } from "../../ui/form-input";
import { FormSelect } from "../../ui/form-select";
import { Target, TrendingUp, TrendingDown } from "lucide-react";
import {
  usePerpTrading,
  AssetSizeType,
  PerpOrderType,
} from "./hooks/usePerpTrading";
import { ENUM_UTILS, MarketId } from "@drift-labs/common";
import { useMarkPriceStore } from "@/stores/MarkPriceStore";
import { useOraclePriceStore } from "@/stores/OraclePriceStore";
import { SimulatedSignModal } from "../SimulatedSignModal";

interface PerpTradeFormProps {
  perpMarketConfigs: PerpMarketConfig[];
  selectedMarketIndex: number;
}

export function PerpTradeForm({
  perpMarketConfigs,
  selectedMarketIndex,
}: PerpTradeFormProps) {
  const {
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
    reduceOnly: _reduceOnly,
    postOnly,
    isLoading,
    selectedMarketConfig,
    minOrderSize,
    accountBalance,
    maxLeverage,
    setOrderType,
    setDirection,
    setSizeType,
    setSize,
    setLeverage,
    setLimitPrice,
    setTriggerPrice,
    setOraclePriceOffset,
    setTakeProfitPrice,
    setStopLossPrice,
    setReduceOnly: _setReduceOnly,
    setPostOnly,
    handleSubmit,
    canSubmit,
    simModalOpen,
    pendingSimTrade,
    confirmSimulatedSign,
    cancelSimulatedSign,
    setSimModalOpen,
  } = usePerpTrading({ perpMarketConfigs, selectedMarketIndex });

  const selectedMarketId = MarketId.createPerpMarket(selectedMarketIndex);
  const markPrice = useMarkPriceStore((s) => s.lookup[selectedMarketId.key]?.markPrice ?? ZERO);
  const oraclePrice = useOraclePriceStore((s) => s.lookup[selectedMarketId.key]?.price ?? ZERO);
  
  // Use mark price if available, otherwise fallback to oracle price
  const currentPrice = !markPrice.eq(ZERO) ? markPrice : oraclePrice;

  const isLongSide = ENUM_UTILS.match(direction, PositionDirection.LONG);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSubmit();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-yellow-400" />
          Place Perpetual Order
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
              onValueChange={(value) => setOrderType(value as PerpOrderType)}
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

          <div className="flex items-center gap-4 w-full *:flex-1">
            {/* Size Type Selection */}
            <FormSelect
              label="Size Type"
              value={sizeType}
              onValueChange={(value) => setSizeType(value as AssetSizeType)}
              required
              options={[
                {
                  value: "base",
                  label: `Base Asset (${
                    selectedMarketConfig?.baseAssetSymbol || "Units"
                  })`,
                },
                {
                  value: "quote",
                  label: "Notional Value (USDC)",
                },
              ]}
            />

            {/* Size Input */}
            <FormInput
              type="number"
              label={`Size ${
                sizeType === "base"
                  ? `(${selectedMarketConfig?.baseAssetSymbol || "Units"})`
                  : "(USDC)"
              }`}
              placeholder="0.00"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              step="any"
              min="0"
              required
            />
          </div>

          {/* Leverage Slider */}
          {accountBalance > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-200">
                  Leverage: {leverage.toFixed(1)}x
                </label>
                <span className="text-xs text-gray-400">
                  Collateral: ${accountBalance.toFixed(2)}
                </span>
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
              {leverage > 0 && (
                <div className="text-xs text-gray-400">
                  Position size at {leverage.toFixed(1)}x: ${(accountBalance * leverage).toFixed(2)} USDC
                </div>
              )}
            </div>
          )}

          {/* Minimum Order Size Info */}
          {selectedMarketConfig && !minOrderSize.eq(ZERO) && (
            <div className="text-sm text-gray-400">
              {sizeType === "base" ? (
                <>Minimum order size: {BigNum.from(minOrderSize, BASE_PRECISION_EXP).prettyPrint()} {selectedMarketConfig.baseAssetSymbol}</>
              ) : !currentPrice.eq(ZERO) ? (
                <>
                  Minimum order size: {BigNum.from(minOrderSize, BASE_PRECISION_EXP).prettyPrint()} {selectedMarketConfig.baseAssetSymbol} 
                  {" (≈$"}
                  {BigNum.from(minOrderSize, BASE_PRECISION_EXP)
                    .mul(BigNum.from(currentPrice, PRICE_PRECISION_EXP))
                    .prettyPrint()}
                  {")"}
                </>
              ) : (
                <>Minimum order size: {BigNum.from(minOrderSize, BASE_PRECISION_EXP).prettyPrint()} {selectedMarketConfig.baseAssetSymbol} (price loading...)</>
              )}
            </div>
          )}

          {/* Price Inputs Based on Order Type */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Limit Price for limit orders */}
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

            {/* Trigger Price for take profit/stop loss orders */}
            {(orderType === "takeProfit" || orderType === "stopLoss") && (
              <>
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
                  label="Limit Price (USDC) - Optional"
                  placeholder="0.00"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  step="any"
                  min="0"
                />
              </>
            )}

            {/* Oracle Price Offset for oracle limit orders */}
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
          </div>

          {/* Take Profit/Stop Loss for Market and Limit Orders */}
          {(orderType === "market" || orderType === "limit") && (
            <div className="space-y-2">
              <div className="border-t border-gray-700 pt-2">
                <h4 className="text-sm font-medium text-gray-300 mb-2">
                  Optional Take Profit / Stop Loss
                </h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <FormInput
                    type="number"
                    label="Take Profit Price (USDC)"
                    placeholder="0.00"
                    value={takeProfitPrice}
                    onChange={(e) => setTakeProfitPrice(e.target.value)}
                    step="any"
                    min="0"
                  />
                  <FormInput
                    type="number"
                    label="Stop Loss Price (USDC)"
                    placeholder="0.00"
                    value={stopLossPrice}
                    onChange={(e) => setStopLossPrice(e.target.value)}
                    step="any"
                    min="0"
                  />
                </div>
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
                Processing...
              </div>
            ) : (
              <>
                {isLongSide ? (
                  <TrendingUp className="h-4 w-4 mr-2" />
                ) : (
                  <TrendingDown className="h-4 w-4 mr-2" />
                )}
                {isLongSide ? "Place Long" : "Place Short"} Order
              </>
            )}
          </Button>
        </form>
      </CardContent>
      {pendingSimTrade && (
        <SimulatedSignModal
          open={simModalOpen}
          onOpenChange={setSimModalOpen}
          onApprove={confirmSimulatedSign}
          onReject={cancelSimulatedSign}
          payerPubkey={pendingSimTrade.payer}
          recipientPubkey={pendingSimTrade.recipient}
          marketSymbol={pendingSimTrade.marketSymbol}
          side={pendingSimTrade.side}
          size={pendingSimTrade.size}
          sizeType={pendingSimTrade.sizeType}
          feeLamports={pendingSimTrade.feeLamports}
          feeSol={pendingSimTrade.feeSol}
          oraclePriceUsd={pendingSimTrade.oraclePriceUsd}
        />
      )}
    </Card>
  );
}