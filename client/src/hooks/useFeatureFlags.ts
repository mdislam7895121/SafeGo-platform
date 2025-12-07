import { useQuery } from "@tanstack/react-query";

interface FeatureFlag {
  key: string;
  isEnabled: boolean;
  category: "RIDE" | "FOOD" | "SHOP" | "TICKET" | "RENTAL" | "SYSTEM" | null;
  countryScope: string | null;
  roleScope: string | null;
  serviceScope: string | null;
  rolloutPercentage: number | null;
}

export function useFeatureFlags() {
  const { data: flags, isLoading } = useQuery<FeatureFlag[]>({
    queryKey: ["/api/auth/feature-flags"],
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const isEnabled = (flagKey: string): boolean => {
    if (!flags) return false;
    const flag = flags.find(f => f.key === flagKey);
    return flag?.isEnabled ?? false;
  };

  const getFlag = (flagKey: string): FeatureFlag | undefined => {
    return flags?.find(f => f.key === flagKey);
  };

  return {
    flags,
    isLoading,
    isEnabled,
    getFlag,
    driverOnboardingV2: isEnabled("driver_onboarding_v2"),
  };
}

export const FEATURE_FLAGS = {
  DRIVER_ONBOARDING_V2: "driver_onboarding_v2",
} as const;
