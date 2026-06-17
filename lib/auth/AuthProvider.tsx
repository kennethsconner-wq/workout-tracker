import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { createSessionFromAuthRedirect, isPasswordResetRedirectUrl, isSupabaseAuthRedirectUrl } from '@/lib/auth/authRedirect';
import { markAccountOnboardingDismissed } from '@/lib/auth/accountOnboardingStorage';
import { authEventShouldTriggerSync, triggerCloudSyncAfterAuth } from '@/lib/auth/triggerCloudSync';

import {
  loadStoredSession,
  refreshSession,
  resendSignUpConfirmation,
  sendPasswordResetEmail,
  signInWithPassword,
  signOut as signOutFromSupabase,
  signUpWithPassword,
  updatePassword as updatePasswordInSupabase,
  updateUsername as updateUsernameInSupabase,
} from '@/lib/auth/authService';
import { toAuthUser, type AuthContextValue } from '@/lib/auth/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { syncEngine } from '@/lib/sync/syncEngine';

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured());
  const [isAuthBusy, setIsAuthBusy] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    let hasBootstrappedSession = false;

    const triggerCloudSync = triggerCloudSyncAfterAuth;

    const bootstrapSession = async () => {
      const nextSession = await loadStoredSession();
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setIsLoading(false);
      hasBootstrappedSession = true;

      if (nextSession) {
        void syncEngine.hydrateStatus();
        triggerCloudSync(nextSession.user.id);
      }

      if (AppState.currentState === 'active' && nextSession) {
        supabase.auth.startAutoRefresh();
      }
    };

    void bootstrapSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);

      if (authEventShouldTriggerSync(event) && nextSession) {
        triggerCloudSync(nextSession.user.id);
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (AppState.currentState === 'active') {
          supabase.auth.startAutoRefresh();
        }
      }

      if (event === 'SIGNED_OUT') {
        supabase.auth.stopAutoRefresh();
      }
    });

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        if (!hasBootstrappedSession) {
          return;
        }
        supabase.auth.startAutoRefresh();
        void refreshSession().then(() => syncEngine.syncNow());
        return;
      }
      supabase.auth.stopAutoRefresh();
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    const handleAuthRedirectUrl = (url: string) => {
      if (!isSupabaseAuthRedirectUrl(url)) {
        return;
      }

      const isRecovery = isPasswordResetRedirectUrl(url);
      void createSessionFromAuthRedirect(url).then((result) => {
        if (!result.ok) {
          return;
        }

        if (isRecovery || result.type === 'recovery') {
          void supabase.auth.getSession().then(({ data }) => {
            triggerCloudSync(data.session?.user.id);
          });
          return;
        }

        void markAccountOnboardingDismissed();
        void supabase.auth.getSession().then(({ data }) => {
          if (data.session?.user.id) {
            triggerCloudSync(data.session.user.id);
          }
        });
      });
    };

    void Linking.getInitialURL().then((url) => {
      if (url) {
        handleAuthRedirectUrl(url);
      }
    });

    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      handleAuthRedirectUrl(url);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
      appStateSubscription.remove();
      linkingSubscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setIsAuthBusy(true);
    try {
      return await signInWithPassword(email, password);
    } finally {
      setIsAuthBusy(false);
    }
  }, []);

  const signUp = useCallback(async (params: { email: string; password: string; username: string }) => {
    setIsAuthBusy(true);
    try {
      return await signUpWithPassword(params);
    } finally {
      setIsAuthBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsAuthBusy(true);
    try {
      await signOutFromSupabase();
      syncEngine.reset();
    } finally {
      setIsAuthBusy(false);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setIsAuthBusy(true);
    try {
      return await sendPasswordResetEmail(email);
    } finally {
      setIsAuthBusy(false);
    }
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    setIsAuthBusy(true);
    try {
      return await resendSignUpConfirmation(email);
    } finally {
      setIsAuthBusy(false);
    }
  }, []);

  const updateUsername = useCallback(async (username: string) => {
    setIsAuthBusy(true);
    try {
      return await updateUsernameInSupabase(username);
    } finally {
      setIsAuthBusy(false);
    }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    setIsAuthBusy(true);
    try {
      return await updatePasswordInSupabase(password);
    } finally {
      setIsAuthBusy(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: toAuthUser(session?.user),
      isSignedIn: session != null,
      isLoading,
      isConfigured: isSupabaseConfigured(),
      isAuthBusy,
      signIn,
      signUp,
      signOut,
      resetPassword,
      resendSignUpConfirmation: resendConfirmation,
      updateUsername,
      updatePassword,
    }),
    [session, isLoading, isAuthBusy, signIn, signUp, signOut, resetPassword, resendConfirmation, updateUsername, updatePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
