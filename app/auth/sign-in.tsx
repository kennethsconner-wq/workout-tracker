import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AuthFormField } from '@/components/auth/AuthFormField';
import { AuthPasswordField } from '@/components/auth/AuthPasswordField';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout';
import { Text } from '@/components/Themed';
import { stackHeaderHideIosBackLabel } from '@/constants/stackHeader';
import { validateEmail, validatePassword } from '@/lib/auth/authErrors';
import { useAuth } from '@/lib/auth/AuthProvider';
import { navigateAfterAuth } from '@/lib/auth/navigateAfterAuth';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, isAuthBusy, isConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSignIn = async () => {
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    if (emailError || passwordError) {
      setFormError(emailError ?? passwordError);
      return;
    }

    setFormError(null);
    const result = await signIn(email, password);
    if (result.error) {
      setFormError(result.error);
      return;
    }

    navigateAfterAuth(router);
  };

  if (!isConfigured) {
    return (
      <>
        <Stack.Screen options={{ title: 'Sign in', ...stackHeaderHideIosBackLabel }} />
        <AuthScreenLayout subtitle="Cloud accounts are not configured in this build.">
          <Text>Contact the developer if you expected account sign-in to be available.</Text>
        </AuthScreenLayout>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Sign in', ...stackHeaderHideIosBackLabel }} />
      <AuthScreenLayout subtitle="Access your workouts from any device once cloud sync is enabled.">
        <AuthFormField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          placeholder="you@example.com"
        />
        <AuthPasswordField
          label="Password"
          value={password}
          onChangeText={setPassword}
          textContentType="password"
          autoComplete="password"
          placeholder="Your password"
        />
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <AuthPrimaryButton label="Sign in" onPress={() => void handleSignIn()} loading={isAuthBusy} />
        <Pressable
          onPress={() => router.push('/auth/forgot-password')}
          accessibilityRole="button"
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <Text style={styles.link}>Forgot password?</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/auth/sign-up')}
          accessibilityRole="button"
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <Text style={styles.link}>Create an account</Text>
        </Pressable>
      </AuthScreenLayout>
    </>
  );
}

const styles = StyleSheet.create({
  formError: {
    color: '#ef4444',
    fontSize: 14,
  },
  link: {
    fontSize: 16,
    textAlign: 'center',
  },
});
