import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Vibration, View as RNView } from 'react-native';

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
import type { DurationUnit } from '@/lib/durationUnits';

type Props = {
  timerId: string;
  durationUnit: DurationUnit;
  timerMode?: DurationTimerMode;
  countdownTargetSeconds?: number | null;
  countdownExerciseLabel?: string;
  countdownLogSession?: CountdownLogSession;
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

  const { isRunning, getTimerSnapshot, getDurationUnit, startTimer, setTimerNotificationScheduled, cancelTimer, finishTimer } =
    useDurationTimer();

  const [open, setOpen] = useState(false);
  const wasExpiredRef = useRef(false);

  const running = isRunning(timerId);
  const snapshot = running ? getTimerSnapshot(timerId) : null;
  const activeMode = snapshot?.mode ?? timerMode;
  const isCountdown = activeMode === 'countdown';
  const expired = snapshot?.expired ?? false;
  const displaySeconds = isCountdown
    ? (snapshot?.remainingSeconds ?? countdownTargetSeconds ?? 0)
    : (snapshot?.elapsedSeconds ?? 0);

  useEffect(() => {
    if (expired && !wasExpiredRef.current) {
      notifyCountdownExpired();
    }
    wasExpiredRef.current = expired;
  }, [expired]);

  useEffect(() => {
    if (!running) {
      wasExpiredRef.current = false;
    }
  }, [running]);

  const openModal = () => {
    setOpen(true);
  };

  const startTimerRun = () => {
    const startedAt = startTimer(timerId, {
      durationUnit,
      mode: timerMode,
      targetSeconds: countdownTargetSeconds,
      exerciseLabel: countdownExerciseLabel,
      countdownLogSession,
      notificationScheduled: false,
    });

    if (
      startedAt !== null &&
      timerMode === 'countdown' &&
      countdownTargetSeconds !== null &&
      countdownTargetSeconds > 0
    ) {
      const fireAtMs = startedAt + countdownTargetSeconds * 1000;
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
    }
  };

  const toggleStartStop = () => {
    if (running) {
      stopAndSave();
    } else {
      startTimerRun();
    }
  };

  const closeModal = () => {
    setOpen(false);
  };

  const cancelTimerAndClose = () => {
    cancelTimer(timerId);
    setOpen(false);
  };

  const stopAndSave = () => {
    const unit = getDurationUnit(timerId) ?? durationUnit;
    const finalSeconds = snapshot?.elapsedSeconds ?? 0;
    finishTimer(timerId);
    setOpen(false);
    const formatted = elapsedSecondsToDurationInput(finalSeconds, unit);
    if (formatted.length > 0) {
      onComplete(formatted);
    }
  };

  const buttonBorderColor = expired ? EXPIRED_ACCENT : running ? tint : borderColor;
  const buttonBackground = expired
    ? expiredHighlight
    : running
      ? runningHighlight
      : activeScheme === 'dark'
        ? '#171717'
        : '#fafafa';

  const runningLabel = expired
    ? 'Countdown finished. Overtime shown as negative time.'
    : isCountdown
      ? 'Countdown keeps running in the background when closed.'
      : 'Timer keeps running in the background when closed.';

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          expired
            ? `${accessibilityLabel}. Countdown finished.`
            : running
              ? `${accessibilityLabel}. Timer running.`
              : accessibilityLabel
        }
        accessibilityState={{ selected: running }}
        disabled={disabled}
        onPress={openModal}
        hitSlop={6}
        style={({ pressed }) => [
          styles.timerButton,
          {
            borderColor: buttonBorderColor,
            backgroundColor: buttonBackground,
          },
          disabled && styles.timerButtonDisabled,
          pressed && !disabled && styles.timerButtonPressed,
        ]}>
        <Ionicons
          name={isCountdown ? 'hourglass-outline' : running ? 'timer' : 'timer-outline'}
          size={22}
          color={disabled ? '#737373' : expired ? EXPIRED_ACCENT : tint}
        />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable style={styles.backdrop} onPress={closeModal}>
          <Pressable
            style={[styles.sheet, { backgroundColor: sheetBackground, borderColor }]}
            onPress={(event) => event.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: textColor }]}>
              {isCountdown ? 'Countdown' : 'Timer'}
            </Text>
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
            {running ? (
              <Text style={[styles.runningHint, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}>
                {runningLabel}
              </Text>
            ) : null}
            <RNView style={styles.actionsRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel timer without saving"
                onPress={cancelTimerAndClose}
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
                accessibilityLabel={running ? 'Stop timer and use elapsed time' : 'Start timer'}
                onPress={toggleStartStop}
                style={({ pressed }) => [
                  styles.primaryAction,
                  { backgroundColor: running ? EXPIRED_ACCENT : tint },
                  pressed && styles.actionPressed,
                ]}>
                <Text
                  style={[
                    styles.primaryActionLabel,
                    { color: running ? '#fff' : Colors[activeScheme].background },
                  ]}>
                  {running ? 'Stop' : 'Start'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close timer and keep running in background"
                onPress={closeModal}
                style={({ pressed }) => [
                  styles.secondaryAction,
                  { borderColor: tint, borderWidth: 1 },
                  pressed && styles.actionPressed,
                ]}>
                <Text style={[styles.secondaryActionLabel, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}>
                  Close
                </Text>
              </Pressable>
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
