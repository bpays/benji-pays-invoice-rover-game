import { supabase } from '../../integrations/supabase/client';

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export { SUPA_URL, SUPA_KEY };

export function getTotpFactors(factorData: {
  totp?: { id: string; status: string; factor_type: string }[];
  all?: { id: string; status: string; factor_type: string }[];
}): { id: string; status: string; factor_type: string }[] {
  const direct = Array.isArray(factorData?.totp) ? factorData.totp : [];
  const fromAll = (Array.isArray(factorData?.all) ? factorData.all : []).filter((f) => f.factor_type === 'totp');
  const merged = [...direct] as { id: string; status: string; factor_type: string }[];
  fromAll.forEach((f) => {
    if (!merged.some((existing) => existing.id === f.id)) merged.push(f);
  });
  return merged;
}

function decodeJwtAal(token: string | undefined | null): string | null {
  if (!token) return null;
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const claims = JSON.parse(atob(padded));
    return typeof claims?.aal === 'string' ? claims.aal : null;
  } catch {
    return null;
  }
}

/**
 * Returns a fresh access token whose JWT `aal` claim is `aal2` if at all possible.
 * If the cached session token still says `aal1` after the user has actually
 * verified MFA, we proactively refresh once so downstream calls don't 403.
 */
export async function ensureAal2Token(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const currentAal = decodeJwtAal(session.access_token);
  if (currentAal === 'aal2') return session.access_token;
  try {
    const { data: refreshed } = await supabase.auth.refreshSession();
    return refreshed?.session?.access_token ?? session.access_token;
  } catch {
    return session.access_token;
  }
}

export async function restApi(
  method: 'GET' | 'PATCH' | 'POST',
  table: string,
  body: Record<string, unknown> | null,
  params: string
): Promise<unknown[] | null> {
  const token = (await ensureAal2Token()) || SUPA_KEY;
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${params}`, {
    method,
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.ok ? ((await res.json()) as unknown[]) : null;
}

function isStaleAalError(payload: unknown, status?: number): boolean {
  if (status === 403) {
    const errMsg = (payload as { error?: unknown })?.error;
    if (typeof errMsg === 'string' && /MFA \(aal2\) required/i.test(errMsg)) return true;
  }
  return false;
}

/**
 * POST to a Supabase edge function with automatic refresh+retry once if the
 * server reports `MFA (aal2) required` (i.e. the cached JWT still claims aal1).
 */
export async function callEdgeFnWithMfaRetry(
  fnName: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const send = async (token: string) => {
    const res = await fetch(`${SUPA_URL}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    let data: Record<string, unknown> = {};
    try { data = (await res.json()) as Record<string, unknown>; } catch { /* ignore */ }
    return { ok: res.ok, status: res.status, data };
  };

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, status: 401, data: { error: 'Not signed in' } };

  let result = await send(session.access_token);
  if (isStaleAalError(result.data, result.status)) {
    try {
      const { data: refreshed } = await supabase.auth.refreshSession();
      const newToken = refreshed?.session?.access_token;
      if (newToken) result = await send(newToken);
    } catch (e) {
      console.warn(`callEdgeFnWithMfaRetry(${fnName}) refresh+retry failed`, e);
    }
  }
  return result;
}

export async function inviteEdgeFn(postBody: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = await callEdgeFnWithMfaRetry('admin-invite', postBody);
  return result.data;
}
