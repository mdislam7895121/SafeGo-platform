import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/queryClient";

export interface KycStatusResponse {
  isVerified: boolean;
  verificationStatus: "pending" | "approved" | "rejected" | "unsubmitted";
  countryCode: "BD" | "US";
  missingFields: string[];
  requiresKycBeforeBooking: boolean;
  reason: string;
}

export function useKycStatus(enabled: boolean = true) {
  return useQuery<KycStatusResponse>({
    queryKey: ["/api/customer/kyc-status"],
    queryFn: async () => {
      const response = await fetchWithAuth("/api/customer/kyc-status");
      if (!response.ok) {
        throw new Error("Failed to fetch KYC status");
      }
      return response.json();
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
