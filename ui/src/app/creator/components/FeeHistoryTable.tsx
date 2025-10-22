"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IFee } from "@/schemas/FeeSchema";

interface FeeHistoryTableProps {
  fees: IFee[];
}

export function FeeHistoryTable({ fees }: FeeHistoryTableProps) {
  if (fees.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        No fee history available yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-700 hover:bg-gray-800/50">
            <TableHead className="text-gray-300">Date</TableHead>
            <TableHead className="text-gray-300">User ID</TableHead>
            <TableHead className="text-gray-300">Fee (SOL)</TableHead>
            <TableHead className="text-gray-300">Order Size</TableHead>
            <TableHead className="text-gray-300">Asset Type</TableHead>
            <TableHead className="text-gray-300">Transaction</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fees.map((fee, index) => (
            <TableRow
              key={index}
              className="border-gray-700 hover:bg-gray-800/30"
            >
              <TableCell className="text-gray-300">
                {new Date(fee.timestamp).toLocaleString()}
              </TableCell>
              <TableCell className="text-gray-300 font-mono text-sm">
                {fee.userId.substring(0, 8)}...{fee.userId.substring(fee.userId.length - 6)}
              </TableCell>
              <TableCell className="text-gray-300">
                {parseFloat(fee.feeAmount).toFixed(9)}
              </TableCell>
              <TableCell className="text-gray-300">
                {parseFloat(fee.orderSize).toFixed(2)}
              </TableCell>
              <TableCell className="text-gray-300">
                <span className={`px-2 py-1 rounded text-xs ${
                  fee.assetType === 'base' 
                    ? 'bg-blue-900/30 text-blue-400' 
                    : 'bg-green-900/30 text-green-400'
                }`}>
                  {fee.assetType.toUpperCase()}
                </span>
              </TableCell>
              <TableCell className="text-gray-300">
                {fee.txSignature ? (
                  <a
                    href={`https://solscan.io/tx/${fee.txSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline text-sm"
                  >
                    View
                  </a>
                ) : (
                  <span className="text-gray-500 text-sm">N/A</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
