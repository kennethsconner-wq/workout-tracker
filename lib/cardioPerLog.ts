import { formatCardioPerDistanceUnit, type CardioDistanceUnit } from '@/lib/cardioDistanceUnits';
import { normalizeCardioDistanceMode } from '@/lib/cardioDistanceMode';
import {
  formatDurationValue,
  normalizeDurationUnit,
  type DurationUnit,
} from '@/lib/durationUnits';
import type { LoggedCardioPerActualSet, WorkoutExercise } from '@/lib/types';

export function isCardioPerMode(
  exercise: Pick<WorkoutExercise, 'activityType' | 'cardioDistanceMode'>,
): boolean {
  return exercise.activityType === 'cardio' && normalizeCardioDistanceMode(exercise.cardioDistanceMode) === 'per';
}

export function cardioPerSegmentCount(
  exercise: Pick<WorkoutExercise, 'activityType' | 'cardioDistanceMode' | 'distance'>,
): number {
  if (!isCardioPerMode(exercise)) {
    return 0;
  }
  if (exercise.distance <= 0) {
    return 1;
  }
  return Math.max(1, Math.floor(exercise.distance));
}

export function cardioPerRowLabel(setIndex: number, distanceUnit: CardioDistanceUnit): string {
  const perUnit = formatCardioPerDistanceUnit(distanceUnit);
  const capitalized = perUnit.charAt(0).toUpperCase() + perUnit.slice(1);
  return `${capitalized} ${setIndex + 1}`;
}

export function buildDraftCardioPerActualSets(
  exercise: Pick<WorkoutExercise, 'activityType' | 'cardioDistanceMode' | 'distance' | 'durationUnit'>,
  loggedSets: LoggedCardioPerActualSet[],
): Array<{ actualDurationInput: string; actualDurationUnit: DurationUnit }> {
  const count = cardioPerSegmentCount(exercise);
  return Array.from({ length: count }, (_, setIndex) => {
    const logged = loggedSets[setIndex];
    return {
      actualDurationInput:
        logged && logged.actualDuration > 0
          ? formatDurationValue(logged.actualDuration, logged.actualDurationUnit)
          : '',
      actualDurationUnit: logged?.actualDurationUnit ?? normalizeDurationUnit(exercise.durationUnit),
    };
  });
}

export function readActualCardioPerSetsFromStored(exercise: Record<string, unknown>): LoggedCardioPerActualSet[] {
  const raw = exercise.actualCardioPerSets;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .map((item) => {
        const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        const actualDuration = typeof row.actualDuration === 'number' ? row.actualDuration : 0;
        if (actualDuration <= 0) {
          return null;
        }
        return {
          actualDuration,
          actualDurationUnit: normalizeDurationUnit(row.actualDurationUnit),
        };
      })
      .filter((item): item is LoggedCardioPerActualSet => item !== null);
  }
  return [];
}
