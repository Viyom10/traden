"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Button } from "../ui/button";
import { Trash2, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { TradeSignalRecord, getTimeRemaining } from "@/lib/signalApi";

interface ActiveSignalsTableProps {
  signals: TradeSignalRecord[];
  onCancelSignal: (signalId: string) => void;
  isCancelling: boolean;
}

export const ActiveSignalsTable = ({
  signals,
  onCancelSignal,
  isCancelling,
}: ActiveSignalsTableProps) => {
  const [currentTime, setCurrentTime] = React.useState(Date.now());

  // Update current time every second to refresh countdown
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTimeRemaining = (expiresAt: string): string => {
    const timeRemaining = getTimeRemaining(expiresAt);

    if (timeRemaining.total <= 0) {
      return "Expired";
    }

    if (timeRemaining.days > 0) {
      return `${timeRemaining.days}d ${timeRemaining.hours}h`;
    }

    if (timeRemaining.hours > 0) {
      return `${timeRemaining.hours}h ${timeRemaining.minutes}m`;
    }

    return `${timeRemaining.minutes}m ${timeRemaining.seconds}s`;
  };

  if (signals.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No active signals</p>
        <p className="text-sm">Create a signal to get started</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Market</TableHead>
            <TableHead>Direction</TableHead>
            <TableHead>Order Type</TableHead>
            <TableHead>Leverage</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Expires In</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {signals.map((signal) => {
            const isExpired = new Date(signal.expiresAt) < new Date(currentTime);
            const isLong = signal.direction === "LONG";

            return (
              <TableRow key={signal._id} className={isExpired ? "opacity-50" : ""}>
                <TableCell className="font-medium text-white">
                  {signal.marketSymbol}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {isLong ? (
                      <>
                        <TrendingUp className="h-4 w-4 text-green-400" />
                        <span className="text-green-400">Long</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-4 w-4 text-red-400" />
                        <span className="text-red-400">Short</span>
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell className="capitalize text-gray-300">
                  {signal.orderType}
                </TableCell>
                <TableCell className="text-gray-300">
                  {signal.leverageMultiplier}x leverage
                </TableCell>
                <TableCell className="text-gray-300">
                  {signal.orderType === "market" && "Market"}
                  {signal.orderType === "limit" && signal.limitPrice && `$${signal.limitPrice}`}
                  {(signal.orderType === "takeProfit" || signal.orderType === "stopLoss") &&
                    signal.triggerPrice &&
                    `Trigger: $${signal.triggerPrice}`}
                  {signal.orderType === "oracleLimit" &&
                    signal.oraclePriceOffset &&
                    `Offset: $${signal.oraclePriceOffset}`}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Clock className={`h-4 w-4 ${isExpired ? "text-red-400" : "text-yellow-400"}`} />
                    <span className={isExpired ? "text-red-400" : "text-yellow-400"}>
                      {formatTimeRemaining(signal.expiresAt)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-gray-400 text-sm">
                  {new Date(signal.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCancelSignal(signal._id)}
                    disabled={isCancelling || isExpired}
                    className="text-red-400 hover:text-red-300 border-red-400/50 hover:border-red-300/50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
