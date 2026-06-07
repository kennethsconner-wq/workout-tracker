import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Linking from 'expo-linking';

/** Deep link Supabase should redirect to after email confirm / password reset. */
export function getAuthRedirectUrl(): string {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    // Expo Go: exp://192.168.x.x:8081/--/auth/callback (Metro must be running when the link is opened)
    return Linking.createURL('/auth/callback');
  }

  // Dev/production builds: triple-slash avoids Android treating `auth` as the hostname.
  return Linking.createURL('/auth/callback', { isTripleSlashed: true });
}

function parseAuthParams(url: string): URLSearchParams {
  const hashIndex = url.indexOf('#');
  if (hashIndex >= 0) {
    return new URLSearchParams(url.slice(hashIndex + 1));
  }

  const queryIndex = url.indexOf('?');
  if (queryIndex >= 0) {
    return new URLSearchParams(url.slice(queryIndex + 1));
  }

  return new URLSearchParams();
}

export function isAuthCallbackUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('/auth/callback') ||
    lower.includes('auth/callback') ||
    lower.includes('access_token') ||
    lower.includes('refresh_token')
  );
}

export type AuthRedirectResult =
  | { ok: true; type: string | null }
  | { ok: false; error: string };

/** Exchange access/refresh tokens from a Supabase auth redirect URL for a session. */
export async function createSessionFromAuthRedirect(url: string): Promise<AuthRedirectResult> {
  const { getSupabaseClient } = await import('@/lib/supabase/client');
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: 'Supabase is not configured.' };
  }

  const params = parseAuthParams(url);
  const error = params.get('error');
  const errorDescription = params.get('error_description');
  if (error) {
    return { ok: false, error: errorDescription ?? error };
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) {
    return { ok: false, error: 'This confirmation link is missing auth tokens.' };
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError) {
    return { ok: false, error: sessionError.message };
  }

  return { ok: true, type: params.get('type') };
}
