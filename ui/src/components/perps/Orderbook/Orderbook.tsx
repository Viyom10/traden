"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { FormSelect } from "../../ui/form-select";
import { useDriftStore } from "@/stores/DriftStore";
import { useMarkPriceStore } from "@/stores/MarkPriceStore";
import { TRADING_UTILS, MarketId } from "@drift-labs/common";
import {
  BigNum,
  PRICE_PRECISION_EXP,
  ZERO,
  BN,
} from "@drift-labs/sdk";
import { BookOpenText } from "lucide-react";
import { DlobOrderbookData } from "@/hooks/perps/useOrderbookWebSocket";

const ORDERBOOK_MAX_LEVELS = 20;

interface OrderbookProps {
  selectedMarketId: MarketId;
  orderbookData: DlobOrderbookData | null;
  isLoading: boolean;
}

interface ProcessedOrderbookLevel {
  price: string;
  size: string;
  total: string;
}

type OrderbookItem = {
  type: "ask" | "bid" | "mark";
  level?: ProcessedOrderbookLevel;
  markPrice?: string;
  spread?: string;
};

interface OrderbookRowProps {
  item: OrderbookItem;
}

const OrderbookRow: React.FC<OrderbookRowProps> = ({ item }) => {
  if (item.type === "mark") {
    return (
      <div
        className="px-4 py-3 bg-gray-800/50 border-y border-gray-600"
        data-mark-price="true"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Mark:</span>
            <span className="text-sm font-mono text-green-400">
              {item.markPrice || "--"}
            </span>
          </div>
          {item.spread && (
            <div className="text-xs text-gray-400">
              Spread: <span className="font-mono">{item.spread}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const level = item.level!;
  const isAsk = item.type === "ask";
  const priceColor = isAsk ? "text-red-400" : "text-green-400";
  const hoverColor = isAsk ? "hover:bg-red-500/10" : "hover:bg-green-500/10";

  return (
    <div
      className={`flex items-center gap-4 px-4 py-1 text-xs ${hoverColor} border-b border-gray-800 [&>div]:flex-1`}
    >
      <div className={`text-left font-mono ${priceColor}`}>{level.price}</div>
      <div className="text-right text-gray-300 font-mono">{level.size}</div>
      <div className="text-right text-gray-400 font-mono">{level.total}</div>
    </div>
  );
};

export const Orderbook: React.FC<OrderbookProps> = ({ 
  selectedMarketId, 
  orderbookData,
  isLoading 
}) => {
  const drift = useDriftStore((s) => s.drift);
  const [selectedGrouping, setSelectedGrouping] = useState<number>(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledToCenter = useRef(false);

  const markPriceData = useMarkPriceStore(
    (s) => s.lookup[selectedMarketId.key],
  );

  const tickSizeDecimals = drift?.driftClient
    ? TRADING_UTILS.getMarketTickSizeDecimals(
        drift.driftClient,
        selectedMarketId,
      )
    : 2;
  const tickSizePrecision = drift?.driftClient
    ? TRADING_UTILS.getMarketTickSize(drift.driftClient, selectedMarketId)
    : ZERO;
  const stepSizeDecimals = drift?.driftClient
    ? TRADING_UTILS.getMarketStepSizeDecimals(
        drift.driftClient,
        selectedMarketId,
      )
    : 2;

  const tickSize = useMemo(
    () => BigNum.from(tickSizePrecision, PRICE_PRECISION_EXP),
    [tickSizePrecision],
  );

  const groupingOptions: { value: string; label: string }[] = useMemo(
    () => [
      {
        value: "1",
        label: `${tickSize
          .mul(new BN(1))
          .prettyPrint(undefined, undefined, tickSizeDecimals)}`,
      },
      {
        value: "10",
        label: `${tickSize.mul(new BN(10)).prettyPrint()}`,
      },
      {
        value: "100",
        label: `${tickSize.mul(new BN(100)).prettyPrint()}`,
      },
      {
        value: "500",
        label: `${tickSize.mul(new BN(500)).prettyPrint()}`,
      },
      {
        value: "1000",
        label: `${tickSize.mul(new BN(1000)).prettyPrint()}`,
      },
    ],
    [tickSizeDecimals, tickSize],
  );

  const handleGroupingChange = (value: string) => {
    setSelectedGrouping(parseInt(value));
  };

  // Reset scroll position when market changes
  useEffect(() => {
    hasScrolledToCenter.current = false;
  }, [selectedMarketId]);

  const { combinedOrderbookData } = useMemo(() => {
    if (!orderbookData || !orderbookData.bids || !orderbookData.asks) {
      return { combinedOrderbookData: [], markPrice: null, spread: null };
    }

    const asksSlice = orderbookData.asks.slice(0, ORDERBOOK_MAX_LEVELS);
    const reversedAsks = [...asksSlice].reverse();

    const processedAsks: ProcessedOrderbookLevel[] = reversedAsks.map((level, index) => {
      const price = parseFloat(level.price).toFixed(tickSizeDecimals);
      const size = parseFloat(level.size).toFixed(stepSizeDecimals);

      const total = reversedAsks
        .slice(index)
        .reduce((sum, l) => sum + parseFloat(l.size), 0);
      const totalFormatted = total.toFixed(stepSizeDecimals);

      return {
        price,
        size,
        total: totalFormatted,
      };
    });

    const processedBids: ProcessedOrderbookLevel[] = orderbookData.bids
      .slice(0, ORDERBOOK_MAX_LEVELS)
      .map((level, index) => {
        const price = parseFloat(level.price).toFixed(tickSizeDecimals);
        const size = parseFloat(level.size).toFixed(stepSizeDecimals);
        
        const total = orderbookData.bids
          .slice(0, index + 1)
          .reduce((sum, l) => sum + parseFloat(l.size), 0);
        const totalFormatted = total.toFixed(stepSizeDecimals);

        return {
          price,
          size,
          total: totalFormatted,
        };
      });

    const currentMarkPrice = markPriceData
      ? BigNum.from(
          markPriceData.markPrice ?? ZERO,
          PRICE_PRECISION_EXP,
        ).toNotional(undefined, undefined, tickSizeDecimals)
      : null;

    const bestBidPrice = orderbookData.bids.length > 0 ? parseFloat(orderbookData.bids[0].price) : null;
    const bestAskPrice = orderbookData.asks.length > 0 ? parseFloat(orderbookData.asks[0].price) : null;
    
    const currentSpread = bestBidPrice && bestAskPrice
      ? (bestAskPrice - bestBidPrice).toFixed(tickSizeDecimals)
      : null;

    const combinedData: OrderbookItem[] = [
      ...processedAsks.map((level) => ({
        type: "ask" as const,
        level,
      })),
      {
        type: "mark" as const,
        markPrice: currentMarkPrice ?? "",
        spread: currentSpread ?? "",
      },
      ...processedBids.map((level) => ({
        type: "bid" as const,
        level,
      })),
    ];

    return {
      combinedOrderbookData: combinedData,
      markPrice: currentMarkPrice,
      spread: currentSpread,
    };
  }, [orderbookData, markPriceData, tickSizeDecimals, stepSizeDecimals]);

  useEffect(() => {
    if (
      combinedOrderbookData.length > 0 &&
      scrollContainerRef.current &&
      !hasScrolledToCenter.current
    ) {
      const markPriceElement = scrollContainerRef.current.querySelector(
        '[data-mark-price="true"]',
      );
      if (markPriceElement) {
        const container = scrollContainerRef.current;
        const containerRect = container.getBoundingClientRect();
        const elementRect = markPriceElement.getBoundingClientRect();

        const scrollTop =
          container.scrollTop +
          (elementRect.top - containerRect.top) -
          containerRect.height / 2 +
          elementRect.height / 2;

        container.scrollTop = scrollTop;
        hasScrolledToCenter.current = true;
      }
    }
  }, [combinedOrderbookData]);

  return (
    <Card className="h-full max-h-[700px] flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpenText className="h-5 w-5 text-blue-400" />
            Order Book
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Grouping:</span>
            <FormSelect
              value={selectedGrouping.toString()}
              onValueChange={handleGroupingChange}
              options={groupingOptions}
              className="w-24"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col h-full">
          <div className="flex justify-between gap-4 px-4 py-2 text-xs font-medium text-gray-400 border-b [&>div]:flex-1 flex-shrink-0">
            <div className="text-left">Price</div>
            <div className="text-right">Size</div>
            <div className="text-right">Total</div>
          </div>

          <div
            className="flex-1 overflow-y-auto min-h-0"
            ref={scrollContainerRef}
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-gray-400">Loading orderbook...</div>
              </div>
            ) : combinedOrderbookData.length > 0 ? (
              combinedOrderbookData.map((item, index) => (
                <OrderbookRow key={`orderbook-${index}`} item={item} />
              ))
            ) : (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-gray-400">No orderbook data available</div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
