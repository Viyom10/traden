"use client";

import React, { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { AlertCircle, Settings, ShieldAlert, TrendingUp, DollarSign, Calendar, Clock, FileText, History } from "lucide-react";
import { useDriftStore } from "@/stores/DriftStore";
import { createRevenueShareAccountTxn } from "@drift-labs/common";
import { toast } from "sonner";
import { fetchRevenueShareAccount, RevenueShareAccount } from "@drift-labs/sdk";
import { useAdminStats } from "@/hooks/admin/useAdminStats";
import { useAdminClaims } from "@/hooks/admin/useAdminClaims";
import { PendingClaimsTable } from "./components/PendingClaimsTable";
import { PaymentHistoryTable } from "./components/PaymentHistoryTable";

const ADMIN_WALLET_ADDRESS = "6iUM9jw4qFYWdqGX5f9Bg6H674sGeFgUbAXcTLo7FXmz";

/**
 * This creates a RevenueShareAccount for the connected user, and its different from the environment-set builder authority.
 */
export default function AdminPage() {
  const { connected, publicKey } = useWallet();
  const drift = useDriftStore((s) => s.drift);
  const [isCreating, setIsCreating] = useState(false);
  const [revenueShareAccount, setRevenueShareAccount] = useState<
    RevenueShareAccount | undefined
  >(undefined);
  const { totalStats, todayStats, weekStats, monthStats, isLoading: isLoadingStats } = useAdminStats();
  
  // Fee claims management
  const [historyPage, setHistoryPage] = useState(1);
  const { 
    claims: pendingClaims, 
    isLoading: isLoadingPending, 
    updateClaim,
    isUpdating 
  } = useAdminClaims("pending", 1, 100); // Get all pending claims
  
  const { 
    claims: completedClaims, 
    pagination: historyPagination,
    isLoading: isLoadingHistory 
  } = useAdminClaims("completed", historyPage, 10);

  // Check if the connected wallet is authorized
  const isAuthorized = publicKey?.toBase58() === ADMIN_WALLET_ADDRESS;

  const handlePaymentUpdate = (claimId: string, status: string, txSignature?: string) => {
    updateClaim(
      { claimId, status, txSignature },
      {
        onSuccess: () => {
          toast.success("Payment confirmed successfully!");
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Failed to update claim");
        },
      }
    );
  };

  useEffect(() => {
    if (
      publicKey &&
      drift?.driftClient?.connection &&
      drift?.driftClient?.program
    ) {
      fetchRevenueShareAccount(
        drift.driftClient.connection,
        drift.driftClient.program,
        publicKey,
      ).then((account) => setRevenueShareAccount(account ?? undefined));
    }
  }, [publicKey, drift?.driftClient]);

  const handleCreateRevenueShareAccount = async () => {
    if (!connected || !drift?.driftClient || !publicKey) {
      toast.error("Wallet Not Connected", {
        description: "Please connect your wallet first",
        duration: 4000,
      });
      return;
    }

    setIsCreating(true);

    try {
      const driftClient = drift.driftClient;

      toast.loading("Creating RevenueShare Account", {
        description: "Please confirm the transaction in your wallet",
      });

      // Create the transaction
      const tx = await createRevenueShareAccountTxn({
        driftClient,
        authority: publicKey,
        txParams: drift.getTxParams(),
      });

      // Send and confirm transaction
      const signature = await drift.driftClient.sendTransaction(tx);

      toast.success("RevenueShare Account Created", {
        description: `Transaction: ${signature.txSig.slice(
          0,
          8,
        )}...${signature.txSig.slice(-8)}`,
        duration: 6000,
      });

      const account = await fetchRevenueShareAccount(
        drift.driftClient.connection,
        drift.driftClient.program,
        publicKey,
      );

      setRevenueShareAccount(account ?? undefined);
    } catch (error) {
      console.error("Failed to create RevenueShare account:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast.error("Failed to Create Account", {
        description: errorMessage,
        duration: 6000,
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Unauthorized access - user is not the admin
  if (connected && !isAuthorized) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card className="border-red-600/20 bg-red-600/5">
            <CardHeader>
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-6 w-6 text-red-400" />
                <CardTitle className="text-red-400">Access Denied</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <ShieldAlert className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  Unauthorized Access
                </h3>
                <p className="text-gray-400 mb-4">
                  You do not have permission to access the admin panel.
                </p>
                <p className="text-sm text-gray-500 font-mono">
                  Connected: {publicKey?.toBase58()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Wallet not connected
  if (!connected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Settings className="h-6 w-6 text-blue-400" />
                <CardTitle>Builder Admin Panel</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  Wallet Not Connected
                </h3>
                <p className="text-gray-400">
                  Please connect your wallet to access builder administration
                  features.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="h-8 w-8 text-blue-400" />
            <h1 className="text-3xl font-bold text-white">
              Builder Admin Panel
            </h1>
          </div>
          <p className="text-gray-400">
            Platform fee statistics and RevenueShare account management.
          </p>
        </div>

        <div className="space-y-6">
          {/* Fee Statistics Section */}
          <div>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-green-400" />
              Platform Fee Statistics
            </h2>
            
            {isLoadingStats ? (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-gray-400">
                    Loading statistics...
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Total Fees */}
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-purple-400" />
                      <CardTitle className="text-sm font-medium text-gray-300">
                        Total Fees (All Time)
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold text-white">
                        {totalStats?.platformShareInSol.toFixed(9) || "0.000000000"} SOL
                      </p>
                      <p className="text-xs text-gray-400">
                        {totalStats?.transactionCount || 0} transactions
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Today's Fees */}
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-400" />
                      <CardTitle className="text-sm font-medium text-gray-300">
                        Today&apos;s Fees
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold text-white">
                        {todayStats?.platformShareInSol.toFixed(9) || "0.000000000"} SOL
                      </p>
                      <p className="text-xs text-gray-400">
                        {todayStats?.transactionCount || 0} transactions
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* This Week's Fees */}
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-green-400" />
                      <CardTitle className="text-sm font-medium text-gray-300">
                        This Week&apos;s Fees
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold text-white">
                        {weekStats?.platformShareInSol.toFixed(9) || "0.000000000"} SOL
                      </p>
                      <p className="text-xs text-gray-400">
                        {weekStats?.transactionCount || 0} transactions
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* This Month's Fees */}
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-yellow-400" />
                      <CardTitle className="text-sm font-medium text-gray-300">
                        This Month&apos;s Fees
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold text-white">
                        {monthStats?.platformShareInSol.toFixed(9) || "0.000000000"} SOL
                      </p>
                      <p className="text-xs text-gray-400">
                        {monthStats?.transactionCount || 0} transactions
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card className="bg-blue-900/20 border-blue-700/30">
              <CardContent className="py-4">
                <p className="text-sm text-blue-300">
                  <strong>Note:</strong> These figures represent 50% of total fees generated. The other 50% goes to creators (experience owners).
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Share Section Divider */}
          <div className="border-t border-gray-700 my-8"></div>
          
          <div>
            <h2 className="text-xl font-bold text-white mb-4">
              RevenueShare Account Management
            </h2>
          </div>
          {/* Connected Wallet Info */}
          <Card>
            <CardHeader>
              <CardTitle>Builder Authority</CardTitle>
              <CardDescription>
                Your wallet address will be used as the builder authority
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Wallet Address</p>
                <p className="font-mono text-white break-all">
                  {publicKey?.toBase58()}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* RevenueShare Account Status */}
          {revenueShareAccount ? (
            <Card className="border-green-600/20 bg-green-600/5">
              <CardHeader>
                <CardTitle className="text-green-400">
                  RevenueShare Account Active
                </CardTitle>
                <CardDescription>
                  Your account is set up and ready to receive builder fees
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Authority</p>
                      <p className="font-mono text-white break-all">
                        {revenueShareAccount.authority.toBase58()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">
                        Total Builder Rewards
                      </p>
                      <p className="text-2xl font-bold text-green-400">
                        {(
                          revenueShareAccount.totalBuilderRewards.toNumber() /
                          1_000_000
                        ).toFixed(6)}{" "}
                        USDC
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">
                        Total Referrer Rewards
                      </p>
                      <p className="text-xl font-semibold text-blue-400">
                        {(
                          revenueShareAccount.totalReferrerRewards.toNumber() /
                          1_000_000
                        ).toFixed(6)}{" "}
                        USDC
                      </p>
                    </div>
                  </div>

                  <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-blue-400 mb-2">
                      Account Information
                    </h4>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>
                        • Your account tracks fees earned from user trades
                      </li>
                      <li>
                        • Users can add you to their approved builders list
                      </li>
                      <li>• Fees are accumulated and can be claimed later</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Initialize RevenueShare Account</CardTitle>
                <CardDescription>
                  Create your RevenueShare account to start earning fees
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-blue-400 mb-2">
                      What is a RevenueShare Account?
                    </h4>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>• Tracks total fees earned from user trades</li>
                      <li>
                        • One-time setup required before users can approve you
                      </li>
                      <li>
                        • Owned by your wallet (builder authority address)
                      </li>
                      <li>• Required to receive builder code revenue</li>
                    </ul>
                  </div>

                  <Button
                    onClick={handleCreateRevenueShareAccount}
                    disabled={isCreating || !drift}
                    className="w-full"
                  >
                    {isCreating
                      ? "Creating Account..."
                      : "Create RevenueShare Account"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Help Section */}
          <Card>
            <CardHeader>
              <CardTitle>
                {revenueShareAccount ? "How It Works" : "Next Steps"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-gray-400">
                {!revenueShareAccount && (
                  <p>
                    1. Create your RevenueShare account using the button above
                  </p>
                )}
                <p>
                  {revenueShareAccount ? "1" : "2"}. Share your builder
                  authority address (wallet address) with users
                </p>
                <p>
                  {revenueShareAccount ? "2" : "3"}. Users will add you to their
                  approved builders list with a max fee cap
                </p>
                <p>
                  {revenueShareAccount ? "3" : "4"}. When users place Swift
                  orders, you&apos;ll earn fees based on their settings
                </p>
                <p>
                  {revenueShareAccount ? "4" : "5"}. Fees accumulate in your
                  RevenueShare account and can be claimed later
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Fee Claims Section Divider */}
          <div className="border-t border-gray-700 my-8"></div>

          {/* Pending Claim Requests */}
          <div>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <FileText className="h-6 w-6 text-yellow-400" />
              Pending Fee Claim Requests
            </h2>
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle>Claims Awaiting Payment</CardTitle>
                <CardDescription>
                  Review and process creator fee claim requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPending ? (
                  <div className="text-center py-8 text-gray-400">
                    Loading pending claims...
                  </div>
                ) : (
                  <PendingClaimsTable
                    claims={pendingClaims}
                    onUpdateClaim={handlePaymentUpdate}
                    isUpdating={isUpdating}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment History */}
          <div>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <History className="h-6 w-6 text-blue-400" />
              Payment History
            </h2>
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle>Completed Payments</CardTitle>
                <CardDescription>
                  View all processed fee claim payments
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingHistory ? (
                  <div className="text-center py-8 text-gray-400">
                    Loading payment history...
                  </div>
                ) : (
                  <PaymentHistoryTable
                    claims={completedClaims}
                    pagination={historyPagination}
                    onPageChange={setHistoryPage}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
