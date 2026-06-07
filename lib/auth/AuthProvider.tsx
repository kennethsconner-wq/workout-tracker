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

import { createSessionFromAuthRedirect, isAuthCallbackUrl } from '@/lib/auth/authRedirect';

import {
  refreshSession,
  resendSignUpConfirmation,
  sendPasswordResetEmail,
  signInWithPassword,
  signOut as signOutFromSupabase,
  signUpWithPassword,
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

    void supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void supabase.auth.startAutoRefresh();
        void refreshSession();
        return;
      }
      supabase.auth.stopAutoRefresh();
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    const handleAuthRedirectUrl = (url: string) => {
      if (!isAuthCallbackUrl(url)) {
        return;
      }
      void createSessionFromAuthRedirect(url);
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
    }),
    [session, isLoading, isAuthBusy, signIn, signUp, signOut, resetPassword, resendConfirmation, updateUsername],
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
