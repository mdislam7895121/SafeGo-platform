import { apiUrl, HEALTH_ENDPOINT } from "../config/api";

export interface HealthStatus {
  ok: boolean;
  status: number;
  data?: any;
  error?: string;
}

/**
 * Check backend health status (graceful on failure)
 */
export async function checkApiHealth(): Promise<HealthStatus> {
  const url = apiUrl(HEALTH_ENDPOINT);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const data = isJson ? await response.json() : undefined;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: data?.error || data?.message || response.statusText,
        data,
      };
    }

    return { ok: true, status: response.status, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
