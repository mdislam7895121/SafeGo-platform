/**
 * Role-based post-login routing helper
 * 
 * This utility provides proper routing based on user role and verification status.
 * BD-specific roles (ticket_operator, shop_partner) require countryCode="BD".
 * 
 * Pending roles (pending_ticket_operator, pending_shop_partner) always route to onboarding
 * until admin approval converts them to final roles.
 */

interface UserForRedirect {
  role: string;
  countryCode?: string;
  profile?: {
    verificationStatus?: string;
  };
}

/**
 * Check if a role is a pending BD role that requires onboarding
 */
export function isPendingBDRole(role: string): boolean {
  return role === "pending_ticket_operator" || role === "pending_shop_partner";
}

/**
 * Get the final role from a pending role
 */
export function getFinalRoleFromPending(role: string): string | null {
  if (role === "pending_ticket_operator") return "ticket_operator";
  if (role === "pending_shop_partner") return "shop_partner";
  return null;
}

/**
 * Get the correct post-login path based on user role and verification status.
 * 
 * Routing rules:
 * - admin → /admin
 * - customer → /customer
 * - driver → /driver/map (Uber-style live map experience)
 * - restaurant → /restaurant
 * - pending_ticket_operator → /ticket-operator/onboarding (always)
 * - pending_shop_partner → /shop-partner/onboarding (always)
 * - ticket_operator (BD only, approved) → /ticket-operator/dashboard
 * - shop_partner (BD only, approved) → /shop-partner/dashboard
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

    case "pending_driver":
      // Driver has submitted application, waiting for admin approval
      // Redirect to driver dashboard (Uber-style) - they can see dashboard but can't go online
      return "/driver/map";

    case "restaurant":
      return "/restaurant";

    case "pending_restaurant":
      // Restaurant has submitted application, waiting for admin approval
      // Redirect to restaurant dashboard - they can see dashboard but can't go online
      return "/restaurant/dashboard";

    case "pending_ticket_operator":
      return "/ticket-operator/onboarding";

    case "pending_shop_partner":
      return "/shop-partner/onboarding";

    case "ticket_operator":
      if (countryCode !== "BD") {
        console.warn("[roleRedirect] ticket_operator role requires countryCode=BD, falling back to /customer");
        return "/customer";
      }
      if (verificationStatus === "approved") {
        return "/ticket-operator/dashboard";
      }
      if (verificationStatus === "rejected") {
        return "/ticket-operator/onboarding";
      }
      return "/ticket-operator/setup";

    case "shop_partner":
      if (countryCode !== "BD") {
        console.warn("[roleRedirect] shop_partner role requires countryCode=BD, falling back to /customer");
        return "/customer";
      }
      if (verificationStatus === "approved") {
        return "/shop-partner/dashboard";
      }
      if (verificationStatus === "rejected") {
        return "/shop-partner/onboarding";
      }
      return "/shop-partner/setup";

    default:
      console.warn(`[roleRedirect] Unknown role: ${role}, falling back to /customer`);
      return "/customer";
  }
}

/**
 * Check if a user has access to a specific route based on their role.
 * Pending roles can access their corresponding onboarding routes.
 */
export function canAccessRoute(user: UserForRedirect, routeRole: string): boolean {
  const { role, countryCode } = user;

  if (role === routeRole) {
    return true;
  }

  if (routeRole === "ticket_operator") {
    return (role === "ticket_operator" || role === "pending_ticket_operator") && countryCode === "BD";
  }

  if (routeRole === "shop_partner") {
    return (role === "shop_partner" || role === "pending_shop_partner") && countryCode === "BD";
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
