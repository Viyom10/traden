"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableMarketSelect } from "@/components/ui/searchable-market-select";
import { SignalTradeForm } from "./SignalTradeForm";
import { SignalsList } from "./SignalsList";
import { useDriftStore } from "@/stores/DriftStore";
import { Radio } from "lucide-react";
import { PerpMarketConfig } from "@drift-labs/sdk";
import { SUPPORTED_PERP_MARKET_INDEXES } from "@/constants/supportedMarkets";

export function CreateSignal() {
  const allPerpMarketConfigs = useDriftStore((s) => s.getPerpMarketConfigs());
  const [selectedMarketIndex, setSelectedMarketIndex] = useState<number>(0);

  // Filter to only show supported markets
  const perpMarketConfigs = useMemo(
    () => allPerpMarketConfigs.filter((config) => 
      SUPPORTED_PERP_MARKET_INDEXES.includes(config.marketIndex)
    ),
    [allPerpMarketConfigs]
  );

  const marketOptions = perpMarketConfigs.map((config: PerpMarketConfig) => ({
    value: config.marketIndex.toString(),
    label: config.symbol,
  }));

  return (
    <div className="space-y-6">
      {/* Market Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-yellow-400" />
            Select Market
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SearchableMarketSelect
            label="Perpetual Market"
            value={selectedMarketIndex.toString()}
            onValueChange={(value) => setSelectedMarketIndex(parseInt(value))}
            options={marketOptions}
            required
          />
        </CardContent>
      </Card>

      {/* Signal Form */}
      <SignalTradeForm
        perpMarketConfigs={perpMarketConfigs}
        selectedMarketIndex={selectedMarketIndex}
      />

      {/* Signals List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-blue-400" />
            Active Signals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SignalsList />
        </CardContent>
      </Card>
    </div>
  );
}
