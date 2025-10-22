"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { IFeeClaim } from "@/schemas/FeeClaimSchema";

interface ClaimsResponse {
  success: boolean;
  claims: IFeeClaim[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

export function useAdminClaims(status?: string, page: number = 1, limit: number = 10) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<ClaimsResponse>({
    queryKey: ["admin-claims", status, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      
      if (status) {
        params.append('status', status);
      }

      const response = await fetch(`/api/admin/claims?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch claims");
      }

      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const updateClaimMutation = useMutation({
    mutationFn: async ({
      claimId,
      status,
      txSignature,
    }: {
      claimId: string;
      status: string;
      txSignature?: string;
    }) => {
      const response = await fetch("/api/admin/claims", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          claimId,
          status,
          txSignature,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update claim");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate all admin claims queries
      queryClient.invalidateQueries({ queryKey: ["admin-claims"] });
    },
  });

  return {
    claims: data?.claims || [],
    pagination: data?.pagination,
    isLoading,
    error: error ? (error as Error).message : null,
    updateClaim: updateClaimMutation.mutate,
    isUpdating: updateClaimMutation.isPending,
    updateError: updateClaimMutation.error
      ? (updateClaimMutation.error as Error).message
      : null,
  };
}
