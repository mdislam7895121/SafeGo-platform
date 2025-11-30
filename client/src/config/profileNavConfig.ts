/**
 * Profile Navigation Configuration
 * Provides role-aware profile route mapping and navigation behavior settings.
 * ADD-ONLY implementation for SafeGo profile avatar navigation fix.
 */

export type UserRole = "customer" | "driver" | "restaurant" | "admin";

const VALID_ROLES: readonly UserRole[] = ["customer", "driver", "restaurant", "admin"] as const;

/**
 * Profile routes for each role
 */
export const PROFILE_ROUTES: Record<UserRole, string> = {
  customer: "/customer/profile",
  driver: "/driver/profile",
  restaurant: "/restaurant/settings/profile",
  admin: "/admin/settings",
};

/**
 * Account/settings routes for each role (alternative to profile)
 */
export const ACCOUNT_ROUTES: Record<UserRole, string> = {
  customer: "/customer/profile",
  driver: "/driver/account",
  restaurant: "/restaurant/settings/profile",
  admin: "/admin/settings",
};

/**
 * Wallet routes for each role (if available)
 */
export const WALLET_ROUTES: Record<UserRole, string | null> = {
  customer: "/customer/wallet",
  driver: "/driver/wallet",
  restaurant: "/restaurant/payouts",
  admin: null,
};

/**
 * Settings routes for each role
 */
export const SETTINGS_ROUTES: Record<UserRole, string> = {
  customer: "/customer/profile",
  driver: "/driver/account",
  restaurant: "/restaurant/settings/profile",
  admin: "/admin/settings",
};

/**
 * Profile navigation configuration
 */
export const profileNavConfig = {
  enableHeaderAvatarProfileNavigation: true,
  mobileOpensDrawer: true,
  desktopDirectNavigate: true,
  mobileBreakpoint: 768,
};

/**
 * Validates if the provided role is a valid UserRole
 * @param role - The role to validate
 * @returns true if valid, false otherwise
 */
export function isValidRole(role: string | null | undefined): role is UserRole {
  if (!role) return false;
  return VALID_ROLES.includes(role.toLowerCase() as UserRole);
}

/**
 * Get profile route for a given role.
 * Throws error if role is invalid to maintain strict role boundaries.
 * @throws Error if role is invalid
 */
export function getProfileRouteForRole(role: UserRole | string | null): string {
  if (!role) {
    console.error("[profileNavConfig] Role is null or undefined, cannot determine profile route");
    throw new Error("Role is required for profile navigation");
  }
  
  const normalizedRole = role.toLowerCase();
  
  if (!isValidRole(normalizedRole)) {
    console.error(`[profileNavConfig] Invalid role "${role}" provided, valid roles are: ${VALID_ROLES.join(", ")}`);
    throw new Error(`Invalid role: ${role}`);
  }
  
  return PROFILE_ROUTES[normalizedRole];
}

/**
 * Get account route for a given role.
 * Throws error if role is invalid to maintain strict role boundaries.
 * @throws Error if role is invalid
 */
export function getAccountRouteForRole(role: UserRole | string | null): string {
  if (!role) {
    console.error("[profileNavConfig] Role is null or undefined, cannot determine account route");
    throw new Error("Role is required for account navigation");
  }
  
  const normalizedRole = role.toLowerCase();
  
  if (!isValidRole(normalizedRole)) {
    console.error(`[profileNavConfig] Invalid role "${role}" provided, valid roles are: ${VALID_ROLES.join(", ")}`);
    throw new Error(`Invalid role: ${role}`);
  }
  
  return ACCOUNT_ROUTES[normalizedRole];
}

/**
 * Get wallet route for a given role (null if not available).
 * Throws error if role is invalid to maintain strict role boundaries.
 * @throws Error if role is invalid
 */
export function getWalletRouteForRole(role: UserRole | string | null): string | null {
  if (!role) {
    console.error("[profileNavConfig] Role is null or undefined, cannot determine wallet route");
    throw new Error("Role is required for wallet navigation");
  }
  
  const normalizedRole = role.toLowerCase();
  
  if (!isValidRole(normalizedRole)) {
    console.error(`[profileNavConfig] Invalid role "${role}" provided, valid roles are: ${VALID_ROLES.join(", ")}`);
    throw new Error(`Invalid role: ${role}`);
  }
  
  return WALLET_ROUTES[normalizedRole];
}

/**
 * Get settings route for a given role.
 * Throws error if role is invalid to maintain strict role boundaries.
 * @throws Error if role is invalid
 */
export function getSettingsRouteForRole(role: UserRole | string | null): string {
  if (!role) {
    console.error("[profileNavConfig] Role is null or undefined, cannot determine settings route");
    throw new Error("Role is required for settings navigation");
  }
  
  const normalizedRole = role.toLowerCase();
  
  if (!isValidRole(normalizedRole)) {
    console.error(`[profileNavConfig] Invalid role "${role}" provided, valid roles are: ${VALID_ROLES.join(", ")}`);
    throw new Error(`Invalid role: ${role}`);
  }
  
  return SETTINGS_ROUTES[normalizedRole];
}

/**
 * Safely get profile route for a given role with fallback logging.
 * Use this when you need graceful degradation instead of throwing.
 * @returns The route or null if role is invalid
 */
export function safeGetProfileRouteForRole(role: UserRole | string | null | undefined): string | null {
  if (!role || !isValidRole(role)) {
    console.warn(`[profileNavConfig] Could not get profile route for role "${role}", returning null`);
    return null;
  }
  return PROFILE_ROUTES[role.toLowerCase() as UserRole];
}

/**
 * Check if mobile drawer should be used based on viewport width
 */
export function shouldUseMobileDrawer(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < profileNavConfig.mobileBreakpoint && profileNavConfig.mobileOpensDrawer;
}

/**
 * Profile menu items for each role
 */
export interface ProfileMenuItem {
  label: string;
  href: string;
  icon: string;
  testId: string;
}

/**
 * Get profile menu items for a given role.
 * Throws error if role is invalid.
 * @throws Error if role is invalid
 */
export function getProfileMenuItemsForRole(role: UserRole | string | null): ProfileMenuItem[] {
  if (!role || !isValidRole(role)) {
    console.error(`[profileNavConfig] Invalid role "${role}" for menu items`);
    throw new Error(`Invalid role for menu items: ${role}`);
  }
  
  const normalizedRole = role.toLowerCase() as UserRole;
  
  const baseItems: ProfileMenuItem[] = [
    {
      label: "Profile",
      href: PROFILE_ROUTES[normalizedRole],
      icon: "User",
      testId: "menu-item-profile",
    },
  ];
  
  const walletRoute = WALLET_ROUTES[normalizedRole];
  if (walletRoute) {
    baseItems.push({
      label: normalizedRole === "restaurant" ? "Payouts" : "Wallet",
      href: walletRoute,
      icon: "Wallet",
      testId: "menu-item-wallet",
    });
  }
  
  if (normalizedRole !== "customer") {
    baseItems.push({
      label: "Settings",
      href: SETTINGS_ROUTES[normalizedRole],
      icon: "Settings",
      testId: "menu-item-settings",
    });
  }
  
  return baseItems;
}
