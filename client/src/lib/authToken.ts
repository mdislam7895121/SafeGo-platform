const CANONICAL_TOKEN_KEY = "safego_token";
const LEGACY_TOKEN_KEYS = ["token", "auth_token"];

export function getAuthToken(): string | null {
  return localStorage.getItem(CANONICAL_TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem(CANONICAL_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(CANONICAL_TOKEN_KEY);
  }
}

export function clearAllLegacyTokens(): void {
  localStorage.removeItem(CANONICAL_TOKEN_KEY);
  for (const key of LEGACY_TOKEN_KEYS) {
    localStorage.removeItem(key);
  }
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}
