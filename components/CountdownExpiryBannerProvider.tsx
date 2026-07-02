import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Vibration, View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import {
  dismissCountdownExpiryInAppAlert,
  registerCountdownExpiryInAppAlertHandlers,
  type CountdownExpiryInAppAlert,
} from '@/lib/countdownExpiryInAppAlert';
import { focusLogWorkoutExercise } from '@/lib/logWorkoutNavigation';

const EXPIRED_ACCENT = '#D40078';

export function CountdownExpiryBannerProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'dark';
  const palette = Colors[activeScheme];
  const borderColor = activeScheme === 'dark' ? '#404040' : '#d4d4d4';
  const [alert, setAlert] = useState<CountdownExpiryInAppAlert | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  const hideBanner = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setAlert(null);
      }
    });
  }, [opacity]);

  const showBanner = useCallback(
    (nextAlert: CountdownExpiryInAppAlert) => {
      Vibration.vibrate([0, 350, 150, 350]);
      setAlert(nextAlert);
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    },
    [opacity],
  );

  useEffect(() => {
    registerCountdownExpiryInAppAlertHandlers({
      show: showBanner,
      dismiss: hideBanner,
    });
    return () => registerCountdownExpiryInAppAlertHandlers(null);
  }, [hideBanner, showBanner]);

  const onViewExercise = () => {
    if (!alert?.logSession) {
      hideBanner();
      return;
    }

    focusLogWorkoutExercise(alert.logSession, alert.exerciseId);
    hideBanner();
  };

  const trimmedExerciseName = alert?.exerciseName.trim() || 'your exercise';
  const canNavigate = Boolean(alert?.logSession);

  return (
    <>
      {children}
      {alert ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.overlay, { paddingBottom: Math.max(insets.bottom, 16) + 8, opacity }]}>
          <RNView
            style={[
              styles.banner,
              {
                backgroundColor: palette.background,
                borderColor,
              },
            ]}>
            <Ionicons name="hourglass-outline" size={22} color={EXPIRED_ACCENT} style={styles.icon} />
            <RNView style={styles.textWrap}>
              <Text style={[styles.title, { color: EXPIRED_ACCENT }]}>Time&apos;s up!</Text>
              <Text style={styles.message}>
                Your planned duration for {trimmedExerciseName} has finished.
              </Text>
            </RNView>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss timer alert"
              onPress={hideBanner}
              hitSlop={8}
              style={({ pressed }) => [styles.dismissButton, pressed && styles.buttonPressed]}>
              <Ionicons name="close" size={20} color={palette.text} />
            </Pressable>
          </RNView>
          {canNavigate ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View exercise in log workout"
              onPress={onViewExercise}
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: EXPIRED_ACCENT, opacity: pressed ? 0.88 : 1 },
              ]}>
              <Text style={styles.actionButtonLabel}>View exercise</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    gap: 10,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  icon: {
    marginTop: 2,
    marginRight: 10,
  },
  textWrap: {
    flex: 1,
    gap: 2,
    paddingRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
  },
  dismissButton: {
    padding: 2,
  },
  buttonPressed: {
    opacity: 0.65,
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
