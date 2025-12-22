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

// Universal response normalizer for any SafePilot response shape
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyJson = any;

export function normalizeSafePilotReply(payload: AnyJson): string {
  if (!payload) return "No payload returned.";

  // Common direct fields
  const direct =
    payload.reply ??
    payload.response ??
    payload.message ??
    payload.text ??
    payload.answer ??
    payload.answerText;

  if (typeof direct === "string" && direct.trim()) return direct;

  // Mode-based responses (e.g., mode: "ASK")
  const mode = payload.mode ?? payload.data?.mode;
  if (mode === "ASK") {
    const q =
      payload.question ??
      payload.followup_question ??
      payload.prompt ??
      payload.data?.question ??
      payload.data?.followup_question;
    if (typeof q === "string" && q.trim()) return q;
    
    // Check summary array for ASK mode
    if (Array.isArray(payload.summary) && payload.summary.length > 0) {
      return payload.summary.join("\n");
    }
    
    return "I need more details to answer. Please provide the missing info.";
  }

  // Summary field (string or array)
  const summary =
    payload.summary ??
    payload.result?.summary ??
    payload.data?.summary;

  if (typeof summary === "string" && summary.trim()) return summary;
  if (Array.isArray(summary) && summary.length > 0) {
    return summary.join("\n");
  }

  // Key signals fallback
  if (Array.isArray(payload.keySignals) && payload.keySignals.length > 0) {
    return "Key Signals:\n" + payload.keySignals.map((s: string) => `• ${s}`).join("\n");
  }

  // Last resort: show raw JSON so nothing is blank
  try {
    const raw = JSON.stringify(payload, null, 2);
    return "Response:\n" + raw.slice(0, 2000) + (raw.length > 2000 ? "\n...[truncated]" : "");
  } catch {
    return "Response received (unable to display).";
  }
}

// Admin SafePilot query helper
export interface AdminSafePilotQueryRequest {
  pageKey: string;
  question: string;
  role?: "ADMIN";
}

export interface AdminQueryResult {
  ok: boolean;
  status: number;
  text: string;
  json: AnyJson;
  normalizedReply: string;
  error?: string;
}

export async function postAdminSafePilotQuery(
  body: AdminSafePilotQueryRequest
): Promise<AdminQueryResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch("/api/admin/safepilot/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ...body, role: "ADMIN" }),
      signal: controller.signal,
    });

    const text = await res.text().catch(() => "");
    let json: AnyJson = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    const normalizedReply = res.ok
      ? normalizeSafePilotReply(json)
      : json?.error || `Request failed (HTTP ${res.status})`;

    return {
      ok: res.ok,
      status: res.status,
      text,
      json,
      normalizedReply,
      error: !res.ok ? (json?.error || `HTTP ${res.status}`) : undefined,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (error.name === "AbortError") {
      return { ok: false, status: 0, text: "", json: null, normalizedReply: "Request timed out", error: "Request timed out" };
    }
    return { ok: false, status: 0, text: "", json: null, normalizedReply: error.message, error: error.message };
  } finally {
    clearTimeout(timeout);
  }
}
