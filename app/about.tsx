import { Stack } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Text, View } from '@/components/Themed';
import { stackHeaderHideIosBackLabel } from '@/constants/stackHeader';

export default function AboutScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'About',
          presentation: 'modal',
          ...stackHeaderHideIosBackLabel,
        }}
      />
      <View style={styles.screen}>
        <View style={styles.container}>
          <Text style={styles.copy}>
            Workout Tracker helps you plan and track workouts. Everything stays on your device—no account required.
          </Text>
          <Text style={styles.copy}>
            Your data is stored locally on this phone. If you remove the app or clear its data, that history is not
            recovered from a server because none is sent off-device by this version of the app.
          </Text>
        </View>
        <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
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
