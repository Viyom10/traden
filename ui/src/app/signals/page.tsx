"use client";

import { PageLayout } from "@/components/layout/PageLayout";
import { CustomerSignalsView } from "./components/CustomerSignalsView";

export default function SignalsPage() {
  return (
    <PageLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Trading Signals
          </h1>
          <p className="text-gray-400">
            View and execute trading signals from your creator
          </p>
        </div>
        <CustomerSignalsView />
      </div>
    </PageLayout>
  );
}
