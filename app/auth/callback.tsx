import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { AuthRedirectListener } from '@/components/auth/AuthRedirectListener';
import { Text, View } from '@/components/Themed';
import { stackHeaderHideIosBackLabel } from '@/constants/stackHeader';
import { useAuth } from '@/lib/auth/AuthProvider';
import { navigateAfterAuth, navigateToResetPassword } from '@/lib/auth/navigateAfterAuth';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    access_token?: string | string[];
    refresh_token?: string | string[];
    code?: string | string[];
    token_hash?: string | string[];
    type?: string | string[];
    '#': string | string[];
  }>();
  const { isSignedIn, isLoading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading && isSignedIn) {
      const typeParam = Array.isArray(params.type) ? params.type[0] : params.type;
      if (typeParam === 'recovery') {
        navigateToResetPassword(router);
        return;
      }

      navigateAfterAuth(router);
    }
  }, [isLoading, isSignedIn, params.type, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isSignedIn) {
        setTimedOut(true);
      }
    }, 12000);
    return () => clearTimeout(timer);
  }, [isSignedIn]);

  return (
    <>
      <AuthRedirectListener params={params} />
      <Stack.Screen
        options={{
          title: 'Confirm email',
          headerShown: false,
          ...stackHeaderHideIosBackLabel,
        }}
      />
      <View style={styles.screen}>
        {timedOut && !isSignedIn ? (
          <>
            <Text style={styles.title}>Could not finish sign-in</Text>
            <Text style={styles.copy}>
              Open the confirmation link on the same device where you signed up, with the app installed. If it still
              fails, try signing in from Settings → Account with your email and password.
            </Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color="#23D5D5" />
            <Text style={styles.copy}>Finishing sign-in…</Text>
          </>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  copy: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
});
