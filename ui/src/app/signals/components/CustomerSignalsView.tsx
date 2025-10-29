"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  Radio, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  TrendingDown,
  Clock,
  Zap,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { useUserStore } from "@/stores/UserStore";
import { useSignalExecution } from "@/hooks/signals/useSignalExecution";
import { useUserAccountDataStore } from "@/stores/UserAccountDataStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Signal {
  _id: string;
  marketSymbol: string;
  marketIndex: number;
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
  createdAt: string;
  isActive: boolean;
}

export function CustomerSignalsView() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [showExecuteDialog, setShowExecuteDialog] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [calculatedParams, setCalculatedParams] = useState<any>(null);
  const experienceId = useUserStore((s) => s.experienceId);
  const currentAccount = useUserAccountDataStore((s) => s.getCurrentAccount());
  const { executeSignal, isExecuting, calculateOrderParameters } = useSignalExecution();

  const fetchSignals = async () => {
    if (!experienceId) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/signal?experienceId=${experienceId}&includeExpired=false`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch signals");
      }

      const data = await response.json();
      setSignals(data.signals);
    } catch (error) {
      console.error("Error fetching signals:", error);
      toast.error("Failed to load signals");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
    // Refresh signals every 30 seconds
    const interval = setInterval(fetchSignals, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experienceId]);

  const handleExecuteClick = (signal: Signal) => {
    try {
      const params = calculateOrderParameters(signal);
      setCalculatedParams(params);
      setSelectedSignal(signal);
      setShowExecuteDialog(true);
    } catch (error) {
      toast.error("Calculation Failed", {
        description: error instanceof Error ? error.message : "Failed to calculate order parameters",
        duration: 4000,
      });
    }
  };

  const handleConfirmExecute = async () => {
    if (!selectedSignal) return;

    const success = await executeSignal(selectedSignal);
    if (success) {
      setShowExecuteDialog(false);
      setSelectedSignal(null);
      setCalculatedParams(null);
      // Refresh signals after execution
      fetchSignals();
    }
  };

  const isExpired = (expiryTime: string) => {
    return new Date(expiryTime) < new Date();
  };

  const getTimeRemaining = (expiryTime: string) => {
    const now = new Date();
    const expiry = new Date(expiryTime);
    const diff = expiry.getTime() - now.getTime();

    if (diff <= 0) return "Expired";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const accountBalance = currentAccount?.marginInfo?.netUsdValue?.toNum() || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!experienceId) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-12">
          <div className="text-center">
            <Info className="h-16 w-16 mx-auto mb-4 text-gray-500 opacity-50" />
            <p className="text-gray-400 text-lg">No experience detected</p>
            <p className="text-gray-500 text-sm mt-2">
              Please access this page through your Whop experience
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (signals.length === 0) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-12">
          <div className="text-center">
            <Radio className="h-16 w-16 mx-auto mb-4 text-gray-500 opacity-50" />
            <p className="text-gray-400 text-lg">No active signals</p>
            <p className="text-gray-500 text-sm mt-2">
              Your creator hasn&apos;t shared any trading signals yet
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Account Balance Info */}
        {accountBalance > 0 && (
          <Card className="bg-blue-600/10 border-blue-600/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Your Account Balance</p>
                  <p className="text-2xl font-bold text-white">
                    ${accountBalance.toFixed(2)}
                  </p>
                </div>
                <Info className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Signals List */}
        <div className="grid gap-4">
          {signals.map((signal) => {
            const expired = isExpired(signal.expiryTime);
            const isLong = signal.direction === "LONG";
            const timeRemaining = getTimeRemaining(signal.expiryTime);

            return (
              <Card
                key={signal._id}
                className={`${
                  expired
                    ? "bg-gray-800/30 border-gray-700 opacity-60"
                    : "bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-colors"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {isLong ? (
                        <TrendingUp className="h-6 w-6 text-green-400" />
                      ) : (
                        <TrendingDown className="h-6 w-6 text-red-400" />
                      )}
                      <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                          <span>{signal.marketSymbol}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              isLong
                                ? "bg-green-600/20 text-green-400"
                                : "bg-red-600/20 text-red-400"
                            }`}
                          >
                            {signal.direction}
                          </span>
                        </CardTitle>
                        <p className="text-sm text-gray-400 mt-1">
                          {signal.orderType.toUpperCase()} Order
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {expired ? (
                        <div className="flex items-center gap-1 text-red-400">
                          <XCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">Expired</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-green-400">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">Active</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Signal Details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Leverage:</span>
                      <span className="text-white ml-1 font-medium">
                        {signal.leverageMultiplier}x
                      </span>
                    </div>
                    {signal.takeProfitPercentage && (
                      <div>
                        <span className="text-gray-400">Take Profit:</span>
                        <span className="text-green-400 ml-1 font-medium">
                          +{signal.takeProfitPercentage}%
                        </span>
                      </div>
                    )}
                    {signal.stopLossPercentage && (
                      <div>
                        <span className="text-gray-400">Stop Loss:</span>
                        <span className="text-red-400 ml-1 font-medium">
                          -{signal.stopLossPercentage}%
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-gray-400" />
                      <span className="text-gray-400">Expires:</span>
                      <span
                        className={`ml-1 font-medium ${
                          expired ? "text-red-400" : "text-yellow-400"
                        }`}
                      >
                        {timeRemaining}
                      </span>
                    </div>
                  </div>

                  {/* Additional Info */}
                  {(signal.limitPricePercentage !== undefined ||
                    signal.triggerPricePercentage !== undefined) && (
                    <div className="text-xs text-gray-500 space-y-1 border-t border-gray-700 pt-3">
                      {signal.limitPricePercentage !== undefined && (
                        <div>
                          Price Offset: {signal.limitPricePercentage > 0 ? "+" : ""}
                          {signal.limitPricePercentage}% from current
                        </div>
                      )}
                      {signal.triggerPricePercentage !== undefined && (
                        <div>
                          Trigger Offset: {signal.triggerPricePercentage > 0 ? "+" : ""}
                          {signal.triggerPricePercentage}% from current
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="pt-2">
                    <Button
                      onClick={() => handleExecuteClick(signal)}
                      disabled={expired || accountBalance === 0}
                      className={`w-full ${
                        isLong
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-red-600 hover:bg-red-700"
                      }`}
                      size="lg"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Execute Signal
                    </Button>
                    {accountBalance === 0 && (
                      <p className="text-xs text-yellow-400 mt-2 text-center">
                        Please deposit funds to execute signals
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Execute Confirmation Dialog */}
      <Dialog open={showExecuteDialog} onOpenChange={setShowExecuteDialog}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              Confirm Signal Execution
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Review the calculated parameters before executing this trade
            </DialogDescription>
          </DialogHeader>

          {selectedSignal && calculatedParams && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Market:</span>
                  <div className="text-white font-medium">
                    {selectedSignal.marketSymbol}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Direction:</span>
                  <div
                    className={`font-medium ${
                      selectedSignal.direction === "LONG"
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {selectedSignal.direction}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Position Size:</span>
                  <div className="text-white font-medium">
                    {calculatedParams.baseSize.prettyPrint()}{" "}
                    {calculatedParams.marketConfig.baseAssetSymbol}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Notional Value:</span>
                  <div className="text-white font-medium">
                    ${calculatedParams.positionSizeUSDC.toFixed(2)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Current Price:</span>
                  <div className="text-white font-medium">
                    ${calculatedParams.currentPrice.toFixed(2)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Leverage:</span>
                  <div className="text-white font-medium">
                    {selectedSignal.leverageMultiplier}x
                  </div>
                </div>
              </div>

              {(calculatedParams.takeProfitPrice || calculatedParams.stopLossPrice) && (
                <div className="border-t border-gray-700 pt-4 space-y-2">
                  {calculatedParams.takeProfitPrice && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Take Profit Price:</span>
                      <span className="text-green-400 font-medium">
                        ${calculatedParams.takeProfitPrice.toNum().toFixed(2)}
                      </span>
                    </div>
                  )}
                  {calculatedParams.stopLossPrice && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Stop Loss Price:</span>
                      <span className="text-red-400 font-medium">
                        ${calculatedParams.stopLossPrice.toNum().toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowExecuteDialog(false);
                setSelectedSignal(null);
                setCalculatedParams(null);
              }}
              disabled={isExecuting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmExecute}
              disabled={isExecuting}
              className={`${
                selectedSignal?.direction === "LONG"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {isExecuting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Confirm & Execute
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
