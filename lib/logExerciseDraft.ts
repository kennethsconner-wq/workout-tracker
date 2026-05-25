import type { ActivityType } from '@/lib/activityTypes';
import {
  DEFAULT_CARDIO_DISTANCE_UNIT,
  normalizeCardioDistanceUnit,
  parseCardioDistanceInput,
  type CardioDistanceUnit,
} from '@/lib/cardioDistanceUnits';
import {
  getCardioLogLayout,
  isCardioDistancePerDuration,
  isCardioDurationPerDistance,
  normalizeCardioPlanFields,
  type CardioDistanceTracking,
  type CardioDurationTracking,
  type CardioObjective,
  type LegacyCardioDistanceMode,
} from '@/lib/cardioPlan';
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
import { perSegmentObjectiveInputValue } from '@/lib/cardioPerLog';
import type { LoggedWorkoutExercise } from '@/lib/types';

export type LogExerciseDraftFields = {
  activityType: ActivityType;
  actualSets: Array<{ actualRepsInput: string; actualWeightInput: string }>;
  actualWeightUnit: WeightUnit;
  actualStretchSets: Array<{ actualDurationInput: string; actualDurationUnit: DurationUnit }>;
  actualCardioPerSets: Array<{
    actualDurationInput: string;
    actualDurationUnit: DurationUnit;
    actualDistanceInput: string;
    actualDistanceUnit: CardioDistanceUnit;
  }>;
  cardioObjective?: CardioObjective;
  cardioDurationTracking?: CardioDurationTracking;
  cardioDistanceTracking?: CardioDistanceTracking;
  /** @deprecated Migrated to cardioObjective + tracking fields. */
  cardioDistanceMode?: LegacyCardioDistanceMode;
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

function emptyCardioActuals(): Pick<
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
> {
  return {
    actualSets: [],
    actualWeightUnit: DEFAULT_WEIGHT_UNIT,
    actualStretchSets: [],
    actualCardioPerSets: [],
    actualDuration: 0,
    actualDurationUnit: DEFAULT_DURATION_UNIT,
    actualDistance: 0,
    actualDistanceUnit: DEFAULT_CARDIO_DISTANCE_UNIT,
    actualScore: '',
    actualScoreUnit: DEFAULT_SCORE_UNIT,
  };
}

export function hasLoggedExerciseInput(exercise: LogExerciseDraftFields): boolean {
  switch (exercise.activityType) {
    case 'strength':
      return exercise.actualSets.some(
        (set) => set.actualRepsInput.trim().length > 0 || set.actualWeightInput.trim().length > 0,
      );
    case 'cardio': {
      const layout = getCardioLogLayout({
        activityType: exercise.activityType,
        cardioObjective: exercise.cardioObjective,
        cardioDurationTracking: exercise.cardioDurationTracking,
        cardioDistanceTracking: exercise.cardioDistanceTracking,
        cardioDistanceMode: exercise.cardioDistanceMode,
        duration: exercise.plannedDuration,
        distance: exercise.plannedDistance,
      });
      if (layout === 'per_segment') {
        const segmentExercise = {
          activityType: 'cardio' as const,
          cardioObjective: exercise.cardioObjective,
          cardioDurationTracking: exercise.cardioDurationTracking,
          cardioDistanceTracking: exercise.cardioDistanceTracking,
          cardioDistanceMode: exercise.cardioDistanceMode,
          distance: exercise.plannedDistance,
          duration: exercise.plannedDuration,
          durationUnit: exercise.actualDurationUnit,
          distanceUnit: exercise.actualDistanceUnit,
        };
        const objectiveField = perSegmentObjectiveInputValue(segmentExercise);
        if (
          (objectiveField === 'actualDistanceInput' && exercise.actualDistanceInput.trim().length > 0) ||
          (objectiveField === 'actualDurationInput' && exercise.actualDurationInput.trim().length > 0)
        ) {
          return true;
        }
        if (isCardioDurationPerDistance(exercise)) {
          return exercise.actualCardioPerSets.some((set) => set.actualDurationInput.trim().length > 0);
        }
        return exercise.actualCardioPerSets.some((set) => set.actualDistanceInput.trim().length > 0);
      }
      if (layout === 'objective_only') {
        const plan = normalizeCardioPlanFields({
          activityType: 'cardio',
          duration: exercise.plannedDuration,
          distance: exercise.plannedDistance,
          cardioObjective: exercise.cardioObjective,
          cardioDurationTracking: exercise.cardioDurationTracking,
          cardioDistanceTracking: exercise.cardioDistanceTracking,
          cardioDistanceMode: exercise.cardioDistanceMode,
        });
        if (plan.cardioObjective === 'distance') {
          return exercise.actualDistanceInput.trim().length > 0;
        }
        return exercise.actualDurationInput.trim().length > 0;
      }
      return exercise.actualDurationInput.trim().length > 0 || exercise.actualDistanceInput.trim().length > 0;
    }
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

    return { ok: true, exercise: { ...emptyCardioActuals(), actualSets: parsedActualSets, actualWeightUnit } };
  }

  if (exercise.activityType === 'cardio') {
    const layout = getCardioLogLayout({
      activityType: exercise.activityType,
      cardioObjective: exercise.cardioObjective,
      cardioDurationTracking: exercise.cardioDurationTracking,
      cardioDistanceTracking: exercise.cardioDistanceTracking,
      cardioDistanceMode: exercise.cardioDistanceMode,
      duration: exercise.plannedDuration,
      distance: exercise.plannedDistance,
    });

    if (layout === 'per_segment') {
      const segmentExercise = {
        activityType: 'cardio' as const,
        cardioObjective: exercise.cardioObjective,
        cardioDurationTracking: exercise.cardioDurationTracking,
        cardioDistanceTracking: exercise.cardioDistanceTracking,
        cardioDistanceMode: exercise.cardioDistanceMode,
        distance: exercise.plannedDistance,
        duration: exercise.plannedDuration,
        durationUnit: exercise.actualDurationUnit,
        distanceUnit: exercise.actualDistanceUnit,
      };
      const objectiveField = perSegmentObjectiveInputValue(segmentExercise);
      const objectiveInput =
        objectiveField === 'actualDistanceInput'
          ? exercise.actualDistanceInput
          : exercise.actualDurationInput;
      const hasObjectiveInput = objectiveInput.trim().length > 0;
      const parsedActualCardioPerSets: LoggedWorkoutExercise['actualCardioPerSets'] = [];
      let parsedObjectiveDistance = 0;
      let parsedObjectiveDuration = 0;

      if (hasObjectiveInput) {
        if (isCardioDurationPerDistance(exercise)) {
          parsedObjectiveDistance = parseCardioDistanceInput(objectiveInput, exercise.actualDistanceUnit);
          if (!Number.isFinite(parsedObjectiveDistance) || parsedObjectiveDistance <= 0) {
            return {
              ok: false,
              title: 'Check your numbers',
              message: `Enter a positive total distance for "${exerciseName}".`,
            };
          }
        } else {
          parsedObjectiveDuration = parseDurationInput(objectiveInput, exercise.actualDurationUnit);
          if (!Number.isFinite(parsedObjectiveDuration) || parsedObjectiveDuration <= 0) {
            return {
              ok: false,
              title: 'Check your numbers',
              message: `Enter a positive total duration for "${exerciseName}".`,
            };
          }
        }
      } else {
        parsedObjectiveDistance = 0;
        parsedObjectiveDuration = 0;
      }

      if (isCardioDurationPerDistance(exercise)) {
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

          parsedActualCardioPerSets.push({
            actualDuration,
            actualDurationUnit,
            actualDistance: 0,
            actualDistanceUnit: DEFAULT_CARDIO_DISTANCE_UNIT,
          });
        }
      } else {
        for (let setIndex = 0; setIndex < exercise.actualCardioPerSets.length; setIndex++) {
          const actualSet = exercise.actualCardioPerSets[setIndex];
          const actualDistanceUnit = normalizeCardioDistanceUnit(actualSet.actualDistanceUnit);
          const actualDistance = parseCardioDistanceInput(actualSet.actualDistanceInput, actualDistanceUnit);

          if (!Number.isFinite(actualDistance) || actualDistance <= 0) {
            return {
              ok: false,
              title: 'Check your numbers',
              message: `Enter a positive distance for segment ${setIndex + 1} of "${exerciseName}".`,
            };
          }

          parsedActualCardioPerSets.push({
            actualDuration: 0,
            actualDurationUnit: DEFAULT_DURATION_UNIT,
            actualDistance,
            actualDistanceUnit,
          });
        }
      }

      return {
        ok: true,
        exercise: {
          ...emptyCardioActuals(),
          actualDuration: isCardioDistancePerDuration(exercise)
            ? hasObjectiveInput
              ? parsedObjectiveDuration
              : 0
            : 0,
          actualDurationUnit: exercise.actualDurationUnit,
          actualDistance: isCardioDurationPerDistance(exercise)
            ? hasObjectiveInput
              ? parsedObjectiveDistance
              : 0
            : 0,
          actualDistanceUnit: exercise.actualDistanceUnit,
          actualCardioPerSets: parsedActualCardioPerSets,
        },
      };
    }

    const actualDurationUnit = normalizeDurationUnit(exercise.actualDurationUnit);
    const actualDistanceUnit = normalizeCardioDistanceUnit(exercise.actualDistanceUnit);
    const actualDuration = parseDurationInput(exercise.actualDurationInput, actualDurationUnit);
    const actualDistance = parseCardioDistanceInput(exercise.actualDistanceInput, actualDistanceUnit);
    const hasDurationInput = exercise.actualDurationInput.trim().length > 0;
    const hasDistanceInput = exercise.actualDistanceInput.trim().length > 0;

    if (layout === 'objective_only') {
      const plan = normalizeCardioPlanFields({
        activityType: 'cardio',
        duration: exercise.plannedDuration,
        distance: exercise.plannedDistance,
        cardioObjective: exercise.cardioObjective,
        cardioDurationTracking: exercise.cardioDurationTracking,
        cardioDistanceTracking: exercise.cardioDistanceTracking,
        cardioDistanceMode: exercise.cardioDistanceMode,
      });
      if (plan.cardioObjective === 'distance') {
        if (!hasDistanceInput) {
          return {
            ok: false,
            title: 'Check your numbers',
            message: `Enter a distance for "${exerciseName}".`,
          };
        }
        if (!Number.isFinite(actualDistance) || actualDistance <= 0) {
          return {
            ok: false,
            title: 'Check your numbers',
            message: `Enter a positive distance for "${exerciseName}".`,
          };
        }
        return {
          ok: true,
          exercise: {
            ...emptyCardioActuals(),
            actualDistance,
            actualDistanceUnit,
          },
        };
      }
      if (!hasDurationInput) {
        return {
          ok: false,
          title: 'Check your numbers',
          message: `Enter a duration for "${exerciseName}".`,
        };
      }
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
          ...emptyCardioActuals(),
          actualDuration,
          actualDurationUnit,
        },
      };
    }

    if (!hasDurationInput) {
      return {
        ok: false,
        title: 'Check your numbers',
        message: `Enter a duration for "${exerciseName}".`,
      };
    }
    if (!hasDistanceInput) {
      return {
        ok: false,
        title: 'Check your numbers',
        message: `Enter a distance for "${exerciseName}".`,
      };
    }
    if (!Number.isFinite(actualDuration) || actualDuration <= 0) {
      return {
        ok: false,
        title: 'Check your numbers',
        message: `Enter a positive duration for "${exerciseName}".`,
      };
    }
    if (!Number.isFinite(actualDistance) || actualDistance <= 0) {
      return {
        ok: false,
        title: 'Check your numbers',
        message: `Enter a positive distance for "${exerciseName}".`,
      };
    }

    return {
      ok: true,
      exercise: {
        ...emptyCardioActuals(),
        actualDuration,
        actualDurationUnit,
        actualDistance,
        actualDistanceUnit,
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
        ...emptyCardioActuals(),
        actualDuration,
        actualDurationUnit,
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

    return { ok: true, exercise: { ...emptyCardioActuals(), actualStretchSets: parsedActualStretchSets } };
  }

  return { ok: false, title: 'Check your numbers', message: `Unknown activity type for "${exerciseName}".` };
}
