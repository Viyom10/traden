"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";

interface ClaimFeesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claimableAmount: number;
  onClaim: (publicKey: string, amount: string, amountInLamports: string) => void;
  isSubmitting: boolean;
  error: string | null;
}

export function ClaimFeesDialog({
  open,
  onOpenChange,
  claimableAmount,
  onClaim,
  isSubmitting,
  error,
}: ClaimFeesDialogProps) {
  const [publicKey, setPublicKey] = useState("");
  const [claimAmount, setClaimAmount] = useState("");
  const [validationError, setValidationError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");
    
    if (!publicKey.trim()) {
      setValidationError("Please enter a wallet address");
      return;
    }
    
    if (!claimAmount.trim()) {
      setValidationError("Please enter an amount to claim");
      return;
    }
    
    const amount = parseFloat(claimAmount);
    
    if (isNaN(amount) || amount <= 0) {
      setValidationError("Please enter a valid amount greater than 0");
      return;
    }
    
    if (amount > claimableAmount) {
      setValidationError(`Amount cannot exceed claimable balance of ${claimableAmount.toFixed(9)} SOL`);
      return;
    }
    
    // Convert SOL to lamports
    const amountInLamports = Math.floor(amount * 1_000_000_000).toString();
    
    onClaim(
      publicKey.trim(),
      claimAmount,
      amountInLamports
    );
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setPublicKey("");
      setClaimAmount("");
      setValidationError("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Claim Fees</DialogTitle>
          <DialogDescription className="text-gray-400">
            Enter your Solana wallet address to claim your earned fees.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="claimAmount" className="text-gray-200">
              Amount to Claim (SOL)
            </Label>
            <Input
              id="claimAmount"
              type="number"
              step="0.000000001"
              min="0"
              max={claimableAmount}
              placeholder="Enter amount in SOL"
              value={claimAmount}
              onChange={(e) => {
                setClaimAmount(e.target.value);
                setValidationError("");
              }}
              disabled={isSubmitting}
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              required
            />
            <p className="text-xs text-gray-400">
              Maximum claimable: {claimableAmount.toFixed(9)} SOL
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="publicKey" className="text-gray-200">
              Wallet Public Key
            </Label>
            <Input
              id="publicKey"
              type="text"
              placeholder="Enter your Solana wallet address"
              value={publicKey}
              onChange={(e) => {
                setPublicKey(e.target.value);
                setValidationError("");
              }}
              disabled={isSubmitting}
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              required
            />
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm text-gray-400">
                  Fees will be sent to your wallet within the next 12 hours.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-yellow-400">⚠️ Important Warning</p>
                <p className="text-sm text-yellow-300">
                  Please ensure you are entering the correct wallet address. Once fees are transferred to a wallet, the transaction cannot be reverted.
                </p>
              </div>
            </div>
          </div>

          {(error || validationError) && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-400">{validationError || error}</p>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="border-gray-700 bg-gray-800 hover:bg-gray-700 text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting || 
                !publicKey.trim() || 
                !claimAmount.trim() ||
                parseFloat(claimAmount) <= 0 ||
                parseFloat(claimAmount) > claimableAmount
              }
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Claim"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
