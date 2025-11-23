import { QueryClient, QueryFunction } from "@tanstack/react-query";

class ApiError extends Error {
  status: number;
  statusText: string;

  constructor(status: number, statusText: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const error = new ApiError(res.status, res.statusText, `${res.status}: ${text}`);
    throw error;
  }
}

export async function apiRequest(
  url: string,
  options?: RequestInit & { method?: string; body?: string | FormData | BodyInit; headers?: HeadersInit },
): Promise<any> {
  const token = localStorage.getItem("safego_token");
  const headers: HeadersInit = { ...options?.headers };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  // For DELETE requests or empty responses, return null
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
    const token = localStorage.getItem("safego_token");
    const headers: HeadersInit = {};
    
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(queryKey.join("/") as string, {
      headers,
      credentials: "include",
    });

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

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch("/api/admin/capabilities", {
    headers,
    credentials: "include",
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
