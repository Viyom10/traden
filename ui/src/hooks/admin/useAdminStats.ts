"use client";

import { useQuery } from "@tanstack/react-query";

interface FeeStats {
  totalInLamports: string;
  totalInSol: number;
  platformShareInLamports: string;
  platformShareInSol: number;
  transactionCount: number;
}

interface AdminStatsResponse {
  success: boolean;
  total: FeeStats;
  today: FeeStats;
  week: FeeStats;
  month: FeeStats;
}

export function useAdminStats() {
  const { data, isLoading, error } = useQuery<AdminStatsResponse>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/stats");

      if (!response.ok) {
        throw new Error("Failed to fetch admin stats");
      }

      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  return {
    totalStats: data?.total,
    todayStats: data?.today,
    weekStats: data?.week,
    monthStats: data?.month,
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
