"use client";

import React, { useState, useEffect } from "react";
import { SpotMarketConfig, BigNum } from "@drift-labs/sdk";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  FormInput,
  FormSelect,
} from "@/components/ui";
import { ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { handleErrorToast } from "@/utils/toastUtils";
import { useDriftStore } from "@/stores/DriftStore";
import { useUserAccountDataStore } from "@/stores/UserAccountDataStore";
import { EnhancedAccountData } from "@drift-labs/common";

interface WithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spotMarketConfigs: SpotMarketConfig[];
  userAccounts: EnhancedAccountData[];
}

export function WithdrawDialog({
  open,
  onOpenChange,
  spotMarketConfigs,
  userAccounts,
}: WithdrawDialogProps) {
  const drift = useDriftStore((s) => s.drift);
  const activeSubAccountId = useUserAccountDataStore(
    (s) => s.activeSubAccountId,
  );

  const [selectedMarketIndex, setSelectedMarketIndex] = useState(0);
  const [selectedSubAccountId, setSelectedSubAccountId] = useState<
    number | undefined
  >(activeSubAccountId);
  const [amount, setAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const selectedSpotMarketConfig = spotMarketConfigs.find(
    (marketConfig) => marketConfig.marketIndex === selectedMarketIndex,
  );
  const selectedSpotMarketSymbol = selectedSpotMarketConfig?.symbol ?? "";

  useEffect(() => {
    if (userAccounts.length > 0 && selectedSubAccountId === undefined) {
      setSelectedSubAccountId(userAccounts[0].subAccountId);
    }
  }, [activeSubAccountId, userAccounts, selectedSubAccountId]);

  useEffect(() => {
    const account = userAccounts.find(
      (account) => account.subAccountId === selectedSubAccountId,
    );
    if (account) {
      const spotBalance = account.spotBalances.find((spotBalance) => {
        return spotBalance.marketIndex === selectedMarketIndex;
      });
      if (spotBalance) {
        setMaxAmount(spotBalance.baseBalance.toNum().toString());
      } else {
        setMaxAmount("0");
      }
    } else {
      setMaxAmount("0");
    }
  }, [selectedMarketIndex, selectedSubAccountId, userAccounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drift || !selectedSpotMarketConfig || selectedSubAccountId === undefined)
      return;

    setIsLoading(true);

    try {
      const amountBigNum = BigNum.fromPrint(
        amount,
        selectedSpotMarketConfig.precisionExp,
      );

      await drift.withdraw({
        subAccountId: selectedSubAccountId,
        amount: amountBigNum,
        spotMarketIndex: selectedMarketIndex,
        isBorrow: false,
        isMax: false,
      });

      toast.success(
        `Successfully withdrawn ${amount} ${selectedSpotMarketSymbol}`,
      );
      setAmount("");
      onOpenChange(false);
    } catch (error) {
      handleErrorToast(error, "Failed to withdraw. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaxAmount = () => {
    setAmount(maxAmount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <ArrowDown className="h-5 w-5 text-red-400" />
            Withdraw Funds
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Transfer tokens from your Drift account to your wallet
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <FormSelect
            label="Token"
            value={selectedMarketIndex.toString()}
            onValueChange={(value) => setSelectedMarketIndex(Number(value))}
            required
            options={spotMarketConfigs.map((marketConfig) => ({
              value: marketConfig.marketIndex.toString(),
              label: `${marketConfig.symbol}`,
            }))}
          />

          {userAccounts.length > 0 ? (
            <FormSelect
              label="Subaccount"
              value={selectedSubAccountId?.toString() || ""}
              onValueChange={(value) => setSelectedSubAccountId(Number(value))}
              required
              options={userAccounts.map((account) => ({
                value: account.subAccountId.toString(),
                label: `${account.name} (#${account.subAccountId})${
                  activeSubAccountId === account.subAccountId ? " (Active)" : ""
                }`,
              }))}
            />
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-200">
                Subaccount <span className="text-red-400 ml-1">*</span>
              </label>
              <div className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-gray-400">
                No subaccounts available - create one in User page
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-200">Amount</label>
            <div className="relative">
              <FormInput
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="any"
                min="0"
                required
                className="pr-16"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleMaxAmount}
                className="absolute right-1 top-1 h-8 px-2 text-xs"
              >
                MAX
              </Button>
            </div>
            <p className="text-xs text-gray-400">
              Available: {maxAmount} {selectedSpotMarketSymbol}
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-red-600 hover:bg-red-700"
              disabled={
                !amount ||
                isLoading ||
                selectedSubAccountId === undefined ||
                userAccounts.length === 0
              }
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Processing...
                </div>
              ) : (
                <>Withdraw</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
