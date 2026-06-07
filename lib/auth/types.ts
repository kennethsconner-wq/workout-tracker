import type { Session, User } from '@supabase/supabase-js';

import type { AuthResult, SignUpResult } from '@/lib/auth/authService';

export type AuthUser = {
  id: string;
  email: string | null;
  username: string | null;
  createdAt: string | null;
};

export type AuthContextValue = {
  session: Session | null;
  user: AuthUser | null;
  isSignedIn: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  isAuthBusy: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (params: { email: string; password: string; username: string }) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResult>;
  resendSignUpConfirmation: (email: string) => Promise<AuthResult>;
  updateUsername: (username: string) => Promise<AuthResult>;
};

export function toAuthUser(user: User | null | undefined): AuthUser | null {
  if (!user) {
    return null;
  }

  const metadata = user.user_metadata ?? {};
  const username =
    typeof metadata.display_name === 'string' && metadata.display_name.trim()
      ? metadata.display_name.trim()
      : typeof metadata.full_name === 'string' && metadata.full_name.trim()
        ? metadata.full_name.trim()
        : null;

  return {
    id: user.id,
    email: user.email ?? null,
    username,
    createdAt: user.created_at ?? null,
  };
}
