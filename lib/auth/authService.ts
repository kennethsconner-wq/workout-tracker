import type { Session } from '@supabase/supabase-js';

import { getAuthRedirectUrl, getPasswordResetRedirectUrl } from '@/lib/auth/authRedirect';
import {
  mapAvailabilityError,
  normalizeUsername,
  toAuthErrorMessage,
  validatePassword,
  validateUsername,
} from '@/lib/auth/authErrors';
import {
  isEmailAvailable,
  isUsernameAvailable,
  updateProfileUsername,
} from '@/lib/auth/profileAvailability';
import { getSupabaseClient } from '@/lib/supabase/client';

export type SignUpParams = {
  email: string;
  password: string;
  username: string;
};

export type AuthResult = {
  error: string | null;
};

export type SignUpResult = AuthResult & {
  needsEmailConfirmation: boolean;
};

function requireSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
  return supabase;
}

function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const authError = error as { code?: string; message?: string };
  const code = authError.code?.toLowerCase() ?? '';
  const message = authError.message?.toLowerCase() ?? '';

  return (
    code === 'refresh_token_not_found' ||
    message.includes('invalid refresh token') ||
    message.includes('refresh token not found')
  );
}

/** Drop a cached session that Supabase can no longer refresh (e.g. after password reset). */
export async function clearLocalAuthSession(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Storage may already be empty.
  }
}

/** Load the persisted session, clearing storage when the refresh token is no longer valid. */
export async function loadStoredSession(): Promise<Session | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    if (isInvalidRefreshTokenError(error)) {
      await clearLocalAuthSession();
      return null;
    }
    return data.session;
  }

  return data.session;
}

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  try {
    const supabase = requireSupabase();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error: error ? toAuthErrorMessage(error) : null };
  } catch (error) {
    return { error: toAuthErrorMessage(error as Error) };
  }
}

export async function signUpWithPassword(params: SignUpParams): Promise<SignUpResult> {
  try {
    const usernameError = validateUsername(params.username);
    if (usernameError) {
      return { error: usernameError, needsEmailConfirmation: false };
    }

    const supabase = requireSupabase();
    const username = normalizeUsername(params.username);
    const trimmedEmail = params.email.trim();

    const emailAvailable = await isEmailAvailable(trimmedEmail);
    if (emailAvailable === false) {
      return { error: mapAvailabilityError('email'), needsEmailConfirmation: false };
    }

    const usernameAvailable = await isUsernameAvailable(username);
    if (usernameAvailable === false) {
      return { error: mapAvailabilityError('username'), needsEmailConfirmation: false };
    }

    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password: params.password,
      options: {
        data: { display_name: username },
        emailRedirectTo: getAuthRedirectUrl(),
      },
    });

    if (error) {
      return { error: toAuthErrorMessage(error), needsEmailConfirmation: false };
    }

    const needsEmailConfirmation = data.session == null && data.user != null;
    return { error: null, needsEmailConfirmation };
  } catch (error) {
    return { error: toAuthErrorMessage(error as Error), needsEmailConfirmation: false };
  }
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  const { error } = await supabase.auth.signOut();
  if (error && isInvalidRefreshTokenError(error)) {
    await clearLocalAuthSession();
  }
}

export async function resendSignUpConfirmation(email: string): Promise<AuthResult> {
  try {
    const supabase = requireSupabase();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: getAuthRedirectUrl() },
    });
    return { error: error ? toAuthErrorMessage(error) : null };
  } catch (error) {
    return { error: toAuthErrorMessage(error as Error) };
  }
}

export async function sendPasswordResetEmail(email: string): Promise<AuthResult> {
  try {
    const supabase = requireSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getPasswordResetRedirectUrl(),
    });
    return { error: error ? toAuthErrorMessage(error) : null };
  } catch (error) {
    return { error: toAuthErrorMessage(error as Error) };
  }
}

export async function updatePassword(password: string): Promise<AuthResult> {
  try {
    const passwordError = validatePassword(password);
    if (passwordError) {
      return { error: passwordError };
    }

    const supabase = requireSupabase();
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error ? toAuthErrorMessage(error) : null };
  } catch (error) {
    return { error: toAuthErrorMessage(error as Error) };
  }
}

export async function refreshSession(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  const { error } = await supabase.auth.getSession();
  if (error && isInvalidRefreshTokenError(error)) {
    await clearLocalAuthSession();
  }
}

export async function updateUsername(username: string): Promise<AuthResult> {
  try {
    const usernameError = validateUsername(username);
    if (usernameError) {
      return { error: usernameError };
    }

    const supabase = requireSupabase();
    const normalized = normalizeUsername(username);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const usernameAvailable = await isUsernameAvailable(normalized, user?.id);
    if (usernameAvailable === false) {
      return { error: mapAvailabilityError('username') };
    }

    await updateProfileUsername(normalized);

    const { error } = await supabase.auth.updateUser({
      data: { display_name: normalized },
    });
    return { error: error ? toAuthErrorMessage(error) : null };
  } catch (error) {
    return { error: toAuthErrorMessage(error as Error) };
  }
}
