"use client";

import { useState } from "react";
import { useCreatorFees } from "@/hooks/creator/useCreatorFees";
import { useFeeClaims } from "@/hooks/creator/useFeeClaims";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, DollarSign, Radio } from "lucide-react";
import { ClaimFeesDialog } from "./ClaimFeesDialog";
import { FeeClaimHistoryTable } from "./FeeClaimHistoryTable";
import { CreateSignal } from "@/components/creator/CreateSignal";
import { toast } from "sonner";

type TabType = "revenue" | "signals";

export function CreatorDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("revenue");
  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false);
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

  const isLoading = isLoadingFees || isLoadingClaims;
  const error = feesError || claimsError;

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

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex bg-gray-800 rounded-lg p-1">
        <button
          type="button"
          onClick={() => setActiveTab("revenue")}
          className={`flex-1 px-4 py-3 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === "revenue"
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <DollarSign className="h-4 w-4" />
          Revenue & Fees
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("signals")}
          className={`flex-1 px-4 py-3 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === "signals"
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Radio className="h-4 w-4" />
          Create Signals
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "revenue" ? (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : error ? (
            <Card className="p-6 bg-red-900/20 border-red-800">
              <h3 className="text-lg font-semibold text-red-400 mb-2">Error Loading Fees</h3>
              <p className="text-red-300">{error}</p>
            </Card>
          ) : (
            <div className="space-y-6">
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
            </div>
          )}
        </>
      ) : (
        <CreateSignal />
      )}
    </div>
  );
}
