import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { stackHeaderHideIosBackLabel } from '@/constants/stackHeader';
import { useAuth } from '@/lib/auth/AuthProvider';
import { createSessionFromAuthRedirect } from '@/lib/auth/authRedirect';
import { navigateAfterAuth } from '@/lib/auth/navigateAfterAuth';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    access_token?: string | string[];
    refresh_token?: string | string[];
    '#': string | string[];
  }>();
  const { isSignedIn, isLoading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const accessToken = firstParam(params.access_token);
    const refreshToken = firstParam(params.refresh_token);
    const hashPayload = firstParam(params['#']);

    if (accessToken && refreshToken) {
      const query = new URLSearchParams({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      void createSessionFromAuthRedirect(`workouttracker:///auth/callback?${query.toString()}`);
      return;
    }

    if (hashPayload) {
      void createSessionFromAuthRedirect(`workouttracker:///auth/callback#${hashPayload}`);
    }
  }, [params.access_token, params.refresh_token, params['#']]);

  useEffect(() => {
    if (!isLoading && isSignedIn) {
      navigateAfterAuth(router);
    }
  }, [isLoading, isSignedIn, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isSignedIn) {
        setTimedOut(true);
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [isSignedIn]);

  return (
    <>
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
              Open the confirmation link on the same device where Axios Workouts is installed, then try
              signing in from Settings → Account.
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

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
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
