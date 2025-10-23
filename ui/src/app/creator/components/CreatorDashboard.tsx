"use client";

import { useState } from "react";
import { useCreatorFees } from "@/hooks/creator/useCreatorFees";
import { useFeeClaims } from "@/hooks/creator/useFeeClaims";
import { useCreatorSignals } from "@/hooks/creator/useCreatorSignals";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Radio } from "lucide-react";
import { ClaimFeesDialog } from "./ClaimFeesDialog";
import { FeeClaimHistoryTable } from "./FeeClaimHistoryTable";
import { CreateSignalForm } from "@/components/creator/CreateSignalForm";
import { ActiveSignalsTable } from "@/components/creator/ActiveSignalsTable";
import { toast } from "sonner";
import { useDriftStore } from "@/stores/DriftStore";
import { useUserStore } from "@/stores/UserStore";

export function CreatorDashboard() {
  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"fees" | "signals">("fees");
  
  const experienceId = useUserStore((s) => s.experienceId);
  const perpMarketConfigs = useDriftStore((s) => s.getPerpMarketConfigs());
  
  const { creatorFeesInSol, isLoading: isLoadingFees, error: feesError } = useCreatorFees();
  const {
    claims,
    claimableFeesInSol,
    totalClaimedInSol,
    isLoading: isLoadingClaims,
    error: claimsError,
    claimFees,
    isClaimingFees,
    claimError,
    cancelClaim,
    isCancellingClaim,
  } = useFeeClaims();

  const {
    signals,
    isLoading: isLoadingSignals,
    error: signalsError,
    cancelSignal,
    isCancelling: isCancellingSignal,
  } = useCreatorSignals(experienceId);

  const isLoading = isLoadingFees || isLoadingClaims || isLoadingSignals;
  const error = feesError || claimsError || signalsError;

  const handleClaimFees = (
    publicKey: string,
    amount: string,
    amountInLamports: string
  ) => {
    claimFees(
      {
        publicKey,
        claimedAmount: amount,
        claimedAmountInLamports: amountInLamports,
      },
      {
        onSuccess: () => {
          toast.success("Fee claim submitted successfully! Fees will be sent within 12 hours.");
          setIsClaimDialogOpen(false);
        },
        onError: () => {
          toast.error(claimError || "Failed to submit claim request");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 bg-red-900/20 border-red-800">
        <h3 className="text-lg font-semibold text-red-400 mb-2">Error Loading Fees</h3>
        <p className="text-red-300">{error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex bg-gray-800 rounded-lg p-1 max-w-md">
        <button
          type="button"
          onClick={() => setActiveTab("fees")}
          className={`flex-1 px-4 py-2 rounded text-sm font-medium transition-colors ${
            activeTab === "fees"
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Fee Management
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("signals")}
          className={`flex-1 px-4 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === "signals"
              ? "bg-purple-600 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Radio className="h-4 w-4" />
          Trade Signals
        </button>
      </div>

      {/* Fees Tab Content */}
      {activeTab === "fees" && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6 bg-gray-800/50 border-gray-700">
              <div className="flex flex-col">
                <span className="text-sm text-gray-400 mb-1">Total Fees Earned</span>
                <span className="text-3xl font-bold text-white">
                  {creatorFeesInSol.toFixed(9)} SOL
                </span>
              </div>
            </Card>
            
            <Card className="p-6 bg-gray-800/50 border-gray-700">
              <div className="flex flex-col">
                <span className="text-sm text-gray-400 mb-1">Total Claimable Fees</span>
                <span className="text-3xl font-bold text-white">
                  {claimableFeesInSol.toFixed(9)} SOL
                </span>
              </div>
            </Card>
            
            <Card className="p-6 bg-gray-800/50 border-gray-700">
              <div className="flex flex-col">
                <span className="text-sm text-gray-400 mb-1">Total Claimed</span>
                <span className="text-3xl font-bold text-white">
                  {totalClaimedInSol.toFixed(9)} SOL
                </span>
              </div>
            </Card>
          </div>

          {/* Claim Fees Button */}
          <div className="flex justify-center">
            <Button
              onClick={() => setIsClaimDialogOpen(true)}
              disabled={claimableFeesInSol <= 0}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg"
            >
              Claim Fees
            </Button>
          </div>

          {/* Fee Claim History */}
          <Card className="p-6 bg-gray-800/50 border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Fee Claim History</h2>
            <FeeClaimHistoryTable 
              claims={claims} 
              onCancelClaim={(claimId) => {
                cancelClaim(claimId, {
                  onSuccess: () => {
                    toast.success("Claim request cancelled successfully");
                  },
                  onError: () => {
                    toast.error("Failed to cancel claim request");
                  },
                });
              }}
              isCancelling={isCancellingClaim}
            />
          </Card>

          {/* Claim Fees Dialog */}
          <ClaimFeesDialog
            open={isClaimDialogOpen}
            onOpenChange={setIsClaimDialogOpen}
            claimableAmount={claimableFeesInSol}
            onClaim={handleClaimFees}
            isSubmitting={isClaimingFees}
            error={claimError}
          />
        </>
      )}

      {/* Signals Tab Content */}
      {activeTab === "signals" && (
        <>
          {/* Create Signal Form */}
          <CreateSignalForm
            perpMarketConfigs={perpMarketConfigs}
            experienceId={experienceId || ""}
          />

          {/* Active Signals */}
          <Card className="p-6 bg-gray-800/50 border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Active Signals</h2>
            <ActiveSignalsTable
              signals={signals}
              onCancelSignal={(signalId) => {
                cancelSignal(signalId, {
                  onSuccess: () => {
                    toast.success("Signal cancelled successfully");
                  },
                  onError: () => {
                    toast.error("Failed to cancel signal");
                  },
                });
              }}
              isCancelling={isCancellingSignal}
            />
          </Card>
        </>
      )}
    </div>
  );
}
