"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSelect } from "@/components/ui/form-select";
import { SignalTradeForm } from "./SignalTradeForm";
import { SignalsList } from "./SignalsList";
import { useDriftStore } from "@/stores/DriftStore";
import { Radio } from "lucide-react";
import { PerpMarketConfig } from "@drift-labs/sdk";

export function CreateSignal() {
  const perpMarketConfigs = useDriftStore((s) => s.getPerpMarketConfigs());
  const [selectedMarketIndex, setSelectedMarketIndex] = useState<number>(0);

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
          <FormSelect
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
