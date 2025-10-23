"use client";

import React from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { SignalCard } from "@/components/signals/SignalCard";
import { useExperienceSignals } from "@/hooks/signals/useExperienceSignals";
import { useUserStore } from "@/stores/UserStore";
import { useWallet } from "@solana/wallet-adapter-react";
import { Radio, Loader2, AlertCircle, Wifi } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const WalletNotConnectedState = () => (
  <div className="container mx-auto px-4 py-8">
    <div className="max-w-6xl mx-auto flex justify-center">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Radio className="h-6 w-6 text-purple-400" />
            <CardTitle>Trade Signals</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              Wallet Not Connected
            </h3>
            <p className="text-gray-400">
              Please connect your Solana wallet to view and execute trade signals.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);

export default function SignalsPage() {
  const { connected } = useWallet();
  const experienceId = useUserStore((s) => s.experienceId);
  const { signals, isLoading, error } = useExperienceSignals(experienceId);

  if (!connected) {
    return (
      <PageLayout>
        <WalletNotConnectedState />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Radio className="h-8 w-8 text-purple-400" />
              <h1 className="text-3xl font-bold text-white">Trade Signals</h1>
            </div>
            <p className="text-gray-400">
              Execute trade signals from your creator. Click &quot;Execute Trade&quot; to place the order instantly.
            </p>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-purple-500 mx-auto mb-4" />
                <p className="text-gray-400">Loading signals...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <Card className="bg-red-900/20 border-red-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
                  <div>
                    <h3 className="text-lg font-semibold text-red-400 mb-2">
                      Error Loading Signals
                    </h3>
                    <p className="text-red-300">{error}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!isLoading && !error && signals.length === 0 && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Wifi className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    No Active Signals
                  </h3>
                  <p className="text-gray-400">
                    There are currently no active trade signals. Check back later or contact your creator.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Signals Grid */}
          {!isLoading && !error && signals.length > 0 && (
            <>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-gray-400">
                  {signals.length} active signal{signals.length !== 1 ? "s" : ""} available
                </p>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm text-gray-400">Live</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {signals.map((signal) => (
                  <SignalCard key={signal._id} signal={signal} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
