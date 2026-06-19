import 'react-native-gesture-handler';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AccountOnboardingGate } from '@/components/AccountOnboardingModal';
import { SyncMergeToastProvider } from '@/components/SyncMergeToastProvider';
import { ThemedAlertProvider } from '@/components/ThemedAlertProvider';
import { DurationTimerProvider } from '@/components/DurationTimerProvider';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { DataRepositoryProvider } from '@/lib/data/DataRepositoryContext';
import Colors from '@/constants/Colors';
import { stackHeaderHideIosBackLabel } from '@/constants/stackHeader';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const appBackground = Colors.dark.background;

/** Navigation chrome: same for OS light and dark while app appearance is unified on dark palette. */
const NavigationAppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.tint,
    background: appBackground,
    card: appBackground,
    text: Colors.dark.text,
  },
};

/** Keeps stack pop transitions from revealing Android's default white window/scene background. */
const stackScreenOptions = {
  ...stackHeaderHideIosBackLabel,
  contentStyle: { backgroundColor: appBackground },
  headerStyle: { backgroundColor: appBackground },
  headerTintColor: Colors.dark.text,
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(appBackground);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: appBackground }}>
      <SafeAreaProvider style={{ flex: 1, backgroundColor: appBackground }}>
        <AuthProvider>
        <DataRepositoryProvider>
        <AccountOnboardingGate />
        <ThemedAlertProvider>
        <SyncMergeToastProvider>
        <DurationTimerProvider>
        <ThemeProvider value={NavigationAppTheme}>
        <Stack screenOptions={stackScreenOptions}>
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
              /** Fallback title if any API still reads the route name instead of "(tabs)". */
              title: 'Workouts',
              ...stackHeaderHideIosBackLabel,
            }}
          />
          <Stack.Screen
            name="log-workout"
            options={{
              title: 'Log workout',
              presentation: 'card',
              ...stackHeaderHideIosBackLabel,
            }}
          />
          <Stack.Screen
            name="auth"
            options={{
              headerShown: false,
            }}
          />
        </Stack>
        </ThemeProvider>
        </DurationTimerProvider>
        </SyncMergeToastProvider>
        </ThemedAlertProvider>
        </DataRepositoryProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
