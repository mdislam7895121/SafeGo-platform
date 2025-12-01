import { QueryClient, QueryFunction } from "@tanstack/react-query";

class ApiError extends Error {
  status: number;
  statusText: string;
  code?: string;

  constructor(status: number, statusText: string, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.code = code;
  }
}

// Token refresh state management
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

// Attempt to refresh the access token using the refresh token cookie
async function refreshAccessToken(): Promise<string | null> {
  // If already refreshing, wait for the existing promise
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        // Refresh failed - clear token and return null
        localStorage.removeItem("safego_token");
        return null;
      }

      const data = await res.json();
      if (data.token) {
        localStorage.setItem("safego_token", data.token);
        return data.token;
      }
      return null;
    } catch (error) {
      console.error("Token refresh failed:", error);
      localStorage.removeItem("safego_token");
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    let code: string | undefined;
    try {
      const errorData = JSON.parse(text);
      code = errorData.code;
      
      if (code === "ACCOUNT_LOCKED") {
        window.dispatchEvent(new CustomEvent("safego:account-locked", {
          detail: { message: errorData.error || "Your account is locked" }
        }));
      }
    } catch {
    }
    
    const error = new ApiError(res.status, res.statusText, `${res.status}: ${text}`, code);
    throw error;
  }
}

// Core fetch function with automatic token refresh
async function fetchWithAuth(
  url: string,
  options?: RequestInit,
  retryOnUnauthorized = true
): Promise<Response> {
  const token = localStorage.getItem("safego_token");
  const headers: HeadersInit = { ...options?.headers };
  
  if (token) {
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  // If unauthorized and we have a token, try to refresh
  if (res.status === 401 && retryOnUnauthorized && token) {
    const newToken = await refreshAccessToken();
    
    if (newToken) {
      // Retry the request with the new token
      (headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
      return fetch(url, {
        ...options,
        headers,
        credentials: "include",
      });
    }
  }

  return res;
}

export async function apiRequest(
  url: string,
  options?: RequestInit & { method?: string; body?: string | FormData | BodyInit; headers?: HeadersInit },
): Promise<any> {
  const res = await fetchWithAuth(url, options);

  await throwIfResNotOk(res);
  
  // For DELETE requests or empty responses, return null
  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    return null;
  }
  
  return await res.json();
}

/**
 * Upload a file with proper authentication and token refresh handling.
 * This should be used for all file uploads to prevent "Access token required" errors
 * during long uploads or when tokens expire mid-upload.
 * 
 * @param url - The upload endpoint URL
 * @param formData - FormData containing the file and any additional fields
 * @returns The parsed JSON response
 */
export async function uploadWithAuth(url: string, formData: FormData): Promise<any> {
  // Proactively refresh token if we're close to expiry (within 2 minutes)
  // This prevents token expiration during long file uploads
  const token = localStorage.getItem("safego_token");
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresIn = payload.exp * 1000 - Date.now();
      // If token expires within 2 minutes, refresh it first
      if (expiresIn < 120000) {
        await refreshAccessToken();
      }
    } catch (e) {
      // Invalid token format, proceed anyway - the request will fail and trigger refresh
    }
  }

  // Now perform the upload with authentication
  const res = await fetchWithAuth(url, {
    method: "POST",
    body: formData,
    // Don't set Content-Type - browser will set it with boundary for FormData
  });

  await throwIfResNotOk(res);
  
  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    return null;
  }
  
  return await res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetchWithAuth(queryKey.join("/") as string, {});

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * Shared capability fetcher for admin pages
 * Uses apiRequest to ensure proper error status propagation and RBAC enforcement
 */
export async function fetchAdminCapabilities(token: string | null): Promise<{ capabilities: string[] }> {
  if (!token) {
    throw new Error("No authentication token provided");
  }

  const res = await fetchWithAuth("/api/admin/capabilities", {
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const error: any = new Error(`${res.status}: ${text}`);
    error.status = res.status;
    throw error;
  }

  return res.json();
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
