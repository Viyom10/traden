"use client";

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
import { Copy, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useDriftStore } from "@/stores/DriftStore";
import { getSolscanTxUrl, shortSig } from "@/lib/solscan";

interface PaymentHistoryTableProps {
  claims: IFeeClaim[];
  pagination?: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
}

export function PaymentHistoryTable({ claims, pagination, onPageChange }: PaymentHistoryTableProps) {
  const environment = useDriftStore((s) => s.environment);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: "bg-green-900/30 text-green-400",
      failed: "bg-red-900/30 text-red-400",
      processing: "bg-blue-900/30 text-blue-400",
    };

    return (
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${
          statusConfig[status as keyof typeof statusConfig] || "bg-gray-900/30 text-gray-400"
        }`}
      >
        {status.toUpperCase()}
      </span>
    );
  };

  if (claims.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        No payment history available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-700 hover:bg-gray-800/50">
              <TableHead className="text-gray-300">Date Paid</TableHead>
              <TableHead className="text-gray-300">Experience ID</TableHead>
              <TableHead className="text-gray-300">Amount (SOL)</TableHead>
              <TableHead className="text-gray-300">Wallet Address</TableHead>
              <TableHead className="text-gray-300">Status</TableHead>
              <TableHead className="text-gray-300">Transaction</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims.map((claim) => (
              <TableRow
                key={claim._id?.toString()}
                className="border-gray-700 hover:bg-gray-800/30"
              >
                <TableCell className="text-gray-300">
                  {claim.processedAt
                    ? new Date(claim.processedAt).toLocaleString()
                    : new Date(claim.claimedAt).toLocaleString()}
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
                <TableCell>{getStatusBadge(claim.status)}</TableCell>
                <TableCell className="text-gray-300">
                  {claim.txSignature ? (
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/receipt/${claim.txSignature}`}
                        className="font-mono text-xs text-gray-300 hover:text-white hover:underline"
                      >
                        {shortSig(claim.txSignature)}
                      </Link>
                      <a
                        href={getSolscanTxUrl(claim.txSignature, environment)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                        title="Open in Solscan"
                      >
                        Solscan
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ) : (
                    <span className="text-gray-500 text-sm">N/A</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-gray-400">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of{" "}
            {pagination.totalCount} entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="border-gray-700 bg-gray-800 hover:bg-gray-700 text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm text-gray-300">
              Page {pagination.page} of {pagination.totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="border-gray-700 bg-gray-800 hover:bg-gray-700 text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
