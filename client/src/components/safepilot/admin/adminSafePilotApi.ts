const ADMIN_SAFEPILOT_ENDPOINT = '/api/admin/safepilot/query';

export interface AdminSafePilotResponse {
  reply: string;
  meta?: {
    type?: string;
    redirectTo?: string;
    [key: string]: any;
  };
  error?: string;
}

export async function sendAdminSafePilotQuery(query: string): Promise<AdminSafePilotResponse> {
  const response = await fetch(ADMIN_SAFEPILOT_ENDPOINT, {
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
