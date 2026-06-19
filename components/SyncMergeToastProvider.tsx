import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { registerSyncMergeToast } from '@/lib/sync/syncMergeToast';

const TOAST_DURATION_MS = 5000;

export function SyncMergeToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'dark';
  const palette = Colors[activeScheme];
  const borderColor = activeScheme === 'dark' ? '#404040' : '#d4d4d4';
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    Animated.timing(opacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setMessage(null);
      }
    });
  }, [opacity]);

  const showToast = useCallback(
    (nextMessage: string) => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }

      setMessage(nextMessage);
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();

      hideTimerRef.current = setTimeout(() => {
        hideToast();
      }, TOAST_DURATION_MS);
    },
    [hideToast, opacity],
  );

  useEffect(() => {
    registerSyncMergeToast(showToast);
    return () => {
      registerSyncMergeToast(null);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [showToast]);

  return (
    <>
      {children}
      {message ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.overlay, { paddingBottom: Math.max(insets.bottom, 16) + 8, opacity }]}>
          <Pressable
            onPress={hideToast}
            accessibilityRole="button"
            accessibilityLabel="Dismiss sync message"
            style={({ pressed }) => [
              styles.toast,
              {
                backgroundColor: palette.background,
                borderColor,
                opacity: pressed ? 0.92 : 1,
              },
            ]}>
            <Ionicons name="cloud-outline" size={20} color={palette.tint} style={styles.icon} />
            <RNView style={styles.textWrap}>
              <Text style={styles.title}>Cloud update applied</Text>
              <Text style={styles.message}>{message}</Text>
            </RNView>
          </Pressable>
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
  },
  toast: {
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
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
  },
});
