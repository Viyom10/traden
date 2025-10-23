"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Radio, TrendingUp, TrendingDown, Clock, Zap } from "lucide-react";
import { TradeSignalRecord, getTimeRemaining } from "@/lib/signalApi";
import { useSignalExecution } from "@/hooks/signals/useSignalExecution";

interface SignalCardProps {
  signal: TradeSignalRecord;
}

export const SignalCard = ({ signal }: SignalCardProps) => {
  const { executeSignal, isExecuting } = useSignalExecution();
  const [_currentTime, setCurrentTime] = useState(Date.now());
  const [isExpanded, setIsExpanded] = useState(false);

  // Update current time every second to refresh countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const timeRemaining = getTimeRemaining(signal.expiresAt);
  const isExpired = timeRemaining.total <= 0;
  const isLong = signal.direction === "LONG";

  const formatTimeRemaining = (): string => {
    if (isExpired) {
      return "Expired";
    }

    if (timeRemaining.days > 0) {
      return `${timeRemaining.days}d ${timeRemaining.hours}h`;
    }

    if (timeRemaining.hours > 0) {
      return `${timeRemaining.hours}h ${timeRemaining.minutes}m`;
    }

    return `${timeRemaining.minutes}m ${timeRemaining.seconds}s`;
  };

  const handleExecute = async () => {
    const success = await executeSignal(signal);
    if (success) {
      // Optionally refresh signals list or show additional feedback
    }
  };

  return (
    <Card className={`border-2 ${isExpired ? "border-gray-700 opacity-60" : isLong ? "border-green-600/30" : "border-red-600/30"} bg-gray-800/50`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className={`h-5 w-5 ${isLong ? "text-green-400" : "text-red-400"}`} />
            <span className="text-xl font-bold text-white">{signal.marketSymbol}</span>
            <div className="flex items-center gap-1">
              {isLong ? (
                <>
                  <TrendingUp className="h-5 w-5 text-green-400" />
                  <span className="text-green-400 font-semibold">LONG</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-5 w-5 text-red-400" />
                  <span className="text-red-400 font-semibold">SHORT</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className={`h-4 w-4 ${isExpired ? "text-red-400" : "text-yellow-400"}`} />
            <span className={`text-sm font-medium ${isExpired ? "text-red-400" : "text-yellow-400"}`}>
              {formatTimeRemaining()}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Trade Details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Order Type</p>
            <p className="text-white font-medium capitalize">{signal.orderType}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Leverage</p>
            <p className="text-white font-medium text-lg">
              {signal.leverageMultiplier}x
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Trade size = Your collateral × {signal.leverageMultiplier}
            </p>
          </div>
        </div>

        {/* Price Information */}
        {(signal.limitPrice || signal.triggerPrice || signal.oraclePriceOffset) && (
          <div className="grid grid-cols-2 gap-4">
            {signal.orderType === "limit" && signal.limitPrice && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Limit Price</p>
                <p className="text-white font-medium">${signal.limitPrice}</p>
              </div>
            )}
            {(signal.orderType === "takeProfit" || signal.orderType === "stopLoss") && signal.triggerPrice && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Trigger Price</p>
                <p className="text-white font-medium">${signal.triggerPrice}</p>
              </div>
            )}
            {signal.orderType === "oracleLimit" && signal.oraclePriceOffset && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Price Offset</p>
                <p className="text-white font-medium">${signal.oraclePriceOffset}</p>
              </div>
            )}
          </div>
        )}

        {/* TP/SL Information */}
        {(signal.takeProfitPercentage || signal.stopLossPercentage) && (
          <div className="pt-2 border-t border-gray-700">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-gray-400 hover:text-white transition-colors mb-2"
            >
              {isExpanded ? "Hide" : "Show"} TP/SL {isExpanded ? "▲" : "▼"}
            </button>
            {isExpanded && (
              <div className="grid grid-cols-2 gap-4">
                {signal.takeProfitPercentage && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Take Profit</p>
                    <p className="text-green-400 font-medium">+{signal.takeProfitPercentage}%</p>
                  </div>
                )}
                {signal.stopLossPercentage && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Stop Loss</p>
                    <p className="text-red-400 font-medium">-{signal.stopLossPercentage}%</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Order Flags */}
        {(signal.reduceOnly || signal.postOnly) && (
          <div className="flex gap-2">
            {signal.reduceOnly && (
              <span className="px-2 py-1 text-xs bg-orange-600/20 text-orange-400 rounded">
                Reduce Only
              </span>
            )}
            {signal.postOnly && (
              <span className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded">
                Post Only
              </span>
            )}
          </div>
        )}

        {/* Execute Button */}
        <Button
          onClick={handleExecute}
          disabled={isExpired || isExecuting}
          className={`w-full ${
            isLong
              ? "bg-green-600 hover:bg-green-700"
              : "bg-red-600 hover:bg-red-700"
          } ${isExpired ? "opacity-50 cursor-not-allowed" : ""}`}
          size="lg"
        >
          {isExecuting ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Executing...
            </div>
          ) : isExpired ? (
            "Signal Expired"
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Execute Trade
            </>
          )}
        </Button>

        {/* Created Date */}
        <p className="text-xs text-gray-500 text-center">
          Created {new Date(signal.createdAt).toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
};
