import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { stackHeaderHideIosBackLabel } from '@/constants/stackHeader';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { navigateAfterAuth } from '@/lib/auth/navigateAfterAuth';

export default function ConfirmEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const colorScheme = useColorScheme();
  const textColor = Colors[colorScheme ?? 'dark'].text;
  const borderColor = colorScheme === 'dark' ? '#333' : '#e5e5e5';
  const { isSignedIn, isAuthBusy, resendSignUpConfirmation } = useAuth();
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSent, setResendSent] = useState(false);

  const email = readEmailParam(params.email);

  useEffect(() => {
    if (isSignedIn) {
      navigateAfterAuth(router);
    }
  }, [isSignedIn, router]);

  useEffect(() => {
    if (!email) {
      router.replace('/auth/sign-up');
    }
  }, [email, router]);

  const handleResend = async () => {
    if (!email) {
      return;
    }

    setResendError(null);
    setResendSent(false);
    const result = await resendSignUpConfirmation(email);
    if (result.error) {
      setResendError(result.error);
      return;
    }

    setResendSent(true);
  };

  if (!email) {
    return null;
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Confirm email', ...stackHeaderHideIosBackLabel }} />
      <AuthScreenLayout>
        <Text style={styles.copy}>
          We sent a confirmation link to <Text style={styles.email}>{email}</Text>. Open it on this device to
          finish creating your account.
        </Text>
        <Text style={styles.copy}>
          After you confirm, you will be signed in automatically. You do not need to return to the sign-in
          screen.
        </Text>
        <AuthPrimaryButton
          label="Resend confirmation email"
          onPress={() => void handleResend()}
          loading={isAuthBusy}
        />
        {resendError ? <Text style={styles.error}>{resendError}</Text> : null}
        {resendSent ? <Text style={styles.success}>Confirmation email sent.</Text> : null}
        <Pressable
          onPress={() => router.push('/auth/sign-in')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.secondaryButton, { borderColor, opacity: pressed ? 0.7 : 1 }]}>
          <Text style={[styles.secondaryButtonLabel, { color: textColor }]}>Already confirmed? Sign in</Text>
        </Pressable>
      </AuthScreenLayout>
    </>
  );
}

function readEmailParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
    return value[0].trim();
  }
  return null;
}

const styles = StyleSheet.create({
  copy: {
    fontSize: 16,
    lineHeight: 24,
  },
  email: {
    fontWeight: '600',
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  success: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.9,
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 20,
  },
  secondaryButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
