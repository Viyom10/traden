"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Radio, Trash2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useUserStore } from "@/stores/UserStore";

interface Signal {
  _id: string;
  marketSymbol: string;
  orderType: string;
  direction: string;
  leverageMultiplier: number;
  takeProfitPercentage?: number;
  stopLossPercentage?: number;
  expiryTime: string;
  createdAt: string;
  isActive: boolean;
}

export function SignalsList() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingSignalId, setDeletingSignalId] = useState<string | null>(null);
  const experienceId = useUserStore((s) => s.experienceId);

  const fetchSignals = async () => {
    if (!experienceId) return;

    try {
      const response = await fetch(
        `/api/signal?experienceId=${experienceId}&includeExpired=true`
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

  const handleDeleteSignal = async (signalId: string) => {
    setDeletingSignalId(signalId);

    try {
      const response = await fetch(`/api/signal?signalId=${signalId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete signal");
      }

      toast.success("Signal deleted successfully");
      fetchSignals();
    } catch (error) {
      console.error("Error deleting signal:", error);
      toast.error("Failed to delete signal");
    } finally {
      setDeletingSignalId(null);
    }
  };

  const isExpired = (expiryTime: string) => {
    return new Date(expiryTime) < new Date();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (signals.length === 0) {
    return (
      <div className="text-center py-12">
        <Radio className="h-16 w-16 mx-auto mb-4 text-gray-500 opacity-50" />
        <p className="text-gray-400 text-lg">No signals created yet</p>
        <p className="text-gray-500 text-sm mt-2">
          Create your first signal to share with your customers
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Your Signals</h3>
        <Button
          onClick={fetchSignals}
          variant="outline"
          size="sm"
          className="text-gray-300"
        >
          Refresh
        </Button>
      </div>

      <div className="grid gap-4">
        {signals.map((signal) => {
          const expired = isExpired(signal.expiryTime);
          const isLong = signal.direction === "LONG";

          return (
            <Card
              key={signal._id}
              className={`p-4 ${
                expired
                  ? "bg-gray-800/30 border-gray-700 opacity-60"
                  : "bg-gray-800/50 border-gray-700"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  {/* Header */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        isLong
                          ? "bg-green-600/20 text-green-400"
                          : "bg-red-600/20 text-red-400"
                      }`}
                    >
                      {signal.direction}
                    </span>
                    <span className="text-white font-semibold">
                      {signal.marketSymbol}
                    </span>
                    <span className="text-gray-400 text-sm">
                      ({signal.orderType.toUpperCase()})
                    </span>
                    {expired ? (
                      <XCircle className="h-4 w-4 text-red-400" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
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
                          {signal.takeProfitPercentage}%
                        </span>
                      </div>
                    )}
                    {signal.stopLossPercentage && (
                      <div>
                        <span className="text-gray-400">Stop Loss:</span>
                        <span className="text-red-400 ml-1 font-medium">
                          {signal.stopLossPercentage}%
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-400">Status:</span>
                      <span
                        className={`ml-1 font-medium ${
                          expired ? "text-red-400" : "text-green-400"
                        }`}
                      >
                        {expired ? "Expired" : "Active"}
                      </span>
                    </div>
                  </div>

                  {/* Times */}
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>
                      Created: {new Date(signal.createdAt).toLocaleString()}
                    </div>
                    <div>
                      Expires: {new Date(signal.expiryTime).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="ml-4">
                  <Button
                    onClick={() => handleDeleteSignal(signal._id)}
                    disabled={deletingSignalId === signal._id}
                    variant="outline"
                    size="sm"
                    className="text-red-400 hover:text-red-300 hover:bg-red-950/20"
                  >
                    {deletingSignalId === signal._id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
