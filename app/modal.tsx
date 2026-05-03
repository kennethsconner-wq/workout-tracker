import { Stack } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Text, View } from '@/components/Themed';

export default function AboutModal() {
  return (
    <>
      <Stack.Screen options={{ title: 'About' }} />
      <View style={styles.container}>
        <Text style={styles.lead}>
          Workout Tracker keeps a simple history of sessions on your phone. No account is required for this first
          version.
        </Text>
        <Text style={styles.body}>
          When you are ready for the store, you will swap the placeholder bundle identifiers in app.json, add icons and
          privacy text, and wire up EAS Build for signed iOS and Android binaries.
        </Text>
        <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 16,
  },
  lead: {
    fontSize: 17,
    lineHeight: 24,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.85,
  },
});
