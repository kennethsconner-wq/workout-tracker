import type { ActivityType } from '@/lib/activityTypes';
import {
  DEFAULT_CARDIO_DISTANCE_UNIT,
  normalizeCardioDistanceUnit,
  parseCardioDistanceInput,
  type CardioDistanceUnit,
} from '@/lib/cardioDistanceUnits';
import {
  DEFAULT_DURATION_UNIT,
  normalizeDurationUnit,
  parseDurationInput,
  type DurationUnit,
} from '@/lib/durationUnits';
import type { LoggedWorkoutExercise } from '@/lib/types';

export type LogExerciseDraftFields = {
  activityType: ActivityType;
  actualSets: Array<{ actualRepsInput: string; actualWeightKgInput: string }>;
  actualDurationInput: string;
  actualDurationUnit: DurationUnit;
  actualDistanceInput: string;
  actualDistanceUnit: CardioDistanceUnit;
  actualScoreInput: string;
};

export type ParseLoggedExerciseResult =
  | {
      ok: true;
      exercise: Pick<
        LoggedWorkoutExercise,
        'actualSets' | 'actualDuration' | 'actualDurationUnit' | 'actualDistance' | 'actualDistanceUnit' | 'actualScore'
      >;
    }
  | { ok: false; title: string; message: string };

export function hasLoggedExerciseInput(exercise: LogExerciseDraftFields): boolean {
  switch (exercise.activityType) {
    case 'strength':
      return exercise.actualSets.some(
        (set) => set.actualRepsInput.trim().length > 0 || set.actualWeightKgInput.trim().length > 0,
      );
    case 'cardio':
      return exercise.actualDurationInput.trim().length > 0 || exercise.actualDistanceInput.trim().length > 0;
    case 'sport':
      return exercise.actualDurationInput.trim().length > 0 || exercise.actualScoreInput.trim().length > 0;
    default:
      return false;
  }
}

export function parseLoggedExerciseFromDraft(
  exercise: LogExerciseDraftFields,
  exerciseName: string,
): ParseLoggedExerciseResult {
  if (exercise.activityType === 'strength') {
    const parsedActualSets: LoggedWorkoutExercise['actualSets'] = [];
    for (let setIndex = 0; setIndex < exercise.actualSets.length; setIndex++) {
      const actualSet = exercise.actualSets[setIndex];
      const actualReps = Number.parseInt(actualSet.actualRepsInput.trim(), 10);
      const actualWeightKg = Number.parseFloat(actualSet.actualWeightKgInput.trim().replace(',', '.'));

      if (!Number.isFinite(actualReps) || actualReps <= 0) {
        return {
          ok: false,
          title: 'Check your numbers',
          message: `Enter positive reps for set ${setIndex + 1} of "${exerciseName}".`,
        };
      }
      if (!Number.isFinite(actualWeightKg) || actualWeightKg < 0) {
        return {
          ok: false,
          title: 'Check your numbers',
          message: `Enter a valid weight (0 for bodyweight) for set ${setIndex + 1} of "${exerciseName}".`,
        };
      }

      parsedActualSets.push({ actualReps, actualWeightKg });
    }

    return {
      ok: true,
      exercise: {
        actualSets: parsedActualSets,
        actualDuration: 0,
        actualDurationUnit: DEFAULT_DURATION_UNIT,
        actualDistance: 0,
        actualDistanceUnit: DEFAULT_CARDIO_DISTANCE_UNIT,
        actualScore: '',
      },
    };
  }

  if (exercise.activityType === 'cardio') {
    const durationRaw = exercise.actualDurationInput.trim();
    const hasDurationInput = durationRaw.length > 0;
    const hasDistanceInput = exercise.actualDistanceInput.trim().length > 0;
    const actualDurationUnit = normalizeDurationUnit(exercise.actualDurationUnit);
    const actualDistanceUnit = normalizeCardioDistanceUnit(exercise.actualDistanceUnit);
    const actualDuration = parseDurationInput(exercise.actualDurationInput, actualDurationUnit);
    const actualDistance = parseCardioDistanceInput(exercise.actualDistanceInput, actualDistanceUnit);

    if (!hasDurationInput && !hasDistanceInput) {
      return {
        ok: false,
        title: 'Check your numbers',
        message: `"${exerciseName}" needs a duration, a distance, or both.`,
      };
    }
    if (hasDurationInput && (!Number.isFinite(actualDuration) || actualDuration <= 0)) {
      return {
        ok: false,
        title: 'Check your numbers',
        message: `Enter a positive duration for "${exerciseName}".`,
      };
    }
    if (hasDistanceInput && (!Number.isFinite(actualDistance) || actualDistance < 0)) {
      return {
        ok: false,
        title: 'Check your numbers',
        message: `Enter a valid distance for "${exerciseName}".`,
      };
    }

    return {
      ok: true,
      exercise: {
        actualSets: [],
        actualDuration,
        actualDurationUnit,
        actualDistance,
        actualDistanceUnit,
        actualScore: '',
      },
    };
  }

  const actualDurationUnit = normalizeDurationUnit(exercise.actualDurationUnit);
  const actualDuration = parseDurationInput(exercise.actualDurationInput, actualDurationUnit);
  const actualScore = exercise.actualScoreInput.trim();
  if (!Number.isFinite(actualDuration) || actualDuration <= 0) {
    return {
      ok: false,
      title: 'Check your numbers',
      message: `Enter a positive duration for "${exerciseName}".`,
    };
  }

  return {
    ok: true,
    exercise: {
      actualSets: [],
      actualDuration,
      actualDurationUnit,
      actualDistance: 0,
      actualDistanceUnit: DEFAULT_CARDIO_DISTANCE_UNIT,
      actualScore,
    },
  };
}
