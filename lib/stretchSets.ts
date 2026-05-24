import { DEFAULT_DURATION_UNIT, formatDurationValue, normalizeDurationUnit, type DurationUnit } from '@/lib/durationUnits';
import type { LoggedStretchActualSet, StretchSet, WorkoutExercise } from '@/lib/types';

export type StretchSetDraftRow = {
  duration: string;
  durationUnit: DurationUnit;
};

export function emptyStretchSetDraftRow(): StretchSetDraftRow {
  return { duration: '', durationUnit: DEFAULT_DURATION_UNIT };
}

export function resizeStretchSetDraftRows(rows: StretchSetDraftRow[], setCount: number): StretchSetDraftRow[] {
  const count = Math.max(1, Math.floor(setCount));
  if (rows.length === count) {
    return rows;
  }
  if (rows.length < count) {
    return [
      ...rows,
      ...Array.from({ length: count - rows.length }, () => emptyStretchSetDraftRow()),
    ];
  }
  return rows.slice(0, count);
}

export function stretchSetDraftRowsFromExercise(exercise: Pick<WorkoutExercise, 'sets' | 'duration' | 'durationUnit' | 'stretchSets'>): StretchSetDraftRow[] {
  if (Array.isArray(exercise.stretchSets) && exercise.stretchSets.length > 0) {
    return exercise.stretchSets.map((set) => ({
      duration: set.duration > 0 ? formatDurationValue(set.duration, set.durationUnit) : '',
      durationUnit: normalizeDurationUnit(set.durationUnit),
    }));
  }
  const setCount = Math.max(exercise.sets, 1);
  const durationUnit = normalizeDurationUnit(exercise.durationUnit);
  const duration =
    exercise.duration > 0 ? formatDurationValue(exercise.duration, durationUnit) : '';
  return Array.from({ length: setCount }, () => ({ duration, durationUnit }));
}

export function readStretchSetsFromExercise(
  exercise: Pick<WorkoutExercise, 'sets' | 'duration' | 'durationUnit' | 'stretchSets'>,
): StretchSet[] {
  if (Array.isArray(exercise.stretchSets) && exercise.stretchSets.length > 0) {
    return exercise.stretchSets.map((set) => ({
      duration: set.duration,
      durationUnit: normalizeDurationUnit(set.durationUnit),
    }));
  }
  const setCount = Math.max(exercise.sets, 0);
  if (setCount <= 0 || exercise.duration <= 0) {
    return [];
  }
  const durationUnit = normalizeDurationUnit(exercise.durationUnit);
  return Array.from({ length: setCount }, () => ({
    duration: exercise.duration,
    durationUnit,
  }));
}

export function stretchActualSetsFromLogged(
  sets: LoggedStretchActualSet[],
  planned: StretchSet[],
): Array<{ actualDurationInput: string; actualDurationUnit: DurationUnit }> {
  if (sets.length > 0) {
    return sets.map((set) => ({
      actualDurationInput:
        set.actualDuration > 0 ? formatDurationValue(set.actualDuration, set.actualDurationUnit) : '',
      actualDurationUnit: normalizeDurationUnit(set.actualDurationUnit),
    }));
  }
  const setCount = Math.max(planned.length, 1);
  return Array.from({ length: setCount }, () => ({
    actualDurationInput: '',
    actualDurationUnit: planned[0]?.durationUnit ?? DEFAULT_DURATION_UNIT,
  }));
}

export function readStretchSetsFromStored(
  exercise: Record<string, unknown>,
  activityType: WorkoutExercise['activityType'],
): StretchSet[] | undefined {
  if (activityType !== 'stretch') {
    return undefined;
  }
  const raw = exercise.stretchSets;
  if (Array.isArray(raw) && raw.length > 0) {
    const parsed = raw
      .map((item) => {
        const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        const duration = typeof row.duration === 'number' ? row.duration : 0;
        if (duration <= 0) {
          return null;
        }
        return {
          duration,
          durationUnit: normalizeDurationUnit(row.durationUnit),
        };
      })
      .filter((item): item is StretchSet => item !== null);
    if (parsed.length > 0) {
      return parsed;
    }
  }
  const sets = typeof exercise.sets === 'number' ? exercise.sets : 0;
  const duration =
    typeof exercise.duration === 'number'
      ? exercise.duration
      : typeof exercise.durationMinutes === 'number'
        ? exercise.durationMinutes
        : 0;
  const durationUnit = normalizeDurationUnit(exercise.durationUnit);
  if (sets > 0 && duration > 0) {
    return Array.from({ length: sets }, () => ({ duration, durationUnit }));
  }
  return undefined;
}

export function readActualStretchSetsFromStored(exercise: Record<string, unknown>): LoggedStretchActualSet[] {
  const raw = exercise.actualStretchSets;
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
      .filter((item): item is LoggedStretchActualSet => item !== null);
  }
  const legacySetCount =
    typeof exercise.actualSetCount === 'number' ? Math.max(0, Math.floor(exercise.actualSetCount)) : 0;
  const legacyDuration =
    typeof exercise.actualDuration === 'number'
      ? exercise.actualDuration
      : typeof exercise.actualDurationMinutes === 'number'
        ? exercise.actualDurationMinutes
        : 0;
  const legacyDurationUnit = normalizeDurationUnit(exercise.actualDurationUnit);
  if (legacySetCount > 0 && legacyDuration > 0) {
    return Array.from({ length: legacySetCount }, () => ({
      actualDuration: legacyDuration,
      actualDurationUnit: legacyDurationUnit,
    }));
  }
  return [];
}
