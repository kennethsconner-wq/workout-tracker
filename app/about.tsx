import { Stack } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { DEVELOPER_NAME } from '@/constants/appLinks';
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
            locally on this device.
          </Text>
          <Text style={styles.copy}>
            If you create an account, you can prepare for cloud backup so your workouts are accessible from other
            devices and recoverable if this phone is lost or replaced. Until you sign in and sync is enabled, nothing
            leaves your device.
          </Text>
          <Text style={styles.copy}>
            If you use the app without an account, your data is stored locally on this phone by {DEVELOPER_NAME}.
            Clearing app data or uninstalling removes your history from this phone with no cloud copy.
          </Text>
          <Text style={styles.copy}>
            You can delete individual workouts, logs, and exercises in the app, or remove all data by clearing app
            storage or uninstalling. See our Privacy Policy for retention and deletion details.
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
