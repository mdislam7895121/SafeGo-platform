/**
 * API Configuration
 * Central source of truth for API URLs and settings
 */

interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
}

function getApiConfig(): ApiConfig {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;

  // Validation: ensure baseUrl is set
  if (!baseUrl) {
    console.warn(
      "[API Config] VITE_API_BASE_URL is not set. Using relative paths."
    );
  }

  // Validation: warn if using localhost in production
  if (import.meta.env.PROD && baseUrl?.includes("localhost")) {
    console.error(
      "[API Config] WARNING: Using localhost in production build! This will not work."
    );
  }

  return {
    baseUrl: baseUrl || "",
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
  };
}

export const API_CONFIG = getApiConfig();

// Health check endpoint
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
