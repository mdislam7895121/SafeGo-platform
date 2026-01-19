/// <reference types="vite/client" />

/**
 * Centralized API client for SafeGo
 * Ensures all API calls use a consistent, safe URL construction pattern
 * Uses VITE_API_BASE_URL environment variable for the base URL
 */
import { API_BASE_URL, apiUrl } from "../config/api";

/**
 * Build a safe API URL by joining base + path
 * @param path - The API path (must start with /)
 * @returns Complete API URL
 * @throws Error if path contains full URL
 */
export function buildApiUrl(path: string): string {
  // If base URL is empty, default to relative paths (dev proxy)
  if (!API_BASE_URL) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return normalizedPath;
  }

  return apiUrl(path);
}

/**
 * Fetch with automatic API URL construction and JSON parsing
 * @param path - API path (e.g., /api/auth/login)
 * @param options - Fetch options
 * @returns Parsed JSON response
 * @throws Error if response is not JSON or if fetch fails
 */
export async function apiFetch(
  path: string,
  options?: RequestInit
): Promise<any> {
  const url = buildApiUrl(path);

  // Ensure Content-Type is set for JSON requests
  const headers = {
    "Content-Type": "application/json",
    ...options?.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Check if response is OK
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      // Try to parse error body as JSON
      try {
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const errorBody = await response.json();
          errorMessage = errorBody.error || errorBody.message || errorMessage;
        } else if (contentType?.includes("text/html")) {
          // API returned HTML (likely 404 or error page)
          throw new Error(
            `API returned HTML instead of JSON. Status: ${response.status}. This may indicate an incorrect API path or backend not responding as expected.`
          );
        }
      } catch (e) {
        // If error parsing fails, use generic message
        if (e instanceof Error && e.message.includes("HTML")) {
          throw e;
        }
      }

      throw new Error(errorMessage);
    }

    // Parse response text first to check for HTML
    const responseText = await response.text();

    // If response starts with <, it's HTML (error page)
    if (responseText.trim().startsWith("<")) {
      throw new Error(
        `[apiFetch] API returned HTML instead of JSON. This typically means the endpoint is not found or the server is not responding correctly. Path: ${path}, Status: ${response.status}`
      );
    }

    // If response is empty, return null
    if (!responseText.trim()) {
      return null;
    }

    // Parse as JSON
    try {
      return JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(
        `[apiFetch] Invalid JSON response from ${path}. First 200 chars: ${responseText.substring(
          0,
          200
        )}`
      );
    }
  } catch (error) {
    // Log detailed error in dev mode
    if (import.meta.env.DEV) {
      console.error("[apiFetch] Error:", {
        path,
        url,
        error: error instanceof Error ? error.message : error,
      });
    }
    throw error;
  }
}
