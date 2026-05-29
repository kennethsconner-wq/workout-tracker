import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View as RNView } from 'react-native';

import { useDurationTimer } from '@/components/DurationTimerProvider';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { elapsedSecondsToDurationInput, formatStopwatchDisplay } from '@/lib/durationTimer';
import type { DurationUnit } from '@/lib/durationUnits';

type Props = {
  timerId: string;
  durationUnit: DurationUnit;
  onComplete: (formattedValue: string) => void;
  disabled?: boolean;
  activeScheme: 'light' | 'dark';
  accessibilityLabel?: string;
};

export function DurationTimerButton({
  timerId,
  durationUnit,
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

  const { isRunning, getElapsedSeconds, getDurationUnit, startTimer, cancelTimer, finishTimer } =
    useDurationTimer();

  const [open, setOpen] = useState(false);
  const running = isRunning(timerId);
  const elapsedSeconds = running ? getElapsedSeconds(timerId) : 0;

  const openModal = () => {
    if (!running) {
      startTimer(timerId, durationUnit);
    }
    setOpen(true);
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
    const finalSeconds = getElapsedSeconds(timerId);
    finishTimer(timerId);
    setOpen(false);
    const formatted = elapsedSecondsToDurationInput(finalSeconds, unit);
    if (formatted.length > 0) {
      onComplete(formatted);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={running ? `${accessibilityLabel}. Timer running.` : accessibilityLabel}
        accessibilityState={{ selected: running }}
        disabled={disabled}
        onPress={openModal}
        hitSlop={6}
        style={({ pressed }) => [
          styles.timerButton,
          {
            borderColor: running ? tint : borderColor,
            backgroundColor: running
              ? runningHighlight
              : activeScheme === 'dark'
                ? '#171717'
                : '#fafafa',
          },
          disabled && styles.timerButtonDisabled,
          pressed && !disabled && styles.timerButtonPressed,
        ]}>
        <Ionicons
          name={running ? 'timer' : 'timer-outline'}
          size={22}
          color={disabled ? '#737373' : tint}
        />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable style={styles.backdrop} onPress={closeModal}>
          <Pressable
            style={[styles.sheet, { backgroundColor: sheetBackground, borderColor }]}
            onPress={(event) => event.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: textColor }]}>Timer</Text>
            <Text style={[styles.elapsedDisplay, { color: textColor }]} accessibilityLiveRegion="polite">
              {formatStopwatchDisplay(elapsedSeconds)}
            </Text>
            {running ? (
              <Text style={[styles.runningHint, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}>
                Timer keeps running in the background when closed.
              </Text>
            ) : null}
            <RNView style={styles.actionsRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel timer without saving"
                onPress={cancelTimerAndClose}
                style={({ pressed }) => [styles.secondaryAction, pressed && styles.actionPressed]}>
                <Text style={[styles.secondaryActionLabel, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}>
                  Cancel
                </Text>
              </Pressable>
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close timer and keep running in background"
                onPress={closeModal}
                style={({ pressed }) => [
                  styles.primaryAction,
                  { backgroundColor: tint },
                  pressed && styles.actionPressed,
                ]}>
                <Text style={[styles.primaryActionLabel, { color: Colors[activeScheme].background }]}>Close</Text>
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
