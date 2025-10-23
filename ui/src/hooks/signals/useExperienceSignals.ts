"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchExperienceSignals, TradeSignalRecord } from "@/lib/signalApi";

export function useExperienceSignals(experienceId: string | undefined | null) {
  const {
    data: signals = [],
    isLoading,
    error,
  } = useQuery<TradeSignalRecord[], Error>({
    queryKey: ["experienceSignals", experienceId],
    queryFn: () => {
      if (!experienceId) {
        throw new Error("Experience ID is required");
      }
      return fetchExperienceSignals(experienceId, false);
    },
    enabled: !!experienceId,
    refetchInterval: 5000, // Refetch every 5 seconds to update expiry status
  });

  return {
    signals,
    isLoading,
    error: error?.message,
  };
}
