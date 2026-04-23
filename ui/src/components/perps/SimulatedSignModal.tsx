"use client";

/**
 * Phantom-style "approve transaction" modal used when the live Drift
 * connection is unavailable. Shows BOTH the System.transfer (fee) and the
 * Drift PlacePerpOrder (trade) instructions inside a single signature
 * request — visually demonstrating the atomic-fee enforcement contract.
 */

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  ArrowDownUp,
  TrendingUp,
  TrendingDown,
  Lock,
  KeyRound,
  Sparkles,
} from "lucide-react";

export interface SimulatedSignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: () => void;
  onReject: () => void;
  payerPubkey: string;
  recipientPubkey: string;
  marketSymbol: string;
  side: "long" | "short";
  size: string;
  sizeType: "base" | "quote";
  feeLamports: string;
  feeSol: string;
  oraclePriceUsd: number;
}

function shortKey(s: string): string {
  if (s.length <= 12) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export function SimulatedSignModal(props: SimulatedSignModalProps) {
  const {
    open,
    onOpenChange,
    onApprove,
    onReject,
    payerPubkey,
    recipientPubkey,
    marketSymbol,
    side,
    size,
    sizeType,
    feeLamports,
    feeSol,
    oraclePriceUsd,
  } = props;

  const isLong = side === "long";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-purple-500/30 bg-gradient-to-b from-[#1a1330] to-[#0d0820] p-0 text-white">
        <div className="border-b border-white/10 px-5 py-4">
          <DialogHeader>
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-purple-500 to-indigo-600">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-semibold tracking-wide">
                  Phantom
                </span>
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-300">
                  devnet
                </span>
              </div>
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Demo
              </span>
            </div>
            <DialogTitle className="text-base font-semibold text-white">
              Approve Transaction
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400">
              You are about to sign{" "}
              <span className="font-semibold text-white">one</span> Solana
              transaction containing{" "}
              <span className="font-semibold text-white">
                two atomic instructions
              </span>
              . Both succeed together — or both revert.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="flex items-center justify-between rounded-md border border-white/5 bg-black/20 px-3 py-2 text-xs">
            <span className="text-gray-400">From</span>
            <span className="font-mono text-gray-200">
              {shortKey(payerPubkey)}
            </span>
          </div>

          <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded bg-purple-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-purple-200">
                  IX #1
                </span>
                <ArrowDownUp className="h-3.5 w-3.5 text-purple-300" />
                <span className="text-sm font-semibold text-purple-200">
                  System Program · Transfer
                </span>
              </div>
              <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-200">
                fee
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-1 text-xs">
              <span className="text-gray-400">Amount</span>
              <span className="text-right font-mono text-white">
                {feeSol} SOL
              </span>
              <span className="text-gray-400">In lamports</span>
              <span className="text-right font-mono text-gray-300">
                {feeLamports}
              </span>
              <span className="text-gray-400">Recipient</span>
              <span className="text-right font-mono text-gray-300">
                {shortKey(recipientPubkey)}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded bg-blue-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-200">
                  IX #2
                </span>
                {isLong ? (
                  <TrendingUp className="h-3.5 w-3.5 text-green-300" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-300" />
                )}
                <span className="text-sm font-semibold text-blue-200">
                  Drift Protocol · placePerpOrder
                </span>
              </div>
              <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-200">
                trade
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-1 text-xs">
              <span className="text-gray-400">Market</span>
              <span className="text-right font-mono text-white">
                {marketSymbol}
              </span>
              <span className="text-gray-400">Direction</span>
              <span
                className={`text-right font-mono font-semibold ${
                  isLong ? "text-green-300" : "text-red-300"
                }`}
              >
                {isLong ? "LONG" : "SHORT"}
              </span>
              <span className="text-gray-400">Size</span>
              <span className="text-right font-mono text-white">
                {size} {sizeType === "base" ? "(base)" : "USDC"}
              </span>
              <span className="text-gray-400">Oracle price</span>
              <span className="text-right font-mono text-gray-300">
                ${oraclePriceUsd > 0 ? oraclePriceUsd.toFixed(2) : "—"}
              </span>
            </div>
          </div>

          <div className="rounded-md border border-white/10 bg-black/30 p-3 text-[11px] leading-relaxed text-gray-400">
            <div className="mb-1.5 flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-emerald-300" />
              <span className="font-semibold text-emerald-200">
                Atomic-fee enforcement
              </span>
            </div>
            One Ed25519 signature covers the entire serialized message — both
            instructions, all account keys, and the recent blockhash. Removing,
            reordering, or modifying any byte invalidates the signature and the
            validator drops the whole transaction.
            <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-500">
              <KeyRound className="h-3 w-3" />
              <span className="font-mono">SHA-256 → Ed25519 → atomic execution</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-white/10 px-5 py-4">
          <Button
            type="button"
            variant="outline"
            className="border-gray-600 bg-transparent text-white hover:bg-white/5"
            onClick={onReject}
          >
            Reject
          </Button>
          <Button
            type="button"
            className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-400 hover:to-indigo-500"
            onClick={onApprove}
          >
            <ShieldCheck className="mr-1.5 h-4 w-4" /> Approve
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
