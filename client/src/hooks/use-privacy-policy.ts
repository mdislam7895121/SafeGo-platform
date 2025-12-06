/**
 * usePrivacyPolicy Hook
 * 
 * Manages privacy policy state and enforcement for all user roles.
 * Provides policy data, consent status, and methods to accept/decline policy.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ConsentPreferences } from "@/components/privacy/PrivacyPolicyContent";

interface PolicyData {
  version: string;
  title: string;
  contentUrl: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

interface ConsentStatus {
  privacyPolicyVersion: string | null;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  policyAcceptedAt: string | null;
  marketingOptIn: boolean;
  dataSharingOptIn: boolean;
  locationPermission: boolean;
  trackingConsent: boolean;
}

interface ConsentStatusResponse {
  success: boolean;
  consentStatus: ConsentStatus | null;
  activePolicy: PolicyData | null;
  mustAcceptNewPolicy: boolean;
  verificationStatus: string | null;
  isVerified: boolean;
}

export function usePrivacyPolicy() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<ConsentStatusResponse>({
    queryKey: ["/api/privacy/my-consent-status"],
    queryFn: async () => {
      const response = await fetch("/api/privacy/my-consent-status", {
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, consentStatus: null, activePolicy: null, mustAcceptNewPolicy: false, verificationStatus: null, isVerified: false };
        }
        throw new Error("Failed to fetch consent status");
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const acceptPolicyMutation = useMutation({
    mutationFn: async (preferences: ConsentPreferences) => {
      await apiRequest("/api/privacy/accept-policy", { method: "POST" });
      
      await apiRequest("/api/privacy/consent-preferences", {
        method: "PATCH",
        body: JSON.stringify(preferences),
        headers: { "Content-Type": "application/json" },
      });
      
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Privacy Policy Accepted",
        description: "Thank you for accepting our privacy policy.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/privacy/my-consent-status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to accept privacy policy. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (preferences: ConsentPreferences) => {
      return apiRequest("/api/privacy/consent-preferences", {
        method: "PATCH",
        body: JSON.stringify(preferences),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      toast({
        title: "Preferences Updated",
        description: "Your privacy preferences have been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/privacy/my-consent-status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAcceptPolicy = (preferences: ConsentPreferences) => {
    acceptPolicyMutation.mutate(preferences);
  };

  const handleUpdatePreferences = (preferences: ConsentPreferences) => {
    updatePreferencesMutation.mutate(preferences);
  };

  const handleDecline = () => {
    toast({
      title: "Policy Declined",
      description: "You must accept the privacy policy to continue using SafeGo services.",
      variant: "destructive",
    });
  };

  return {
    policy: data?.activePolicy || null,
    consentStatus: data?.consentStatus || null,
    mustAcceptNewPolicy: data?.mustAcceptNewPolicy || false,
    verificationStatus: data?.verificationStatus || null,
    isVerified: data?.isVerified || false,
    isLoading,
    error,
    refetch,
    acceptPolicy: handleAcceptPolicy,
    updatePreferences: handleUpdatePreferences,
    declinePolicy: handleDecline,
    isAccepting: acceptPolicyMutation.isPending,
    isUpdating: updatePreferencesMutation.isPending,
  };
}

export default usePrivacyPolicy;
