/**
 * API Configuration
 * Central source of truth for API URLs and settings
 */

const DEFAULT_API_BASE = "http://localhost:3000";

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE;

/**
 * Join base URL with path safely
 * - ensures a single slash between base and path
 * - rejects fully-qualified URLs in path
 */
export function apiUrl(path: string): string {
  if (!path) {
    throw new Error("[apiUrl] path is required");
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (normalizedPath.startsWith("http://") || normalizedPath.startsWith("https://")) {
    throw new Error("[apiUrl] path must be relative, not a full URL");
  }

  const cleanBase = API_BASE_URL.endsWith("/")
    ? API_BASE_URL.slice(0, -1)
    : API_BASE_URL;

  return `${cleanBase}${normalizedPath}`;
}

export const HEALTH_ENDPOINT = "/api/healthz";

// Common API paths (for reference)
export const API_PATHS = {
  auth: {
    login: "/api/auth/login",
    logout: "/api/auth/logout",
    register: "/api/auth/register",
  },
  customer: {
    profile: "/api/customer/profile",
    rides: "/api/customer/rides",
  },
  driver: {
    profile: "/api/driver/profile",
    earnings: "/api/driver/earnings",
  },
  admin: {
    users: "/api/admin/users",
  },
} as const;
