import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { PAYPAL_DONATE_URL } from '@/constants/appLinks';
import { stackHeaderHideIosBackLabel } from '@/constants/stackHeader';
import { useColorScheme } from '@/components/useColorScheme';

export default function DonateScreen() {
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'light';
  const tint = Colors[activeScheme].tint;

  const openPayPal = () => {
    void WebBrowser.openBrowserAsync(PAYPAL_DONATE_URL);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Donate',
          presentation: 'card',
          ...stackHeaderHideIosBackLabel,
        }}
      />
      <View style={styles.screen}>
        <View style={styles.container}>
          <Text style={styles.copy}>
            If Axios Workouts helps you train, consider buying me a coffee. Tips are optional and go through PayPal.
          </Text>
          <Text style={styles.copy}>Thank you for using the app.</Text>
          <Pressable
            onPress={openPayPal}
            accessibilityRole="link"
            accessibilityLabel="Donate with PayPal"
            style={({ pressed }) => [styles.button, { backgroundColor: tint, opacity: pressed ? 0.85 : 1 }]}>
            <Text style={styles.buttonLabel}>Donate with PayPal</Text>
          </Pressable>
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
  button: {
    marginTop: 8,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#241734',
  },
});
