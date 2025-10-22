"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { IFeeClaim } from "@/schemas/FeeClaimSchema";
import { Copy, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FeeClaimHistoryTableProps {
  claims: IFeeClaim[];
  onCancelClaim: (claimId: string) => void;
  isCancelling: boolean;
}

export function FeeClaimHistoryTable({ claims, onCancelClaim, isCancelling }: FeeClaimHistoryTableProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Wallet address copied to clipboard!");
  };

  const handleCancelClick = (claimId: string) => {
    setSelectedClaimId(claimId);
    setCancelDialogOpen(true);
  };

  const handleConfirmCancel = () => {
    if (selectedClaimId) {
      onCancelClaim(selectedClaimId);
      setCancelDialogOpen(false);
      setSelectedClaimId(null);
    }
  };
  if (claims.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        No claim history available yet.
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: "bg-yellow-900/30 text-yellow-400",
      processing: "bg-blue-900/30 text-blue-400",
      completed: "bg-green-900/30 text-green-400",
      failed: "bg-red-900/30 text-red-400",
    };

    return (
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${
          statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
        }`}
      >
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-700 hover:bg-gray-800/50">
              <TableHead className="text-gray-300">Date</TableHead>
              <TableHead className="text-gray-300">Amount (SOL)</TableHead>
              <TableHead className="text-gray-300">Wallet Address</TableHead>
              <TableHead className="text-gray-300">Status</TableHead>
              <TableHead className="text-gray-300">Transaction</TableHead>
              <TableHead className="text-gray-300">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims.map((claim) => (
              <TableRow
                key={claim._id?.toString() || Math.random().toString()}
                className="border-gray-700 hover:bg-gray-800/30"
              >
                <TableCell className="text-gray-300">
                  {new Date(claim.claimedAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-gray-300 font-mono">
                  {parseFloat(claim.claimedAmount).toFixed(9)}
                </TableCell>
                <TableCell className="text-gray-300 font-mono text-sm">
                  <div className="flex items-center gap-2">
                    <span>
                      {claim.publicKey.substring(0, 8)}...
                      {claim.publicKey.substring(claim.publicKey.length - 6)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(claim.publicKey)}
                      className="h-6 w-6 p-0 hover:bg-gray-700"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(claim.status)}</TableCell>
                <TableCell className="text-gray-300">
                  {claim.txSignature ? (
                    <a
                      href={`https://solscan.io/tx/${claim.txSignature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline text-sm"
                    >
                      View
                    </a>
                  ) : (
                    <span className="text-gray-500 text-sm">Pending</span>
                  )}
                </TableCell>
                <TableCell>
                  {claim.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancelClick(claim._id?.toString() || "")}
                      disabled={isCancelling}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Cancel Fee Claim Request</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to cancel this fee claim request? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={isCancelling}
              className="border-gray-700 bg-gray-800 hover:bg-gray-700 text-white"
            >
              No, Keep It
            </Button>
            <Button
              onClick={handleConfirmCancel}
              disabled={isCancelling}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, Cancel Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
