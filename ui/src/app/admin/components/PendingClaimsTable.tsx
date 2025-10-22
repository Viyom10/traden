"use client";

import { useState } from "react";
import { IFeeClaim } from "@/schemas/FeeClaimSchema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PendingClaimsTableProps {
  claims: IFeeClaim[];
  onUpdateClaim: (claimId: string, status: string, txSignature?: string) => void;
  isUpdating: boolean;
}

export function PendingClaimsTable({ claims, onUpdateClaim, isUpdating }: PendingClaimsTableProps) {
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<IFeeClaim | null>(null);
  const [txSignature, setTxSignature] = useState("");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handlePayClick = (claim: IFeeClaim) => {
    setSelectedClaim(claim);
    setTxSignature("");
    setPayDialogOpen(true);
  };

  const handleConfirmPayment = () => {
    if (!selectedClaim || !txSignature.trim()) {
      toast.error("Please enter a transaction signature");
      return;
    }

    onUpdateClaim(
      selectedClaim._id?.toString() || "",
      "completed",
      txSignature.trim()
    );
    setPayDialogOpen(false);
    setSelectedClaim(null);
    setTxSignature("");
  };

  if (claims.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        No pending claim requests.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-700 hover:bg-gray-800/50">
              <TableHead className="text-gray-300">Date</TableHead>
              <TableHead className="text-gray-300">Experience ID</TableHead>
              <TableHead className="text-gray-300">Amount (SOL)</TableHead>
              <TableHead className="text-gray-300">Wallet Address</TableHead>
              <TableHead className="text-gray-300">Status</TableHead>
              <TableHead className="text-gray-300">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims.map((claim) => (
              <TableRow
                key={claim._id?.toString()}
                className="border-gray-700 hover:bg-gray-800/30"
              >
                <TableCell className="text-gray-300">
                  {new Date(claim.claimedAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-gray-300 font-mono text-sm">
                  <div className="flex items-center gap-2">
                    <span>
                      {claim.experienceId.substring(0, 8)}...
                      {claim.experienceId.substring(claim.experienceId.length - 6)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(claim.experienceId)}
                      className="h-6 w-6 p-0 hover:bg-gray-700"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
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
                <TableCell>
                  <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-900/30 text-yellow-400">
                    {claim.status.toUpperCase()}
                  </span>
                </TableCell>
                <TableCell>
                  <Button
                    onClick={() => handlePayClick(claim)}
                    disabled={isUpdating}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    size="sm"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Pay
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Payment Confirmation Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
            <DialogDescription className="text-gray-400">
              Enter the transaction signature to mark this claim as paid.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedClaim && (
              <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
                <div>
                  <p className="text-sm text-gray-400">Amount</p>
                  <p className="text-lg font-bold text-white">
                    {parseFloat(selectedClaim.claimedAmount).toFixed(9)} SOL
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Wallet Address</p>
                  <p className="text-sm font-mono text-white break-all">
                    {selectedClaim.publicKey}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="txSignature" className="text-gray-200">
                Transaction Signature
              </Label>
              <Input
                id="txSignature"
                type="text"
                placeholder="Enter transaction signature"
                value={txSignature}
                onChange={(e) => setTxSignature(e.target.value)}
                disabled={isUpdating}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPayDialogOpen(false)}
              disabled={isUpdating}
              className="border-gray-700 bg-gray-800 hover:bg-gray-700 text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPayment}
              disabled={isUpdating || !txSignature.trim()}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
