import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View as RNView } from 'react-native';

import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import {
  isAccountOnboardingDismissed,
  markAccountOnboardingDismissed,
} from '@/lib/auth/accountOnboardingStorage';

export function AccountOnboardingGate() {
  const router = useRouter();
  const { isSignedIn, isLoading, isConfigured } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isConfigured) {
      setVisible(false);
      return;
    }

    if (isSignedIn) {
      void markAccountOnboardingDismissed();
      setVisible(false);
      return;
    }

    let isMounted = true;
    void isAccountOnboardingDismissed().then((dismissed) => {
      if (isMounted) {
        setVisible(!dismissed);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isConfigured, isLoading, isSignedIn]);

  const handleDismiss = useCallback(() => {
    void markAccountOnboardingDismissed();
    setVisible(false);
  }, []);

  const handleCreateAccount = useCallback(() => {
    setVisible(false);
    router.push('/auth/sign-up');
  }, [router]);

  const handleSignIn = useCallback(() => {
    setVisible(false);
    router.push('/auth/sign-in');
  }, [router]);

  return (
    <AccountOnboardingModal
      visible={visible}
      onDismiss={handleDismiss}
      onCreateAccount={handleCreateAccount}
      onSignIn={handleSignIn}
    />
  );
}

type AccountOnboardingModalProps = {
  visible: boolean;
  onDismiss: () => void;
  onCreateAccount: () => void;
  onSignIn: () => void;
};

function AccountOnboardingModal({
  visible,
  onDismiss,
  onCreateAccount,
  onSignIn,
}: AccountOnboardingModalProps) {
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'dark';
  const textColor = Colors[activeScheme].text;
  const tint = Colors[activeScheme].tint;
  const borderColor = activeScheme === 'dark' ? '#333' : '#e5e5e5';
  const sheetBackground = Colors[activeScheme].background;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable
          style={[styles.sheet, { backgroundColor: sheetBackground, borderColor }]}
          onPress={(event) => event.stopPropagation()}>
          <RNView style={styles.iconWrap}>
            <Ionicons name="cloud-upload-outline" size={36} color={tint} />
          </RNView>
          <Text style={[styles.title, { color: textColor }]}>Back up your workouts to the cloud</Text>
          <Text style={[styles.body, { color: textColor }]}>
            Create a free account to access your workouts from any device and recover them if your phone is lost or
            replaced. Your workouts stay on this device until you sign in and sync is enabled.
          </Text>
          <View style={styles.actions}>
            <AuthPrimaryButton label="Create account" onPress={onCreateAccount} />
            <Pressable
              onPress={onSignIn}
              accessibilityRole="button"
              style={({ pressed }) => [styles.secondaryButton, { borderColor, opacity: pressed ? 0.7 : 1 }]}>
              <Text style={[styles.secondaryButtonLabel, { color: textColor }]}>Sign in</Text>
            </Pressable>
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
              <Text style={[styles.declineLabel, { color: textColor }]}>Not now</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    gap: 12,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    opacity: 0.9,
  },
  actions: {
    marginTop: 8,
    gap: 12,
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
  declineLabel: {
    fontSize: 15,
    textAlign: 'center',
    opacity: 0.75,
    paddingVertical: 8,
  },
});
