import { formatDurationValue, secondsToDurationValue, type DurationUnit } from '@/lib/durationUnits';

/** Format elapsed seconds as a stopwatch display (MM:SS or H:MM:SS). */
export function formatStopwatchDisplay(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Convert elapsed stopwatch seconds into a duration field value for the given unit. */
export function elapsedSecondsToDurationInput(elapsedSeconds: number, unit: DurationUnit): string {
  const value = secondsToDurationValue(elapsedSeconds, unit);
  if (value === null) {
    return '';
  }
  return formatDurationValue(value, unit);
}
