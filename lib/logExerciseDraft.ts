import type { ActivityType } from '@/lib/activityTypes';
import { isCardioPerMode } from '@/lib/cardioPerLog';
import {
  DEFAULT_CARDIO_DISTANCE_UNIT,
  normalizeCardioDistanceUnit,
  parseCardioDistanceInput,
  type CardioDistanceUnit,
} from '@/lib/cardioDistanceUnits';
import type { CardioDistanceMode } from '@/lib/cardioDistanceMode';
import { normalizeCardioDistanceMode } from '@/lib/cardioDistanceMode';
import {
  DEFAULT_DURATION_UNIT,
  normalizeDurationUnit,
  parseDurationInput,
  type DurationUnit,
} from '@/lib/durationUnits';
import {
  DEFAULT_SCORE_UNIT,
  normalizeScoreUnit,
  type ScoreUnit,
} from '@/lib/scoreUnits';
import { DEFAULT_WEIGHT_UNIT, normalizeWeightUnit, type WeightUnit } from '@/lib/weightUnits';
import type { LoggedWorkoutExercise } from '@/lib/types';

export type LogExerciseDraftFields = {
  activityType: ActivityType;
  actualSets: Array<{ actualRepsInput: string; actualWeightInput: string }>;
  actualWeightUnit: WeightUnit;
  actualStretchSets: Array<{ actualDurationInput: string; actualDurationUnit: DurationUnit }>;
  actualCardioPerSets: Array<{ actualDurationInput: string; actualDurationUnit: DurationUnit }>;
  cardioDistanceMode?: CardioDistanceMode;
  plannedDuration: number;
  plannedDistance: number;
  actualDurationInput: string;
  actualDurationUnit: DurationUnit;
  actualDistanceInput: string;
  actualDistanceUnit: CardioDistanceUnit;
  actualScoreInput: string;
  actualScoreUnit: ScoreUnit;
};

export type ParseLoggedExerciseResult =
  | {
      ok: true;
      exercise: Pick<
        LoggedWorkoutExercise,
        | 'actualSets'
        | 'actualWeightUnit'
        | 'actualStretchSets'
        | 'actualCardioPerSets'
        | 'actualDuration'
        | 'actualDurationUnit'
        | 'actualDistance'
        | 'actualDistanceUnit'
        | 'actualScore'
        | 'actualScoreUnit'
      >;
    }
  | { ok: false; title: string; message: string };

export function hasLoggedExerciseInput(exercise: LogExerciseDraftFields): boolean {
  switch (exercise.activityType) {
    case 'strength':
      return exercise.actualSets.some(
        (set) => set.actualRepsInput.trim().length > 0 || set.actualWeightInput.trim().length > 0,
      );
    case 'cardio':
      if (isCardioPerMode(exercise)) {
        return exercise.actualCardioPerSets.some((set) => set.actualDurationInput.trim().length > 0);
      }
      return exercise.actualDurationInput.trim().length > 0 || exercise.actualDistanceInput.trim().length > 0;
    case 'sport':
      return exercise.actualDurationInput.trim().length > 0 || exercise.actualScoreInput.trim().length > 0;
    case 'stretch':
      return exercise.actualStretchSets.some((set) => set.actualDurationInput.trim().length > 0);
    default:
      return false;
  }
}

export function parseLoggedExerciseFromDraft(
  exercise: LogExerciseDraftFields,
  exerciseName: string,
): ParseLoggedExerciseResult {
  if (exercise.activityType === 'strength') {
    const actualWeightUnit = normalizeWeightUnit(exercise.actualWeightUnit);
    const parsedActualSets: LoggedWorkoutExercise['actualSets'] = [];
    for (let setIndex = 0; setIndex < exercise.actualSets.length; setIndex++) {
      const actualSet = exercise.actualSets[setIndex];
      const actualReps = Number.parseInt(actualSet.actualRepsInput.trim(), 10);
      const actualWeight = Number.parseFloat(actualSet.actualWeightInput.trim().replace(',', '.'));

      if (!Number.isFinite(actualReps) || actualReps <= 0) {
        return {
          ok: false,
          title: 'Check your numbers',
          message: `Enter positive reps for set ${setIndex + 1} of "${exerciseName}".`,
        };
      }
      if (!Number.isFinite(actualWeight) || actualWeight < 0) {
        return {
          ok: false,
          title: 'Check your numbers',
          message: `Enter a valid weight (0 for bodyweight) for set ${setIndex + 1} of "${exerciseName}".`,
        };
      }

      parsedActualSets.push({ actualReps, actualWeight });
    }

    return {
      ok: true,
      exercise: {
        actualSets: parsedActualSets,
        actualWeightUnit,
        actualStretchSets: [],
        actualCardioPerSets: [],
        actualDuration: 0,
        actualDurationUnit: DEFAULT_DURATION_UNIT,
        actualDistance: 0,
        actualDistanceUnit: DEFAULT_CARDIO_DISTANCE_UNIT,
        actualScore: '',
        actualScoreUnit: DEFAULT_SCORE_UNIT,
      },
    };
  }

  if (exercise.activityType === 'cardio') {
    const mode = normalizeCardioDistanceMode(exercise.cardioDistanceMode);

    if (mode === 'per') {
      const parsedActualCardioPerSets: LoggedWorkoutExercise['actualCardioPerSets'] = [];
      for (let setIndex = 0; setIndex < exercise.actualCardioPerSets.length; setIndex++) {
        const actualSet = exercise.actualCardioPerSets[setIndex];
        const actualDurationUnit = normalizeDurationUnit(actualSet.actualDurationUnit);
        const actualDuration = parseDurationInput(actualSet.actualDurationInput, actualDurationUnit);

        if (!Number.isFinite(actualDuration) || actualDuration <= 0) {
          return {
            ok: false,
            title: 'Check your numbers',
            message: `Enter a positive duration for segment ${setIndex + 1} of "${exerciseName}".`,
          };
        }

        parsedActualCardioPerSets.push({ actualDuration, actualDurationUnit });
      }

      return {
        ok: true,
        exercise: {
          actualSets: [],
          actualWeightUnit: DEFAULT_WEIGHT_UNIT,
          actualStretchSets: [],
          actualCardioPerSets: parsedActualCardioPerSets,
          actualDuration: 0,
          actualDurationUnit: DEFAULT_DURATION_UNIT,
          actualDistance: 0,
          actualDistanceUnit: DEFAULT_CARDIO_DISTANCE_UNIT,
          actualScore: '',
          actualScoreUnit: DEFAULT_SCORE_UNIT,
        },
      };
    }

    const durationRaw = exercise.actualDurationInput.trim();
    const hasDurationInput = durationRaw.length > 0;
    const hasDistanceInput = exercise.actualDistanceInput.trim().length > 0;
    const planHasDuration = exercise.plannedDuration > 0;
    const planHasDistance = exercise.plannedDistance > 0;
    const actualDurationUnit = normalizeDurationUnit(exercise.actualDurationUnit);
    const actualDistanceUnit = normalizeCardioDistanceUnit(exercise.actualDistanceUnit);
    const actualDuration = parseDurationInput(exercise.actualDurationInput, actualDurationUnit);
    const actualDistance = parseCardioDistanceInput(exercise.actualDistanceInput, actualDistanceUnit);

    if (!planHasDuration && !planHasDistance && !hasDurationInput && !hasDistanceInput) {
      return {
        ok: false,
        title: 'Check your numbers',
        message: `"${exerciseName}" needs a duration, a distance, or both.`,
      };
    }
    if (planHasDuration && !hasDurationInput) {
      return {
        ok: false,
        title: 'Check your numbers',
        message: `Enter a duration for "${exerciseName}".`,
      };
    }
    if (planHasDistance && !hasDistanceInput) {
      return {
        ok: false,
        title: 'Check your numbers',
        message: `Enter a distance for "${exerciseName}".`,
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
        actualWeightUnit: DEFAULT_WEIGHT_UNIT,
        actualStretchSets: [],
        actualCardioPerSets: [],
        actualDuration,
        actualDurationUnit,
        actualDistance,
        actualDistanceUnit,
        actualScore: '',
        actualScoreUnit: DEFAULT_SCORE_UNIT,
      },
    };
  }

  if (exercise.activityType === 'sport') {
    const actualDurationUnit = normalizeDurationUnit(exercise.actualDurationUnit);
    const durationRaw = exercise.actualDurationInput.trim();
    const hasDurationInput = durationRaw.length > 0;
    const actualScore = exercise.actualScoreInput.trim();
    const hasScoreInput = actualScore.length > 0;
    const actualDuration = parseDurationInput(exercise.actualDurationInput, actualDurationUnit);

    if (!hasDurationInput && !hasScoreInput) {
      return {
        ok: false,
        title: 'Check your numbers',
        message: `"${exerciseName}" needs a duration, a score, or both.`,
      };
    }
    if (hasDurationInput && (!Number.isFinite(actualDuration) || actualDuration <= 0)) {
      return {
        ok: false,
        title: 'Check your numbers',
        message: `Enter a positive duration for "${exerciseName}".`,
      };
    }

    const actualScoreUnit = normalizeScoreUnit(exercise.actualScoreUnit);

    return {
      ok: true,
      exercise: {
        actualSets: [],
        actualWeightUnit: DEFAULT_WEIGHT_UNIT,
        actualStretchSets: [],
        actualCardioPerSets: [],
        actualDuration,
        actualDurationUnit,
        actualDistance: 0,
        actualDistanceUnit: DEFAULT_CARDIO_DISTANCE_UNIT,
        actualScore,
        actualScoreUnit,
      },
    };
  }

  if (exercise.activityType === 'stretch') {
    const parsedActualStretchSets: LoggedWorkoutExercise['actualStretchSets'] = [];
    for (let setIndex = 0; setIndex < exercise.actualStretchSets.length; setIndex++) {
      const actualSet = exercise.actualStretchSets[setIndex];
      const actualDurationUnit = normalizeDurationUnit(actualSet.actualDurationUnit);
      const actualDuration = parseDurationInput(actualSet.actualDurationInput, actualDurationUnit);

      if (!Number.isFinite(actualDuration) || actualDuration <= 0) {
        return {
          ok: false,
          title: 'Check your numbers',
          message: `Enter a positive duration for set ${setIndex + 1} of "${exerciseName}".`,
        };
      }

      parsedActualStretchSets.push({ actualDuration, actualDurationUnit });
    }

    return {
      ok: true,
      exercise: {
        actualSets: [],
        actualWeightUnit: DEFAULT_WEIGHT_UNIT,
        actualStretchSets: parsedActualStretchSets,
        actualCardioPerSets: [],
        actualDuration: 0,
        actualDurationUnit: DEFAULT_DURATION_UNIT,
        actualDistance: 0,
        actualDistanceUnit: DEFAULT_CARDIO_DISTANCE_UNIT,
        actualScore: '',
        actualScoreUnit: DEFAULT_SCORE_UNIT,
      },
    };
  }

  return { ok: false, title: 'Check your numbers', message: `Unknown activity type for "${exerciseName}".` };
}
