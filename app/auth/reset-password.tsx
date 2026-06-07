import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { AuthPasswordField } from '@/components/auth/AuthPasswordField';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { AuthRedirectListener } from '@/components/auth/AuthRedirectListener';
import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout';
import { Text } from '@/components/Themed';
import { stackHeaderHideIosBackLabel } from '@/constants/stackHeader';
import { validatePassword } from '@/lib/auth/authErrors';
import { markAccountOnboardingDismissed } from '@/lib/auth/accountOnboardingStorage';
import { useAuth } from '@/lib/auth/AuthProvider';
import { navigateToSignIn, navigateToWorkouts } from '@/lib/auth/navigateAfterAuth';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    access_token?: string | string[];
    refresh_token?: string | string[];
    code?: string | string[];
    token_hash?: string | string[];
    type?: string | string[];
    '#': string | string[];
  }>();
  const { isSignedIn, isLoading, isAuthBusy, isConfigured, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isLoading && !isSignedIn) {
        setLinkError(
          'This reset link is invalid or has expired. Request a new one from the sign-in screen.',
        );
      }
    }, 12000);

    return () => clearTimeout(timer);
  }, [isLoading, isSignedIn]);

  const handleSubmit = async () => {
    const passwordError = validatePassword(password);
    if (passwordError) {
      setFormError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setFormError(null);
    const result = await updatePassword(password);
    if (result.error) {
      setFormError(result.error);
      return;
    }

    await markAccountOnboardingDismissed();
    navigateToWorkouts(router);
  };

  if (!isConfigured) {
    return (
      <>
        <Stack.Screen options={{ title: 'New password', ...stackHeaderHideIosBackLabel }} />
        <AuthScreenLayout subtitle="Cloud accounts are not configured in this build.">
          <Text>Password reset is unavailable in this build.</Text>
        </AuthScreenLayout>
      </>
    );
  }

  const showForm = !isLoading && isSignedIn;

  return (
    <>
      <AuthRedirectListener params={params} flow="password-reset" />
      <Stack.Screen options={{ title: 'New password', ...stackHeaderHideIosBackLabel }} />
      {linkError ? (
        <AuthScreenLayout subtitle="We could not verify your reset link.">
          <Text style={styles.message}>{linkError}</Text>
          <AuthPrimaryButton label="Back to sign in" onPress={() => navigateToSignIn(router)} />
          <Pressable
            onPress={() => router.dismissTo('/auth/forgot-password')}
            accessibilityRole="button"
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
            <Text style={styles.link}>Request a new reset link</Text>
          </Pressable>
        </AuthScreenLayout>
      ) : showForm ? (
        <AuthScreenLayout subtitle="Choose a new password for your account.">
          <AuthPasswordField
            label="New password"
            value={password}
            onChangeText={setPassword}
            textContentType="newPassword"
            autoComplete="new-password"
            placeholder="At least 6 characters"
          />
          <AuthPasswordField
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            textContentType="newPassword"
            autoComplete="new-password"
            placeholder="Re-enter your new password"
          />
          {formError ? <Text style={styles.formError}>{formError}</Text> : null}
          <AuthPrimaryButton
            label="Update password"
            onPress={() => void handleSubmit()}
            loading={isAuthBusy}
          />
        </AuthScreenLayout>
      ) : (
        <AuthScreenLayout subtitle="Verifying your reset link…">
          <ActivityIndicator size="large" color="#23D5D5" />
        </AuthScreenLayout>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  formError: {
    color: '#ef4444',
    fontSize: 14,
  },
  link: {
    fontSize: 16,
    textAlign: 'center',
  },
});
