import type { EmailOtpType } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/lib/supabase/client';

/** Parse hash and query auth params from a deep link URL string. */
export function parseSupabaseAuthParams(url: string): URLSearchParams {
  const params = new URLSearchParams();

  const hashIndex = url.indexOf('#');
  if (hashIndex >= 0) {
    new URLSearchParams(url.slice(hashIndex + 1)).forEach((value, key) => {
      params.set(key, value);
    });
  }

  const queryIndex = url.indexOf('?');
  if (queryIndex >= 0) {
    const queryEnd = hashIndex >= 0 ? hashIndex : url.length;
    new URLSearchParams(url.slice(queryIndex + 1, queryEnd)).forEach((value, key) => {
      params.set(key, value);
    });
  }

  return params;
}

export type AuthRedirectResult =
  | { ok: true; type: string | null }
  | { ok: false; error: string };

function toEmailOtpType(type: string | null): EmailOtpType {
  switch (type) {
    case 'signup':
    case 'invite':
    case 'magiclink':
    case 'recovery':
    case 'email_change':
    case 'email':
      return type;
    default:
      return 'email';
  }
}

/** Exchange tokens/code from a Supabase auth redirect URL for a session. */
export async function createSessionFromAuthRedirect(url: string): Promise<AuthRedirectResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: 'Supabase is not configured.' };
  }

  const params = parseSupabaseAuthParams(url);
  const error = params.get('error');
  const errorDescription = params.get('error_description');
  if (error) {
    return { ok: false, error: errorDescription ?? error };
  }

  const code = params.get('code');
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return { ok: false, error: exchangeError.message };
    }
    return { ok: true, type: params.get('type') };
  }

  const tokenHash = params.get('token_hash');
  if (tokenHash) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: toEmailOtpType(params.get('type')),
    });
    if (verifyError) {
      return { ok: false, error: verifyError.message };
    }
    return { ok: true, type: params.get('type') };
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) {
      return { ok: false, error: sessionError.message };
    }
    return { ok: true, type: params.get('type') };
  }

  return { ok: false, error: 'This confirmation link is missing auth tokens.' };
}

function buildSyntheticAuthUrlFromParams(
  routePath: '/auth/callback' | '/auth/reset-password',
  params: Record<string, string | string[] | undefined>,
): string | null {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (key === '#') {
      continue;
    }
    const resolved = Array.isArray(value) ? value[0] : value;
    if (resolved) {
      search.set(key, resolved);
    }
  }

  const hashPayload = params['#'];
  const hashValue = Array.isArray(hashPayload) ? hashPayload[0] : hashPayload;
  if (hashValue) {
    return `workouttracker://${routePath}#${hashValue}`;
  }

  const query = search.toString();
  return query ? `workouttracker://${routePath}?${query}` : null;
}

/** Build a synthetic callback URL from Expo Router search params (after +native-intent rewrite). */
export function buildAuthCallbackUrlFromParams(
  params: Record<string, string | string[] | undefined>,
): string | null {
  return buildSyntheticAuthUrlFromParams('/auth/callback', params);
}

/** Build a synthetic reset-password URL from Expo Router search params. */
export function buildPasswordResetUrlFromParams(
  params: Record<string, string | string[] | undefined>,
): string | null {
  return buildSyntheticAuthUrlFromParams('/auth/reset-password', params);
}
