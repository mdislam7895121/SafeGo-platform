/**
 * Hook for calculating promotions on fares
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { PromoCalculationRequest, PromoCalculationResponse } from "@/lib/promoTypes";

export function usePromoCalculation(
  request: PromoCalculationRequest | null,
  enabled: boolean = true
) {
  return useQuery<PromoCalculationResponse>({
    queryKey: ["/api/promos/calculate", request],
    queryFn: async () => {
      if (!request) {
        throw new Error("No request provided");
      }
      const response = await apiRequest("POST", "/api/promos/calculate", request);
      return response.json();
    },
    enabled: enabled && !!request && request.originalFare > 0,
    staleTime: 30 * 1000,
    gcTime: 60 * 1000,
    retry: 1,
  });
}

export function formatCurrencyWithStrikethrough(
  anchorFare: number,
  finalFare: number,
  currency: string = "USD"
): { anchor: string; final: string; saved: string } {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  return {
    anchor: formatter.format(anchorFare),
    final: formatter.format(finalFare),
    saved: formatter.format(anchorFare - finalFare),
  };
}
