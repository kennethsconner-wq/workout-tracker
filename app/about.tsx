import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Text, View } from '@/components/Themed';
import { stackHeaderHideIosBackLabel } from '@/constants/stackHeader';

export default function AboutScreen() {
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
            If you use the app without an account, clearing app data or uninstalling removes your history from this
            phone with no cloud copy.
          </Text>
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
});
