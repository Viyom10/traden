"use client";

import { useUserStore } from "@/stores/UserStore";
import { useQuery } from "@tanstack/react-query";
import { IFee } from "@/schemas/FeeSchema";

interface FeeResponse {
  success: boolean;
  fees: IFee[];
  totalCount: number;
  totalFeesInLamports: string;
  totalFeesInSol: number;
  limit: number;
  skip: number;
}

export function useCreatorFees() {
  const experienceId = useUserStore((s) => s.experienceId);
  const accessLevel = useUserStore((s) => s.accessLevel);

  const { data, isLoading, error } = useQuery<FeeResponse>({
    queryKey: ["creator-fees", experienceId],
    queryFn: async () => {
      if (!experienceId) {
        throw new Error("No experience ID available");
      }

      const response = await fetch(
        `/api/fee?experienceId=${experienceId}&limit=1000`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch fees");
      }

      return response.json();
    },
    enabled: accessLevel === "admin" && !!experienceId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Creator gets 50% of the total fees
  const creatorFeesInSol = (data?.totalFeesInSol || 0) / 2;
  const creatorFeesInLamports = data?.totalFeesInLamports 
    ? (BigInt(data.totalFeesInLamports) / BigInt(2)).toString()
    : "0";

  return {
    fees: data?.fees || [],
    totalCount: data?.totalCount || 0,
    totalFeesInLamports: data?.totalFeesInLamports || "0",
    totalFeesInSol: data?.totalFeesInSol || 0,
    creatorFeesInSol,
    creatorFeesInLamports,
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
