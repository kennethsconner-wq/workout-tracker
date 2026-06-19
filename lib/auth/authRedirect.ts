import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Linking from 'expo-linking';

import { parseSupabaseAuthParams } from '@/lib/auth/processAuthRedirect';

function createAuthDeepLink(path: string): string {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    // Expo Go: exp://192.168.x.x:8081/--/auth/... (Metro must be running when the link is opened)
    return Linking.createURL(path);
  }

  // Dev/production builds: triple-slash avoids Android treating `auth` as the hostname.
  return Linking.createURL(path, { isTripleSlashed: true });
}

/** Deep link Supabase should redirect to after email confirmation. */
export function getAuthRedirectUrl(): string {
  return createAuthDeepLink('/auth/callback');
}

/** Deep link Supabase should redirect to after a password reset email is opened. */
export function getPasswordResetRedirectUrl(): string {
  return createAuthDeepLink('/auth/reset-password');
}

export function isPasswordResetRedirectUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.includes('/auth/reset-password') || lower.includes('auth/reset-password')) {
    return true;
  }

  return parseSupabaseAuthParams(url).get('type') === 'recovery';
}

export function isAuthCallbackUrl(url: string): boolean {
  if (isPasswordResetRedirectUrl(url)) {
    return false;
  }

  const lower = url.toLowerCase();
  return (
    lower.includes('/auth/callback') ||
    lower.includes('auth/callback') ||
    lower.includes('access_token') ||
    lower.includes('refresh_token') ||
    lower.includes('token_hash') ||
    lower.includes('code=')
  );
}

export function isSupabaseAuthRedirectUrl(url: string): boolean {
  return isPasswordResetRedirectUrl(url) || isAuthCallbackUrl(url);
}

export {
  buildAuthCallbackUrlFromParams,
  buildPasswordResetUrlFromParams,
  createSessionFromAuthRedirect,
  parseSupabaseAuthParams,
  type AuthRedirectResult,
} from '@/lib/auth/processAuthRedirect';
