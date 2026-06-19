import { Stack } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { stackHeaderHideIosBackLabel } from '@/constants/stackHeader';
import { useColorScheme } from '@/components/useColorScheme';
import { openPrivacyPolicy } from '@/lib/openPrivacyPolicy';

export default function AboutScreen() {
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'light';
  const tint = Colors[activeScheme].tint;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'About',
          presentation: 'card',
          ...stackHeaderHideIosBackLabel,
        }}
      />
      <View style={styles.screen}>
        <View style={styles.container}>
          <Text style={styles.copy}>
            Axios Workouts helps you plan and track workouts. No account is required—your workouts are always stored
            locally on this device first.
          </Text>
          <Text style={styles.copy}>
            If you create an account and sign in, your workouts are backed up to the cloud and can sync across your
            devices. Edits save on this phone first, then upload in the background. Sign out anytime from Settings →
            Account; your workouts stay on this device.
          </Text>
          <Text style={styles.copy}>
            Without an account, everything stays on this phone. Clearing app data or uninstalling removes your history
            from this device with no cloud copy.
          </Text>
          <Text style={styles.copy}>
            You can delete individual workouts, logs, and exercises in the app, remove all local data by clearing app
            storage or uninstalling, or delete your account from Settings → Account to remove cloud backups and your
            profile. See our Privacy Policy for retention and deletion details.
          </Text>
          <Pressable
            onPress={() => {
              void openPrivacyPolicy();
            }}
            accessibilityRole="link"
            accessibilityLabel="Open Privacy Policy"
            style={({ pressed }) => [styles.linkButton, { opacity: pressed ? 0.7 : 1 }]}>
            <Text style={[styles.linkLabel, { color: tint }]}>Privacy Policy</Text>
          </Pressable>
        </View>
        <StatusBar style="light" />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    gap: 16,
  },
  copy: {
    fontSize: 16,
    lineHeight: 24,
  },
  linkButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  linkLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
