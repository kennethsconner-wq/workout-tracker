import { themedAlert } from '@/lib/themedAlert';

/** Warn before editing an exercise that is shared across workouts (same exercise id). */
export function confirmEditLinkedExercise(onConfirm: () => void): void {
  themedAlert(
    'Edit linked exercise?',
    'Changing this exercise updates it everywhere it appears in your workouts. Your workout metrics will reflect those changes.\n\nContinue anyway?',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: onConfirm },
    ],
  );
}
