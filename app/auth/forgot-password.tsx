import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AuthFormField } from '@/components/auth/AuthFormField';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout';
import { Text } from '@/components/Themed';
import { stackHeaderHideIosBackLabel } from '@/constants/stackHeader';
import { validateEmail } from '@/lib/auth/authErrors';
import { useAuth } from '@/lib/auth/AuthProvider';
import { themedAlert } from '@/lib/themedAlert';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { resetPassword, isAuthBusy, isConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleReset = async () => {
    const emailError = validateEmail(email);
    if (emailError) {
      setFormError(emailError);
      return;
    }

    setFormError(null);
    const result = await resetPassword(email);
    if (result.error) {
      setFormError(result.error);
      return;
    }

    themedAlert(
      'Check your email',
      'If an account exists for that address, a password reset link has been sent.',
      [{ text: 'OK', onPress: () => router.replace('/auth/sign-in') }],
    );
  };

  if (!isConfigured) {
    return (
      <>
        <Stack.Screen options={{ title: 'Reset password', ...stackHeaderHideIosBackLabel }} />
        <AuthScreenLayout subtitle="Cloud accounts are not configured in this build.">
          <Text>Password reset is unavailable in this build.</Text>
        </AuthScreenLayout>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Reset password', ...stackHeaderHideIosBackLabel }} />
      <AuthScreenLayout subtitle="Enter your account email and we will send a reset link.">
        <AuthFormField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          placeholder="you@example.com"
        />
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <AuthPrimaryButton label="Send reset link" onPress={() => void handleReset()} loading={isAuthBusy} />
      </AuthScreenLayout>
    </>
  );
}

const styles = StyleSheet.create({
  formError: {
    color: '#ef4444',
    fontSize: 14,
  },
});
