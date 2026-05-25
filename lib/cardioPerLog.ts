import { DISPLAY_DECIMAL_PLACES } from '@/lib/displayDecimals';
import {
  DEFAULT_CARDIO_DISTANCE_UNIT,
  formatCardioDistanceValue,
  formatCardioPerDistanceUnit,
  normalizeCardioDistanceUnit,
  parseCardioDistanceInput,
  usesIntegerDistanceInput,
  type CardioDistanceUnit,
} from '@/lib/cardioDistanceUnits';
import {
  durationUnitAbbreviation,
  isCardioDistancePerDuration,
  isCardioDurationPerDistance,
  isCardioPerSegmentLogging,
} from '@/lib/cardioPlan';
import {
  DEFAULT_DURATION_UNIT,
  formatDurationValue,
  normalizeDurationUnit,
  parseDurationInput,
  usesIntegerDurationInput,
  type DurationUnit,
} from '@/lib/durationUnits';
import type { LoggedCardioPerActualSet, WorkoutExercise } from '@/lib/types';

export type CardioPerSegmentExercise = Pick<
  WorkoutExercise,
  | 'activityType'
  | 'cardioObjective'
  | 'cardioDurationTracking'
  | 'cardioDistanceTracking'
  | 'cardioDistanceMode'
  | 'distance'
  | 'duration'
  | 'durationUnit'
  | 'distanceUnit'
>;

export function isCardioPerMode(
  exercise: Pick<
    WorkoutExercise,
    'activityType' | 'cardioObjective' | 'cardioDurationTracking' | 'cardioDistanceTracking' | 'cardioDistanceMode'
  > &
    Partial<Pick<WorkoutExercise, 'duration' | 'distance'>>,
): boolean {
  return isCardioPerSegmentLogging(exercise);
}

export function cardioPerSegmentUsesIntegerObjectiveUnits(exercise: CardioPerSegmentExercise): boolean {
  if (isCardioDurationPerDistance(exercise)) {
    return usesIntegerDistanceInput(exercise.distanceUnit);
  }
  if (isCardioDistancePerDuration(exercise)) {
    return usesIntegerDurationInput(exercise.durationUnit);
  }
  return false;
}

export function cardioPerSegmentCountForObjectiveTotal(total: number, usesIntegerUnits: boolean): number {
  if (!Number.isFinite(total) || total <= 0) {
    return 1;
  }
  const fullUnits = Math.floor(total);
  const hasPartial = !usesIntegerUnits && total - fullUnits > 1e-9;
  return Math.max(1, fullUnits + (hasPartial ? 1 : 0));
}

export function resolveCardioPerSegmentObjectiveTotal(
  exercise: CardioPerSegmentExercise,
  actualObjectiveInput: string,
): number {
  const trimmed = actualObjectiveInput.trim();
  if (trimmed.length > 0) {
    const parsed = isCardioDurationPerDistance(exercise)
      ? parseCardioDistanceInput(trimmed, exercise.distanceUnit)
      : parseDurationInput(trimmed, exercise.durationUnit);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  if (isCardioDurationPerDistance(exercise)) {
    return exercise.distance > 0 ? exercise.distance : 1;
  }
  if (isCardioDistancePerDuration(exercise)) {
    return exercise.duration > 0 ? exercise.duration : 1;
  }
  return 1;
}

export function cardioPerSegmentCount(
  exercise: CardioPerSegmentExercise,
  actualObjectiveInput = '',
): number {
  if (!isCardioPerSegmentLogging(exercise)) {
    return 0;
  }
  const total = resolveCardioPerSegmentObjectiveTotal(exercise, actualObjectiveInput);
  return cardioPerSegmentCountForObjectiveTotal(total, cardioPerSegmentUsesIntegerObjectiveUnits(exercise));
}

export function cardioPerRowLabel(setIndex: number, distanceUnit: CardioDistanceUnit): string {
  const perUnit = formatCardioPerDistanceUnit(distanceUnit);
  const capitalized = perUnit.charAt(0).toUpperCase() + perUnit.slice(1);
  return `${capitalized} ${setIndex + 1}`;
}

export function cardioPerDurationRowLabel(setIndex: number, durationUnit: DurationUnit): string {
  const perUnit = durationUnitAbbreviation(durationUnit);
  const capitalized = perUnit.charAt(0).toUpperCase() + perUnit.slice(1);
  return `${capitalized} ${setIndex + 1}`;
}

export function cardioPerSegmentLabel(
  setIndex: number,
  segmentCount: number,
  objectiveTotal: number,
  exercise: CardioPerSegmentExercise,
): string {
  const usesInteger = cardioPerSegmentUsesIntegerObjectiveUnits(exercise);
  const fullUnits = Math.floor(objectiveTotal);
  const hasPartial = !usesInteger && objectiveTotal - fullUnits > 1e-9;
  const isLastPartial = hasPartial && setIndex === segmentCount - 1;

  if (isLastPartial) {
    if (isCardioDurationPerDistance(exercise)) {
      const perUnit = formatCardioPerDistanceUnit(exercise.distanceUnit);
      const capitalized = perUnit.charAt(0).toUpperCase() + perUnit.slice(1);
      return `${capitalized} ${formatCardioDistanceValue(objectiveTotal, exercise.distanceUnit, DISPLAY_DECIMAL_PLACES)}`;
    }
    const perUnit = durationUnitAbbreviation(exercise.durationUnit);
    const capitalized = perUnit.charAt(0).toUpperCase() + perUnit.slice(1);
    return `${capitalized} ${formatDurationValue(objectiveTotal, exercise.durationUnit, DISPLAY_DECIMAL_PLACES)}`;
  }

  return isCardioDurationPerDistance(exercise)
    ? cardioPerRowLabel(setIndex, exercise.distanceUnit)
    : cardioPerDurationRowLabel(setIndex, exercise.durationUnit);
}

export function cardioPerSegmentObjectiveInput(exercise: CardioPerSegmentExercise): 'actualDistanceInput' | 'actualDurationInput' {
  return perSegmentObjectiveInputValue(exercise);
}

export type DraftCardioPerActualSetFields = {
  actualDurationInput: string;
  actualDurationUnit: DurationUnit;
  actualDistanceInput: string;
  actualDistanceUnit: CardioDistanceUnit;
};

export function buildDraftCardioPerActualSets(
  exercise: CardioPerSegmentExercise,
  loggedSets: LoggedCardioPerActualSet[],
  actualObjectiveInput = '',
): DraftCardioPerActualSetFields[] {
  const count = cardioPerSegmentCount(exercise, actualObjectiveInput);
  const logsDuration = isCardioDurationPerDistance(exercise);
  return Array.from({ length: count }, (_, setIndex) => {
    const logged = loggedSets[setIndex];
    return {
      actualDurationInput:
        logsDuration && logged && logged.actualDuration > 0
          ? formatDurationValue(logged.actualDuration, logged.actualDurationUnit)
          : '',
      actualDurationUnit: logged?.actualDurationUnit ?? normalizeDurationUnit(exercise.durationUnit),
      actualDistanceInput:
        !logsDuration && logged && logged.actualDistance > 0
          ? formatCardioDistanceValue(logged.actualDistance, logged.actualDistanceUnit)
          : '',
      actualDistanceUnit: logged?.actualDistanceUnit ?? exercise.distanceUnit,
    };
  });
}

export function perSegmentObjectiveInputValue(
  exercise: CardioPerSegmentExercise,
): 'actualDistanceInput' | 'actualDurationInput' {
  return isCardioDurationPerDistance(exercise) ? 'actualDistanceInput' : 'actualDurationInput';
}

export function resizeDraftCardioPerSets<T extends DraftCardioPerActualSetFields>(
  exercise: CardioPerSegmentExercise,
  existing: T[],
  actualObjectiveInput: string,
  createRow: (fields: DraftCardioPerActualSetFields) => T,
): T[] {
  const newCount = cardioPerSegmentCount(exercise, actualObjectiveInput);
  if (existing.length === newCount) {
    return existing;
  }
  if (existing.length > newCount) {
    return existing.slice(0, newCount);
  }
  const built = buildDraftCardioPerActualSets(exercise, [], actualObjectiveInput);
  const next = [...existing];
  for (let index = existing.length; index < newCount; index++) {
    next.push(createRow(built[index] ?? built[built.length - 1]));
  }
  return next;
}

export function readActualCardioPerSetsFromStored(exercise: Record<string, unknown>): LoggedCardioPerActualSet[] {
  const raw = exercise.actualCardioPerSets;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .map((item) => {
        const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        const actualDuration = typeof row.actualDuration === 'number' ? row.actualDuration : 0;
        const actualDistance = typeof row.actualDistance === 'number' ? row.actualDistance : 0;
        if (actualDuration <= 0 && actualDistance <= 0) {
          return null;
        }
        return {
          actualDuration,
          actualDurationUnit: normalizeDurationUnit(row.actualDurationUnit),
          actualDistance,
          actualDistanceUnit: normalizeCardioDistanceUnit(row.actualDistanceUnit),
        };
      })
      .filter((item): item is LoggedCardioPerActualSet => item !== null);
  }
  return [];
}
