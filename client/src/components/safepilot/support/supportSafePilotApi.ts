const SUPPORT_SAFEPILOT_ENDPOINT = '/api/support/safepilot/query';

export interface SupportSafePilotResponse {
  reply: string;
  meta?: {
    type?: string;
    redirectTo?: string;
    [key: string]: any;
  };
  error?: string;
}

export async function sendSupportSafePilotQuery(query: string): Promise<SupportSafePilotResponse> {
  const response = await fetch(SUPPORT_SAFEPILOT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ query }),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    return {
      reply: data.reply || data.error || `Error ${response.status}: Request failed`,
      error: data.error || `HTTP ${response.status}`,
    };
  }
  
  return {
    reply: data.reply || 'No response received.',
    meta: data.meta,
  };
}
