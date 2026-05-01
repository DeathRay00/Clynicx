/**
 * JWT Auth Client
 * Replaces the former Supabase client with a simple JWT token manager.
 * Tokens are stored in localStorage and sent as Bearer headers to the
 * Node.js + Express + PostgreSQL backend.
 */

const TOKEN_KEY = 'healthcare-portal-auth-token';

// ── Token storage helpers ─────────────────────────────────────────────────────

export const saveToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

// ── Backward-compat shim (used in AuthContext) ────────────────────────────────
// These stubs keep the rest of the codebase from crashing while we migrate.

export const getSupabaseClient = () => {
  console.warn('getSupabaseClient is deprecated. Use JWT token helpers instead.');
  return null as unknown as ReturnType<any>;
};

export const resetSupabaseClient = (): void => {
  clearToken();
};

// No-op export kept so existing imports don't break.
export const supabase = null as any;

// Re-export token header builder for convenience
export const buildAuthHeader = (): Record<string, string> => {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};
