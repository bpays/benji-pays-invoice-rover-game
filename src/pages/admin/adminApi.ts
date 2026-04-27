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

export async function restApi(
  method: 'GET' | 'PATCH' | 'POST',
  table: string,
  body: Record<string, unknown> | null,
  params: string
): Promise<unknown[] | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token || SUPA_KEY;
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

async function callInviteEdgeFn(
  postBody: Record<string, unknown>,
  accessToken: string
): Promise<Record<string, unknown>> {
  const res = await fetch(`${SUPA_URL}/functions/v1/admin-invite`, {
    method: 'POST',
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(postBody),
  });
  return res.json() as Promise<Record<string, unknown>>;
}

export async function inviteEdgeFn(postBody: Record<string, unknown>): Promise<Record<string, unknown>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { error: 'Not signed in' };

  let result = await callInviteEdgeFn(postBody, session.access_token);

  // If server reports stale aal claim, refresh the session and retry once.
  if (typeof result?.error === 'string' && /MFA \(aal2\) required/i.test(result.error)) {
    try {
      const { data: refreshed } = await supabase.auth.refreshSession();
      const newToken = refreshed?.session?.access_token;
      if (newToken) {
        result = await callInviteEdgeFn(postBody, newToken);
      }
    } catch (e) {
      console.warn('inviteEdgeFn refresh+retry failed', e);
    }
  }

  return result;
}
