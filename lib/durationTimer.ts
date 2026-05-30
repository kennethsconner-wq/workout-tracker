import { durationToSeconds, isCardioDurationUnit, formatDurationValue, secondsToDurationValue, type DurationUnit } from '@/lib/durationUnits';
import { normalizeCardioPlanFields, type CardioObjective, type CardioDistanceTracking, type CardioDurationTracking, type LegacyCardioDistanceMode } from '@/lib/cardioPlan';
import type { ActivityType } from '@/lib/activityTypes';

export type DurationTimerMode = 'countup' | 'countdown';

export type DurationLogTimerConfig = {
  timerMode: DurationTimerMode;
  countdownTargetSeconds: number | null;
};

/** Format elapsed seconds as a stopwatch display (MM:SS or H:MM:SS). Supports negative overtime values. */
export function formatStopwatchDisplay(totalSeconds: number): string {
  const negative = totalSeconds < 0;
  const safe = Math.abs(totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);

  const body =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return negative ? `-${body}` : body;
}

/** Convert elapsed stopwatch seconds into a duration field value for the given unit. */
export function elapsedSecondsToDurationInput(elapsedSeconds: number, unit: DurationUnit): string {
  const value = secondsToDurationValue(elapsedSeconds, unit);
  if (value === null) {
    return '';
  }
  return formatDurationValue(value, unit);
}

export function countdownRemainingSeconds(elapsedSeconds: number, targetSeconds: number): number {
  return targetSeconds - elapsedSeconds;
}

export function isCountdownExpired(elapsedSeconds: number, targetSeconds: number): boolean {
  return elapsedSeconds >= targetSeconds;
}

/** Countdown for cardio logs when duration is the planned objective; otherwise count-up. */
export function resolveCardioDurationLogTimerConfig(exercise: {
  activityType: ActivityType;
  cardioObjective?: CardioObjective;
  cardioDurationTracking?: CardioDurationTracking;
  cardioDistanceTracking?: CardioDistanceTracking;
  cardioDistanceMode?: LegacyCardioDistanceMode;
  duration: number;
  durationUnit: DurationUnit;
}): DurationLogTimerConfig {
  if (exercise.activityType !== 'cardio') {
    return { timerMode: 'countup', countdownTargetSeconds: null };
  }
  const plan = normalizeCardioPlanFields({
    ...exercise,
    activityType: 'cardio',
    distance: 0,
  });
  if (plan.cardioObjective !== 'duration' || exercise.duration <= 0) {
    return { timerMode: 'countup', countdownTargetSeconds: null };
  }
  const targetSeconds = durationToSeconds(exercise.duration, exercise.durationUnit);
  if (!targetSeconds) {
    return { timerMode: 'countup', countdownTargetSeconds: null };
  }
  return resolvePlannedDurationLogTimerConfig({
    duration: exercise.duration,
    durationUnit: exercise.durationUnit,
  });
}

/** Countdown when planned duration uses seconds, minutes, or hours; otherwise count-up. */
export function resolvePlannedDurationLogTimerConfig(planned: {
  duration: number;
  durationUnit: DurationUnit;
}): DurationLogTimerConfig {
  if (!isCardioDurationUnit(planned.durationUnit)) {
    return { timerMode: 'countup', countdownTargetSeconds: null };
  }
  if (planned.duration <= 0) {
    return { timerMode: 'countup', countdownTargetSeconds: null };
  }
  const targetSeconds = durationToSeconds(planned.duration, planned.durationUnit);
  if (!targetSeconds) {
    return { timerMode: 'countup', countdownTargetSeconds: null };
  }
  return { timerMode: 'countdown', countdownTargetSeconds: targetSeconds };
}

/** Countdown for stretch logs when planned duration uses seconds, minutes, or hours; otherwise count-up. */
export function resolveStretchDurationLogTimerConfig(planned: {
  duration: number;
  durationUnit: DurationUnit;
}): DurationLogTimerConfig {
  return resolvePlannedDurationLogTimerConfig(planned);
}

/** Countdown for sport logs when planned duration uses seconds, minutes, or hours; otherwise count-up. */
export function resolveSportDurationLogTimerConfig(exercise: {
  duration: number;
  durationUnit: DurationUnit;
}): DurationLogTimerConfig {
  return resolvePlannedDurationLogTimerConfig({
    duration: exercise.duration,
    durationUnit: exercise.durationUnit,
  });
}
