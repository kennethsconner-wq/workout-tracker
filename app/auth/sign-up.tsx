import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AuthFormField } from '@/components/auth/AuthFormField';
import { AuthPasswordField } from '@/components/auth/AuthPasswordField';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout';
import { Text } from '@/components/Themed';
import { stackHeaderHideIosBackLabel } from '@/constants/stackHeader';
import { validateEmail, validatePassword, validateUsername } from '@/lib/auth/authErrors';
import { useAuth } from '@/lib/auth/AuthProvider';
import { navigateAfterAuth } from '@/lib/auth/navigateAfterAuth';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, isAuthBusy, isConfigured } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showConfirmEmailLink, setShowConfirmEmailLink] = useState(false);

  const trimmedEmail = email.trim();

  const goToConfirmEmail = () => {
    if (!trimmedEmail) {
      return;
    }
    router.replace({
      pathname: '/auth/confirm-email',
      params: { email: trimmedEmail },
    });
  };

  const handleSignUp = async () => {
    const usernameError = validateUsername(username);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    if (usernameError || emailError || passwordError) {
      setFormError(usernameError ?? emailError ?? passwordError);
      setShowConfirmEmailLink(false);
      return;
    }

    setFormError(null);
    setShowConfirmEmailLink(false);
    const result = await signUp({
      email,
      password,
      username,
    });

    if (result.error) {
      setFormError(result.error);
      const accountMayExist = result.error.toLowerCase().includes('already exists');
      setShowConfirmEmailLink(accountMayExist);
      return;
    }

    if (result.needsEmailConfirmation) {
      router.replace({
        pathname: '/auth/confirm-email',
        params: { email: trimmedEmail },
      });
      return;
    }

    navigateAfterAuth(router);
  };

  if (!isConfigured) {
    return (
      <>
        <Stack.Screen options={{ title: 'Create account', ...stackHeaderHideIosBackLabel }} />
        <AuthScreenLayout subtitle="Cloud accounts are not configured in this build.">
          <Text>Contact the developer if you expected account creation to be available.</Text>
        </AuthScreenLayout>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Create account', ...stackHeaderHideIosBackLabel }} />
      <AuthScreenLayout>
        <AuthFormField
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          textContentType="username"
          autoComplete="username"
          placeholder="letters, numbers, underscores"
        />
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
          textContentType="newPassword"
          autoComplete="new-password"
          placeholder="At least 6 characters"
        />
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <AuthPrimaryButton label="Create account" onPress={() => void handleSignUp()} loading={isAuthBusy} />
        {showConfirmEmailLink && trimmedEmail ? (
          <Pressable
            onPress={goToConfirmEmail}
            accessibilityRole="button"
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
            <Text style={styles.link}>Go to email confirmation</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => router.push('/auth/sign-in')}
          accessibilityRole="button"
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <Text style={styles.link}>Already have an account? Sign in</Text>
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
