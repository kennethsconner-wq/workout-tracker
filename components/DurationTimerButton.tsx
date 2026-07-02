import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Modal, Pressable, StyleSheet, Vibration, View as RNView } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useDurationTimer } from '@/components/DurationTimerProvider';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import {
  elapsedSecondsToDurationInput,
  formatStopwatchDisplay,
  type DurationTimerMode,
} from '@/lib/durationTimer';
import {
  scheduleCountdownExpiryNotification,
  type CountdownLogSession,
} from '@/lib/countdownNotifications';
import {
  clearCountdownTimerVisibility,
  isRectVisibleInWindow,
  setCountdownTimerVisibleOnScreen,
  subscribeCountdownTimerVisibilityRecheck,
} from '@/lib/countdownTimerVisibility';
import type { DurationUnit } from '@/lib/durationUnits';

type Props = {
  timerId: string;
  durationUnit: DurationUnit;
  timerMode?: DurationTimerMode;
  countdownTargetSeconds?: number | null;
  countdownExerciseLabel?: string;
  countdownLogSession?: CountdownLogSession;
  /** When true, countdown stops at 0:00 instead of showing overtime. */
  clampCountdownAtZero?: boolean;
  /** When false, expiry does not vibrate (e.g. rest timers). Defaults to true for countdown. */
  notifyOnExpire?: boolean;
  /** When true, the first tap starts the timer; later taps open the timer modal. */
  startOnPress?: boolean;
  /** When true, shows Stop while the timer is active to save elapsed time to the field. */
  showStopButton?: boolean;
  onComplete: (formattedValue: string) => void;
  disabled?: boolean;
  activeScheme: 'light' | 'dark';
  accessibilityLabel?: string;
};

const EXPIRED_ACCENT = '#D40078';

function notifyCountdownExpired() {
  Vibration.vibrate([0, 350, 150, 350]);
}

export function DurationTimerButton({
  timerId,
  durationUnit,
  timerMode = 'countup',
  countdownTargetSeconds = null,
  countdownExerciseLabel,
  countdownLogSession,
  clampCountdownAtZero = false,
  notifyOnExpire,
  startOnPress = false,
  showStopButton = false,
  onComplete,
  disabled = false,
  activeScheme,
  accessibilityLabel = 'Start duration timer',
}: Props) {
  const tint = Colors[activeScheme].tint;
  const borderColor = activeScheme === 'dark' ? '#404040' : '#d4d4d4';
  const textColor = Colors[activeScheme].text;
  const sheetBackground = activeScheme === 'dark' ? '#171717' : '#fff';
  const runningHighlight = activeScheme === 'dark' ? 'rgba(35, 213, 213, 0.22)' : 'rgba(57, 170, 170, 0.18)';
  const expiredHighlight = activeScheme === 'dark' ? 'rgba(212, 0, 120, 0.24)' : 'rgba(212, 0, 120, 0.14)';

  const { tick, isRunning, isPaused, getTimerSnapshot, getDurationUnit, startTimer, setTimerNotificationScheduled, cancelTimer, pauseTimer, resumeTimer } =
    useDurationTimer();

  const [open, setOpen] = useState(false);
  const wasExpiredRef = useRef(false);
  const buttonRef = useRef<ComponentRef<typeof Pressable>>(null);
  const iconRotation = useSharedValue(0);

  const running = isRunning(timerId);
  const paused = isPaused(timerId);
  const active = running || paused;
  const snapshot = active ? getTimerSnapshot(timerId) : null;
  const activeMode = snapshot?.mode ?? timerMode;
  const isCountdown = activeMode === 'countdown';
  const expired = snapshot?.expired ?? false;
  const displaySeconds = isCountdown
    ? (snapshot?.remainingSeconds ?? countdownTargetSeconds ?? 0)
    : (snapshot?.elapsedSeconds ?? 0);

  const shouldNotifyOnExpire = notifyOnExpire ?? isCountdown;

  useEffect(() => {
    if (expired && !wasExpiredRef.current && shouldNotifyOnExpire) {
      notifyCountdownExpired();
    }
    wasExpiredRef.current = expired;
  }, [expired, shouldNotifyOnExpire]);

  useEffect(() => {
    if (!running) {
      wasExpiredRef.current = false;
    }
  }, [running, paused]);

  const scheduleCountdownNotificationIfNeeded = (remainingSeconds: number | null) => {
    if (
      timerMode !== 'countdown' ||
      countdownTargetSeconds === null ||
      countdownTargetSeconds <= 0 ||
      remainingSeconds === null ||
      remainingSeconds <= 0
    ) {
      return;
    }

    const fireAtMs = Date.now() + remainingSeconds * 1000;
    void (async () => {
      const notificationScheduled = await scheduleCountdownExpiryNotification({
        timerId,
        exerciseName: countdownExerciseLabel ?? 'exercise',
        fireAtMs,
        logSession: countdownLogSession,
      });
      if (notificationScheduled) {
        setTimerNotificationScheduled(timerId, true);
      }
    })();
  };

  useEffect(() => {
    if (!running) {
      clearCountdownTimerVisibility(timerId);
      return;
    }

    const measureVisibility = () => {
      buttonRef.current?.measureInWindow((x, y, width, height) => {
        setCountdownTimerVisibleOnScreen(timerId, isRectVisibleInWindow(x, y, width, height));
      });
    };

    measureVisibility();
    const unsubscribe = subscribeCountdownTimerVisibilityRecheck(measureVisibility);
    return () => {
      unsubscribe();
      clearCountdownTimerVisibility(timerId);
    };
  }, [timerId, running]);

  useEffect(() => {
    if (!running) {
      return;
    }

    buttonRef.current?.measureInWindow((x, y, width, height) => {
      setCountdownTimerVisibleOnScreen(timerId, isRectVisibleInWindow(x, y, width, height));
    });
  }, [tick, timerId, running]);

  useEffect(() => {
    if (running && !expired && isCountdown) {
      iconRotation.value = 0;
      iconRotation.value = withRepeat(
        withTiming(360, { duration: 1800, easing: Easing.linear }),
        -1,
        false,
      );
      return;
    }

    cancelAnimation(iconRotation);
    iconRotation.value = 0;
  }, [running, expired, isCountdown, iconRotation]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${iconRotation.value}deg` }],
  }));

  const openModal = () => {
    setOpen(true);
  };

  const handleButtonPress = () => {
    if (startOnPress && !active) {
      startTimerRun();
      return;
    }
    openModal();
  };

  const startTimerRun = () => {
    const startedAt = startTimer(timerId, {
      durationUnit,
      mode: timerMode,
      targetSeconds: countdownTargetSeconds,
      exerciseLabel: countdownExerciseLabel,
      countdownLogSession,
      notificationScheduled: false,
      clampCountdownAtZero,
    });

    if (startedAt !== null && timerMode === 'countdown') {
      scheduleCountdownNotificationIfNeeded(countdownTargetSeconds);
    }
  };

  const resetTimerAndClose = () => {
    cancelTimer(timerId);
    setOpen(false);
  };

  const restartTimerRun = () => {
    cancelTimer(timerId);
    startTimerRun();
  };

  const pauseOrResumeOrStart = () => {
    if (expired && active) {
      restartTimerRun();
      setOpen(false);
      return;
    }

    if (running) {
      pauseTimer(timerId);
      return;
    }

    if (paused) {
      const remainingSeconds = snapshot?.remainingSeconds ?? null;
      resumeTimer(timerId);
      scheduleCountdownNotificationIfNeeded(remainingSeconds);
      setOpen(false);
      return;
    }

    startTimerRun();
    if (!startOnPress) {
      setOpen(false);
    }
  };

  const stopAndSave = () => {
    const elapsedSeconds = snapshot?.elapsedSeconds ?? 0;
    if (running) {
      pauseTimer(timerId);
    }
    const unit = getDurationUnit(timerId) ?? durationUnit;
    const formatted = elapsedSecondsToDurationInput(elapsedSeconds, unit);
    if (formatted.length > 0) {
      onComplete(formatted);
    }
    setOpen(false);
  };

  const buttonBorderColor = expired ? EXPIRED_ACCENT : active ? tint : borderColor;
  const buttonBackground = expired
    ? expiredHighlight
    : running
      ? runningHighlight
      : paused
        ? activeScheme === 'dark'
          ? 'rgba(35, 213, 213, 0.12)'
          : 'rgba(57, 170, 170, 0.1)'
        : activeScheme === 'dark'
          ? '#171717'
          : '#fafafa';
  const iconColor = disabled ? '#737373' : expired ? EXPIRED_ACCENT : tint;
  const showRunningCountdown = running && isCountdown && !expired;
  const iconName = isCountdown
    ? active
      ? 'hourglass'
      : 'hourglass-outline'
    : active
      ? 'timer'
      : 'timer-outline';
  const runningTimeLabel = active && isCountdown ? formatStopwatchDisplay(displaySeconds) : null;

  const runningLabel = paused
    ? 'Timer paused. Resume to continue or Cancel to reset.'
    : expired
      ? 'Countdown finished. Overtime shown as negative time.'
      : isCountdown
        ? 'Countdown keeps running in the background when closed.'
        : 'Timer keeps running in the background when closed.';

  const primaryActionLabel = expired && active ? 'Restart' : running ? 'Pause' : paused ? 'Resume' : 'Start';
  const primaryAccessibilityLabel =
    expired && active ? 'Restart timer' : running ? 'Pause timer' : paused ? 'Resume timer' : 'Start timer';

  return (
    <>
      <Pressable
        ref={buttonRef}
        accessibilityRole="button"
        accessibilityLabel={
          expired
            ? `${accessibilityLabel}. Countdown finished. Tap to view timer.`
            : active
              ? `${accessibilityLabel}. Timer ${paused ? 'paused' : 'running'}${runningTimeLabel ? `, ${runningTimeLabel} remaining` : ''}.${
                  startOnPress ? ' Tap to view timer.' : ''
                }`
              : accessibilityLabel
        }
        accessibilityState={{ selected: active }}
        disabled={disabled}
        onPress={handleButtonPress}
        hitSlop={6}
        style={({ pressed }) => [
          styles.timerButton,
          showRunningCountdown && styles.timerButtonRunningCountdown,
          {
            borderColor: buttonBorderColor,
            backgroundColor: buttonBackground,
            borderWidth: active && !expired ? 2 : 1,
          },
          disabled && styles.timerButtonDisabled,
          pressed && !disabled && styles.timerButtonPressed,
        ]}>
        <RNView style={styles.iconStack}>
          {runningTimeLabel ? (
            <>
              <Animated.View style={showRunningCountdown ? iconAnimatedStyle : undefined}>
                <Ionicons name={iconName} size={18} color={iconColor} />
              </Animated.View>
              <Text style={[styles.runningTimeLabel, { color: iconColor }]}>{runningTimeLabel}</Text>
            </>
          ) : (
            <Ionicons name={iconName} size={22} color={iconColor} />
          )}
        </RNView>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: sheetBackground, borderColor }]}
            onPress={(event) => event.stopPropagation()}>
            <RNView style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: textColor }]}>
                {isCountdown ? 'Countdown' : 'Timer'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close timer modal"
                onPress={() => setOpen(false)}
                hitSlop={8}
                style={({ pressed }) => [styles.sheetCloseButton, pressed && styles.actionPressed]}>
                <Ionicons name="close" size={24} color={textColor} />
              </Pressable>
            </RNView>
            <Text
              style={[
                styles.elapsedDisplay,
                { color: expired ? EXPIRED_ACCENT : textColor },
              ]}
              accessibilityLiveRegion="polite">
              {formatStopwatchDisplay(displaySeconds)}
            </Text>
            {expired ? (
              <Text style={[styles.expiredMessage, { color: EXPIRED_ACCENT }]}>Time&apos;s up!</Text>
            ) : null}
            {active ? (
              <Text style={[styles.runningHint, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}>
                {runningLabel}
              </Text>
            ) : null}
            <RNView style={styles.actionsRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel timer and reset"
                onPress={resetTimerAndClose}
                style={({ pressed }) => [
                  styles.secondaryAction,
                  { borderColor: EXPIRED_ACCENT, borderWidth: 1 },
                  pressed && styles.actionPressed,
                ]}>
                <Text style={[styles.secondaryActionLabel, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={primaryAccessibilityLabel}
                onPress={pauseOrResumeOrStart}
                style={({ pressed }) => [
                  showStopButton && active ? styles.secondaryAction : styles.primaryAction,
                  showStopButton && active
                    ? { borderColor: tint, borderWidth: 1 }
                    : { backgroundColor: tint },
                  pressed && styles.actionPressed,
                ]}>
                <Text
                  style={[
                    showStopButton && active ? styles.secondaryActionLabel : styles.primaryActionLabel,
                    {
                      color:
                        showStopButton && active
                          ? activeScheme === 'dark'
                            ? '#a3a3a3'
                            : '#737373'
                          : Colors[activeScheme].background,
                    },
                  ]}>
                  {primaryActionLabel}
                </Text>
              </Pressable>
              {showStopButton && active ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Stop timer and use elapsed time"
                  onPress={stopAndSave}
                  style={({ pressed }) => [
                    styles.primaryAction,
                    { backgroundColor: tint },
                    pressed && styles.actionPressed,
                  ]}>
                  <Text style={[styles.primaryActionLabel, { color: Colors[activeScheme].background }]}>Stop</Text>
                </Pressable>
              ) : null}
            </RNView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  timerButton: {
    borderWidth: 1,
    borderRadius: 10,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  timerButtonRunningCountdown: {
    width: 52,
    height: 52,
  },
  iconStack: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  runningTimeLabel: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    lineHeight: 12,
  },
  timerButtonDisabled: {
    opacity: 0.45,
  },
  timerButtonPressed: {
    opacity: 0.65,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  sheetHeader: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
    paddingHorizontal: 32,
  },
  sheetCloseButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    padding: 4,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  elapsedDisplay: {
    fontSize: 48,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  expiredMessage: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  runningHint: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryAction: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryActionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  primaryAction: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryActionLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionPressed: {
    opacity: 0.75,
  },
});
