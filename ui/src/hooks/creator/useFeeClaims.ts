"use client";

import { useUserStore } from "@/stores/UserStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { IFeeClaim } from "@/schemas/FeeClaimSchema";

interface FeeClaimResponse {
  success: boolean;
  claims: IFeeClaim[];
  totalClaimedInLamports: string;
  totalClaimedInSol: number;
  totalFeesInLamports: string;
  totalFeesInSol: number;
  claimableFeesInLamports: string;
  claimableFeesInSol: number;
}

export function useFeeClaims() {
  const experienceId = useUserStore((s) => s.experienceId);
  const accessLevel = useUserStore((s) => s.accessLevel);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<FeeClaimResponse>({
    queryKey: ["fee-claims", experienceId],
    queryFn: async () => {
      if (!experienceId) {
        throw new Error("No experience ID available");
      }

      const response = await fetch(`/api/fee-claim?experienceId=${experienceId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch fee claims");
      }

      return response.json();
    },
    enabled: accessLevel === "admin" && !!experienceId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const claimFeesMutation = useMutation({
    mutationFn: async ({
      publicKey,
      claimedAmount,
      claimedAmountInLamports,
    }: {
      publicKey: string;
      claimedAmount: string;
      claimedAmountInLamports: string;
    }) => {
      const response = await fetch("/api/fee-claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          experienceId,
          publicKey,
          claimedAmount,
          claimedAmountInLamports,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to claim fees");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch fee claims data
      queryClient.invalidateQueries({ queryKey: ["fee-claims", experienceId] });
    },
  });

  const cancelClaimMutation = useMutation({
    mutationFn: async (claimId: string) => {
      const response = await fetch(`/api/fee-claim?claimId=${claimId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to cancel claim");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch fee claims data
      queryClient.invalidateQueries({ queryKey: ["fee-claims", experienceId] });
    },
  });

  return {
    claims: data?.claims || [],
    totalClaimedInSol: data?.totalClaimedInSol || 0,
    totalFeesInSol: data?.totalFeesInSol || 0,
    claimableFeesInSol: data?.claimableFeesInSol || 0,
    claimableFeesInLamports: data?.claimableFeesInLamports || "0",
    isLoading,
    error: error ? (error as Error).message : null,
    claimFees: claimFeesMutation.mutate,
    isClaimingFees: claimFeesMutation.isPending,
    claimError: claimFeesMutation.error
      ? (claimFeesMutation.error as Error).message
      : null,
    cancelClaim: cancelClaimMutation.mutate,
    isCancellingClaim: cancelClaimMutation.isPending,
    cancelError: cancelClaimMutation.error
      ? (cancelClaimMutation.error as Error).message
      : null,
  };
}
