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
            Axios Workouts helps you plan and track workouts. Everything stays on your device—no account required.
          </Text>
          <Text style={styles.copy}>
            Your data is stored locally on this phone by {DEVELOPER_NAME}. If you remove the app or clear its data,
            that history is not recovered from a server because none is sent off-device by this version of the app.
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
