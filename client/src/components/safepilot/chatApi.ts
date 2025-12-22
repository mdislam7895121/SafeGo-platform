export type SafePilotRole = "CUSTOMER" | "DRIVER" | "RESTAURANT" | "ADMIN";
export type SafePilotService = "ride" | "food" | "parcel" | "ALL";

export interface SafePilotChatRequest {
  message: string;
  role: SafePilotRole;
  country?: "US" | "BD" | "GLOBAL";
  service?: SafePilotService;
  conversationId?: string;
  current_entity_id?: string | null;
  explain?: boolean;
}

export interface SafePilotChatResponse {
  reply: string;
  conversationId: string;
  sources?: Array<{ title: string; snippet: string }>;
  suggestedActions?: string[];
  toolsUsed?: string[];
  moderationFlags?: { inputFlagged: boolean; outputFlagged: boolean };
  rateLimitInfo?: { remaining: number; resetAt: string };
  emotion?: string;
  escalated?: { ticketId: string; ticketCode: string; reason: string };
  explanation?: {
    route: string;
    kbTitlesUsed?: string[];
    toolsExecuted?: string[];
    countryRulesApplied?: string;
    cacheHit?: boolean;
  };
}

export interface FetchResult {
  ok: boolean;
  status: number;
  text: string;
  json: SafePilotChatResponse | null;
  error?: string;
}

export async function safePilotChatFetch(
  url: string,
  body: SafePilotChatRequest
): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text().catch(() => "");
    let json: SafePilotChatResponse | null = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    return {
      ok: res.ok,
      status: res.status,
      text,
      json,
      error: !res.ok ? (json as any)?.error || `HTTP ${res.status}` : undefined,
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { ok: false, status: 0, text: "", json: null, error: "Request timed out" };
    }
    return { ok: false, status: 0, text: "", json: null, error: err.message || "Network error" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function postSafePilotChat(
  request: SafePilotChatRequest
): Promise<SafePilotChatResponse> {
  const result = await safePilotChatFetch("/api/safepilot/chat", request);

  if (!result.ok) {
    throw new Error(result.error || `Request failed with status ${result.status}`);
  }

  if (!result.json) {
    throw new Error("Invalid response from server");
  }

  return result.json;
}
