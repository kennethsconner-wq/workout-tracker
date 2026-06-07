import { getAuthRedirectUrl } from '@/lib/auth/authRedirect';
import { normalizeUsername, toAuthErrorMessage, validateUsername } from '@/lib/auth/authErrors';
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
    const { data, error } = await supabase.auth.signUp({
      email: params.email.trim(),
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
  await supabase.auth.signOut();
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
      redirectTo: getAuthRedirectUrl(),
    });
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
  await supabase.auth.getSession();
}

export async function updateUsername(username: string): Promise<AuthResult> {
  try {
    const usernameError = validateUsername(username);
    if (usernameError) {
      return { error: usernameError };
    }

    const supabase = requireSupabase();
    const { error } = await supabase.auth.updateUser({
      data: { display_name: normalizeUsername(username) },
    });
    return { error: error ? toAuthErrorMessage(error) : null };
  } catch (error) {
    return { error: toAuthErrorMessage(error as Error) };
  }
}
