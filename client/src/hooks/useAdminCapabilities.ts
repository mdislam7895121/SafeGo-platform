import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/queryClient";

export interface AdminNavigation {
  dashboard: boolean;
  peopleKyc: boolean;
  safetyCenter: boolean;
  featureFlags: boolean;
  wallets: boolean;
  payouts: boolean;
  analytics: boolean;
  settings: boolean;
  auditLog: boolean;
  fraudAlerts: boolean;
  support: boolean;
  disputes: boolean;
}

export interface AdminActions {
  canManagePeople: boolean;
  canBulkKyc: boolean;
  canManageRiskCases: boolean;
  canResolveRiskCases: boolean;
  canManageSafetyAlerts: boolean;
  canBlockUserSafety: boolean;
  canManageFeatureFlags: boolean;
  canProcessWalletSettlement: boolean;
  canProcessPayouts: boolean;
  canManageFraudAlerts: boolean;
  canResolveFraudAlerts: boolean;
  canEditSettings: boolean;
  canManageDisputes: boolean;
  canProcessRefunds: boolean;
}

export interface AdminCapabilities {
  role: string;
  permissions: string[];
  navigation: AdminNavigation;
  actions: AdminActions;
  isSuperAdmin: boolean;
  isActive: boolean;
}

export function useAdminCapabilities() {
  return useQuery<AdminCapabilities>({
    queryKey: ["/api/admin-phase1/capabilities"],
    queryFn: async () => {
      const response = await fetchWithAuth("/api/admin-phase1/capabilities");
      if (!response.ok) {
        throw new Error("Failed to fetch admin capabilities");
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
}

export function hasNavAccess(
  capabilities: AdminCapabilities | undefined,
  key: keyof AdminNavigation
): boolean {
  if (!capabilities) return false;
  if (capabilities.isSuperAdmin) return true;
  return capabilities.navigation[key] ?? false;
}

export function canPerformAction(
  capabilities: AdminCapabilities | undefined,
  action: keyof AdminActions
): boolean {
  if (!capabilities) return false;
  if (capabilities.isSuperAdmin) return true;
  return capabilities.actions[action] ?? false;
}

export function hasPermission(
  capabilities: AdminCapabilities | undefined,
  permission: string
): boolean {
  if (!capabilities) return false;
  if (capabilities.isSuperAdmin) return true;
  return capabilities.permissions.includes(permission);
}
