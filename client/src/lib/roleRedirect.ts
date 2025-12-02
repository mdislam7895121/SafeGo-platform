/**
 * Role-based post-login routing helper
 * 
 * This utility provides proper routing based on user role and verification status.
 * BD-specific roles (ticket_operator, shop_partner) require countryCode="BD".
 */

interface UserForRedirect {
  role: string;
  countryCode?: string;
  profile?: {
    verificationStatus?: string;
  };
}

/**
 * Get the correct post-login path based on user role and verification status.
 * 
 * Routing rules:
 * - admin → /admin
 * - customer → /customer
 * - driver → /driver/map (Uber-style live map experience)
 * - restaurant → /restaurant
 * - ticket_operator (BD only):
 *   - approved → /ticket-operator/dashboard
 *   - pending/rejected → /ticket-operator/onboarding
 * - shop_partner (BD only):
 *   - approved → /shop-partner/dashboard
 *   - pending/rejected → /shop-partner/onboarding
 * - fallback → /customer
 */
export function getPostLoginPath(user: UserForRedirect | null | undefined): string {
  if (!user || !user.role) {
    console.warn("[roleRedirect] No user or role provided, redirecting to /login");
    return "/login";
  }

  const { role, countryCode, profile } = user;
  const verificationStatus = profile?.verificationStatus;

  switch (role) {
    case "admin":
      return "/admin";

    case "customer":
      return "/customer";

    case "driver":
      return "/driver/map";

    case "restaurant":
      return "/restaurant";

    case "ticket_operator":
      if (countryCode !== "BD") {
        console.warn("[roleRedirect] ticket_operator role requires countryCode=BD, falling back to /customer");
        return "/customer";
      }
      if (verificationStatus === "approved") {
        return "/ticket-operator/dashboard";
      }
      return "/ticket-operator/onboarding";

    case "shop_partner":
      if (countryCode !== "BD") {
        console.warn("[roleRedirect] shop_partner role requires countryCode=BD, falling back to /customer");
        return "/customer";
      }
      if (verificationStatus === "approved") {
        return "/shop-partner/dashboard";
      }
      return "/shop-partner/onboarding";

    default:
      console.warn(`[roleRedirect] Unknown role: ${role}, falling back to /customer`);
      return "/customer";
  }
}

/**
 * Check if a user has access to a specific route based on their role.
 */
export function canAccessRoute(user: UserForRedirect, routeRole: string): boolean {
  const { role, countryCode } = user;

  if (role === routeRole) {
    return true;
  }

  if (routeRole === "ticket_operator" || routeRole === "shop_partner") {
    return role === routeRole && countryCode === "BD";
  }

  return false;
}

/**
 * Get Bangla notification message for redirect scenarios.
 */
export function getRedirectNotification(fromRoute: string, toRole: string): { title: string; description: string } | null {
  if (toRole === "ticket_operator" && fromRoute.startsWith("/customer")) {
    return {
      title: "ড্যাশবোর্ডে যাওয়া হচ্ছে",
      description: "আপনাকে টিকিট অপারেটর ড্যাশবোর্ডে নিয়ে যাওয়া হয়েছে।"
    };
  }

  if (toRole === "shop_partner" && fromRoute.startsWith("/customer")) {
    return {
      title: "ড্যাশবোর্ডে যাওয়া হচ্ছে",
      description: "আপনাকে দোকানের ড্যাশবোর্ডে নিয়ে যাওয়া হয়েছে।"
    };
  }

  return null;
}
