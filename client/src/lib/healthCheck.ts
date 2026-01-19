import { buildApiUrl } from "./apiClient";
import { HEALTH_ENDPOINT } from "../config/api";

export interface HealthStatus {
  ok: boolean;
  service?: string;
  env?: string;
  ts?: string;
}

/**
 * Check backend health status
 * @returns Health status or null if unreachable
 */
export async function checkBackendHealth(): Promise<HealthStatus | null> {
  try {
    const url = buildApiUrl(HEALTH_ENDPOINT);
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (response.ok) {
      const data = await response.json();
      return data as HealthStatus;
    }

    return null;
  } catch (error) {
    console.error("[HealthCheck] Backend unreachable:", error);
    return null;
  }
}

/**
 * Verify backend connection on app startup
 * Logs result but does not block app
 */
export async function verifyBackendConnection(): Promise<void> {
  const health = await checkBackendHealth();

  if (health?.ok) {
    console.log(
      `[HealthCheck] ✓ Backend connected: ${health.service} (${health.env})`
    );
  } else {
    console.warn(
      "[HealthCheck] ⚠ Backend not responding. Some features may not work."
    );
  }
}
