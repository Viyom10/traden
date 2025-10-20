"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { TrendingUp, AlertCircle } from "lucide-react";
import { useDriftStore } from "@/stores/DriftStore";
import { useMarkPriceStore } from "@/stores/MarkPriceStore";
import { useOraclePriceStore } from "@/stores/OraclePriceStore";
import { PerpTradeForm } from "../../components/perps/PerpTradeForm/PerpTradeForm";
import { PositionsTable } from "../../components/perps/PositionsTable/PositionsTable";
import { OpenOrdersTable } from "../../components/perps/OpenOrdersTable/OpenOrdersTable";
import { Orderbook } from "../../components/perps/Orderbook";
import { CandleChart } from "../../components/perps/CandleChart";
import { FormSelect } from "../../components/ui/form-select";
import { DEFAULT_PERP_MARKET_INDEX } from "../../constants/defaultMarkets";
import { MarketId, TRADING_UTILS } from "@drift-labs/common";
import { BigNum, PRICE_PRECISION_EXP, ZERO } from "@drift-labs/sdk";
import { useOrderbookWebSocket } from "../../hooks/perps/useOrderbookWebSocket";

export default function PerpsPage() {
  const { connected } = useWallet();
  const drift = useDriftStore((s) => s.drift);
  const perpMarketConfigs = useDriftStore((s) => s.getPerpMarketConfigs());
  const [selectedMarketIndex, setSelectedMarketIndex] = useState<number>(
    DEFAULT_PERP_MARKET_INDEX,
  );
  const [rightPanelView, setRightPanelView] = useState<"order" | "orderbook">("order");

  const selectedMarketId = useMemo(
    () => MarketId.createPerpMarket(selectedMarketIndex),
    [selectedMarketIndex],
  );

  // Connect to orderbook WebSocket immediately when page loads
  const { orderbookData, isLoading: isOrderbookLoading } = useOrderbookWebSocket(selectedMarketId);

  const markPriceData = useMarkPriceStore(
    (s) => s.lookup[selectedMarketId.key],
  );
  const oraclePriceData = useOraclePriceStore(
    (s) => s.lookup[selectedMarketId.key],
  );

  const selectedMarketConfig = perpMarketConfigs.find(
    (config) => config.marketIndex === selectedMarketIndex,
  );

  const tickSizeDecimals = drift?.driftClient
    ? TRADING_UTILS.getMarketTickSizeDecimals(
        drift.driftClient,
        MarketId.createPerpMarket(selectedMarketIndex),
      )
    : 0;

  // Update AuthorityDrift's selectedTradeMarket when selection changes
  useEffect(() => {
    if (drift) {
      drift.updateSelectedTradeMarket(selectedMarketId);
    }

    return () => {
      if (drift) {
        drift.updateSelectedTradeMarket(null);
      }
    };
  }, [drift, selectedMarketId]);

  if (!connected) {
    return (
      <div className="container px-4 py-8">
        <div className="max-w-6xl mx-auto flex justify-center">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-purple-400" />
                <CardTitle>Perpetuals Trading</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  Wallet Not Connected
                </h3>
                <p className="text-gray-400">
                  Please connect your Solana wallet to access perpetuals
                  trading.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="w-full mx-auto flex flex-col gap-3">
        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          {/* Left Column - 60% (3 out of 5 columns) */}
          <div className="lg:col-span-3 flex flex-col gap-3">
            {/* Market Selection and Price Display */}
            <Card>
              <CardContent className="px-6">
                <div className="grid grid-cols-3 gap-6 items-center">
                  {/* Market Selector */}
                  <div>
                    <FormSelect
                      label="Select Market"
                      value={selectedMarketIndex.toString()}
                      onValueChange={(value) => setSelectedMarketIndex(Number(value))}
                      options={perpMarketConfigs.map((config) => ({
                        value: config.marketIndex.toString(),
                        label: `${config.symbol} (${config.baseAssetSymbol})`,
                      }))}
                    />
                  </div>

                  {/* Mark Price Display */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">
                      {markPriceData
                        ? `${BigNum.from(
                            markPriceData?.markPrice ?? ZERO,
                            PRICE_PRECISION_EXP,
                          ).toNotional(undefined, undefined, tickSizeDecimals)}`
                        : "--"}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                      {selectedMarketConfig?.symbol || "No market selected"}
                    </p>
                  </div>

                  {/* Oracle Price Display */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">
                      {oraclePriceData
                        ? `${BigNum.from(
                            oraclePriceData?.price ?? ZERO,
                            PRICE_PRECISION_EXP,
                          ).toNotional(undefined, undefined, tickSizeDecimals)}`
                        : "--"}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                      Oracle Price
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Chart */}
            <CandleChart selectedMarketId={selectedMarketId} />
          </div>

          {/* Right Column - 40% (2 out of 5 columns) */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            {/* Toggle Buttons */}
            <div className="flex bg-gray-800 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setRightPanelView("order")}
                className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  rightPanelView === "order"
                    ? "bg-purple-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Place Order
              </button>
              <button
                type="button"
                onClick={() => setRightPanelView("orderbook")}
                className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  rightPanelView === "orderbook"
                    ? "bg-purple-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Order Book
              </button>
            </div>

            {/* Conditional Rendering based on toggle */}
            {rightPanelView === "order" ? (
              <PerpTradeForm
                perpMarketConfigs={perpMarketConfigs}
                selectedMarketIndex={selectedMarketIndex}
              />
            ) : (
              <Orderbook 
                selectedMarketId={selectedMarketId} 
                orderbookData={orderbookData}
                isLoading={isOrderbookLoading}
              />
            )}
          </div>
        </div>

        {/* Positions Table */}
        <div>
          <PositionsTable />
        </div>

        {/* Open Orders Table */}
        <div>
          <OpenOrdersTable />
        </div>
      </div>
    </div>
  );
}
