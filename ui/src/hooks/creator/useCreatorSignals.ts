"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchExperienceSignals, cancelSignal, TradeSignalRecord } from "@/lib/signalApi";

export function useCreatorSignals(experienceId: string | undefined | null) {
  const queryClient = useQueryClient();

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
    refetchInterval: 10000, // Refetch every 10 seconds to update expiry status
  });

  const cancelMutation = useMutation({
    mutationFn: (signalId: string) => cancelSignal(signalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["experienceSignals", experienceId] });
    },
  });

  return {
    signals,
    isLoading,
    error: error?.message,
    cancelSignal: cancelMutation.mutate,
    isCancelling: cancelMutation.isPending,
    cancelError: cancelMutation.error?.message,
  };
}
