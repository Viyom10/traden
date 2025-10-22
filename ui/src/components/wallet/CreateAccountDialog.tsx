"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { handleErrorToast } from "@/utils/toastUtils";
import { SpotMarketConfig } from "@drift-labs/sdk";

interface CreateAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spotMarketConfigs: SpotMarketConfig[];
  onSubmit: (params: {
    selectedMarketIndex: number;
    amount: string;
  }) => Promise<void>;
  isNewSubaccount?: boolean;
}

export const CreateAccountDialog = ({
  open,
  onOpenChange,
  spotMarketConfigs,
  onSubmit,
  isNewSubaccount = false,
}: CreateAccountDialogProps) => {
  const [selectedMarketIndex, setSelectedMarketIndex] = useState(0);
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const selectedSpotMarketConfig = spotMarketConfigs.find(
    (marketConfig) => marketConfig.marketIndex === selectedMarketIndex,
  );
  const selectedSpotMarketSymbol = selectedSpotMarketConfig?.symbol ?? "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);

    try {
      await onSubmit({ selectedMarketIndex, amount });

      toast.success(
        `Successfully ${isNewSubaccount ? "created subaccount" : "created account"} and deposited ${amount} ${selectedSpotMarketSymbol}`,
      );
      setAmount("");
      onOpenChange(false);
    } catch (error) {
      handleErrorToast(
        error,
        `Failed to ${isNewSubaccount ? "create subaccount" : "create account"} and deposit. Please try again.`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-blue-400" />
            {isNewSubaccount ? "Create New Subaccount & Deposit" : "Create Account & Deposit"}
          </DialogTitle>
          <DialogDescription>
            {isNewSubaccount
              ? "Create a new subaccount and deposit funds to start trading."
              : "Create your first Drift account and deposit funds to start trading."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-4">
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

            <FormInput
              type="number"
              label="Amount"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="any"
              min="0"
              required
              helperText={`Deposit ${selectedSpotMarketSymbol} to your ${isNewSubaccount ? "new subaccount" : "new Drift account"}`}
            />
          </div>

          {selectedSpotMarketSymbol && (
            <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Plus className="h-5 w-5 text-blue-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-400 mb-1">
                    Requirements
                  </h4>
                  <div className="text-sm text-gray-300 space-y-1">
                    <p>• Your wallet must have at least 0.035 SOL</p>
                    <p>• You must deposit at least $5</p>
                    <p>• The 0.035 SOL will be refunded instantly when you delete your account</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!amount || isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Creating...
                </div>
              ) : (
                `Create & Deposit ${amount || "0"} ${selectedSpotMarketSymbol}`
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
