"use client";

import React, { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  Sheet,
  SheetContent,
} from "@/components/ui";
import { Wallet, Copy, Power, Repeat, X } from "lucide-react";
import { Button } from "@/components/ui";
import { useUserAccountDataStore } from "@/stores/UserAccountDataStore";
import { useSpotMarketConfigs } from "@/hooks/spot/useSpotMarketConfigs";
import { DepositDialog } from "./DepositDialog";
import { WithdrawDialog } from "./WithdrawDialog";

interface WalletSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WalletSidebar: React.FC<WalletSidebarProps> = ({ open, onOpenChange }) => {
  const { publicKey, disconnect, connected } = useWallet();
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"subaccounts" | "bridge">("subaccounts");

  const userAccountLookup = useUserAccountDataStore((s) => s.lookup);
  const currentAccount = useUserAccountDataStore((s) => s.getCurrentAccount());
  const spotMarketConfigs = useSpotMarketConfigs(currentAccount?.poolId);

  // Get user accounts for the connected wallet
  const userAccounts = useMemo(
    () =>
      Object.values(userAccountLookup).filter(
        (account) => account?.authority?.toBase58() === publicKey?.toBase58(),
      ),
    [userAccountLookup, publicKey],
  );

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const copyToClipboard = async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey.toString());
    }
  };

  const handleDisconnect = () => {
    disconnect();
    onOpenChange(false);
  };

  const totalBalance = currentAccount?.marginInfo?.netUsdValue?.toNotional() || "$0.00";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="bg-gray-900 border-gray-700 text-white p-0 w-[90%] sm:w-[30%] [&>button]:hidden">
          {/* Header with close button */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-blue-400" />
              <span className="font-semibold text-white text-sm">
                {publicKey ? shortenAddress(publicKey.toString()) : "Wallet"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copyToClipboard}
                className="p-2 hover:bg-gray-800 rounded-md transition-colors"
              >
                <Copy className="h-4 w-4 text-gray-400" />
              </button>
              <button
                onClick={() => onOpenChange(false)}
                className="p-2 hover:bg-gray-800 rounded-md transition-colors"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="flex flex-col h-[calc(100vh-73px)]">
            {!connected ? (
              <div className="flex flex-col items-center justify-center space-y-4 py-8 px-4 flex-1">
                <div className="rounded-full bg-gray-800 p-6">
                  <Wallet className="h-12 w-12 text-gray-400" />
                </div>
                <p className="text-gray-400 text-center text-sm">
                  Connect your wallet to access the full features of the app
                </p>
                <div className="w-full">
                  <WalletMultiButton className="!w-full !rounded-lg !text-white !h-12 !px-4 !font-medium !transition-colors !bg-blue-600 hover:!bg-blue-700" />
                </div>
              </div>
            ) : (
              <>
                {/* Account Info and Balance */}
                <div className="p-4 space-y-4">
                  {/* Account Selector */}
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                        <span className="text-white text-sm font-bold">
                          {currentAccount?.name?.charAt(0) || "M"}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {currentAccount?.name || "Main Account"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {currentAccount ? `#${currentAccount.subAccountId}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                      <Repeat className="h-4 w-4 text-white" />
                    </div>
                  </div>

                  {/* Balance Display */}
                  <div className="text-center py-6">
                    <p className="text-3xl font-bold text-white mb-1">
                      {totalBalance}
                    </p>
                    <p className="text-sm text-gray-400">Total Balance</p>
                  </div>

                  {/* Deposit and Withdraw Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        setDepositDialogOpen(true);
                        onOpenChange(false);
                      }}
                      className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30 rounded-lg border border-purple-500/30 transition-all"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mb-2">
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m0 0l-4-4m4 4l4-4"
                          />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-white">Deposit</span>
                    </button>

                    <button
                      onClick={() => {
                        setWithdrawDialogOpen(true);
                        onOpenChange(false);
                      }}
                      className="flex flex-col items-center justify-center p-4 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-all"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center mb-2">
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 20V4m0 0l-4 4m4-4l4 4"
                          />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-white">Withdraw</span>
                    </button>
                  </div>
                </div>

                {/* Tabs for Subaccounts and Bridge */}
                <div className="border-t border-gray-700">
                  <div className="grid grid-cols-2 border-b border-gray-700">
                    <button
                      onClick={() => setActiveTab("subaccounts")}
                      className={`py-3 text-sm font-medium transition-colors ${
                        activeTab === "subaccounts"
                          ? "text-purple-400 border-b-2 border-purple-400"
                          : "text-gray-400 hover:text-gray-300"
                      }`}
                    >
                      Subaccounts
                    </button>
                    <button
                      onClick={() => setActiveTab("bridge")}
                      className={`py-3 text-sm font-medium transition-colors ${
                        activeTab === "bridge"
                          ? "text-purple-400 border-b-2 border-purple-400"
                          : "text-gray-400 hover:text-gray-300"
                      }`}
                    >
                      Bridge
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="p-4">
                    {activeTab === "subaccounts" ? (
                      userAccounts.length > 0 ? (
                        <div className="space-y-2">
                          {userAccounts.map((account) => (
                            <div
                              key={account.subAccountId}
                              className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                                    <span className="text-white text-xs font-bold">
                                      {account.name.charAt(0)}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-white">
                                      {account.name}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                      #{account.subAccountId}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium text-white">
                                    {account.marginInfo.netUsdValue.toNotional()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-gray-400 text-sm">
                            No subaccounts found. Create one in the User page.
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-400 text-sm">
                          Bridge functionality coming soon
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-auto border-t border-gray-700 p-4">
                  <Button
                    onClick={handleDisconnect}
                    variant="outline"
                    className="w-full justify-start gap-2 bg-red-900/20 border-red-800 text-red-400 hover:bg-red-900/40"
                  >
                    <Power className="h-4 w-4" />
                    Disconnect
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialogs */}
      <DepositDialog
        open={depositDialogOpen}
        onOpenChange={setDepositDialogOpen}
        spotMarketConfigs={spotMarketConfigs}
        userAccounts={userAccounts}
      />
      <WithdrawDialog
        open={withdrawDialogOpen}
        onOpenChange={setWithdrawDialogOpen}
        spotMarketConfigs={spotMarketConfigs}
        userAccounts={userAccounts}
      />
    </>
  );
};

export default WalletSidebar;
