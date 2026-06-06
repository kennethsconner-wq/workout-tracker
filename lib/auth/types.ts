import type { Session, User } from '@supabase/supabase-js';

export type AuthUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string | null;
};

export type AuthContextValue = {
  session: Session | null;
  user: AuthUser | null;
  isSignedIn: boolean;
  isLoading: boolean;
  isConfigured: boolean;
};

export function toAuthUser(user: User | null | undefined): AuthUser | null {
  if (!user) {
    return null;
  }

  const metadata = user.user_metadata ?? {};
  const displayName =
    typeof metadata.display_name === 'string'
      ? metadata.display_name
      : typeof metadata.full_name === 'string'
        ? metadata.full_name
        : null;

  return {
    id: user.id,
    email: user.email ?? null,
    displayName,
    createdAt: user.created_at ?? null,
  };
}
