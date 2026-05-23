import type { ActivityType } from '@/lib/activityTypes';
import type { LoggedWorkoutExercise } from '@/lib/types';

export type LogExerciseDraftFields = {
  activityType: ActivityType;
  actualSets: Array<{ actualRepsInput: string; actualWeightKgInput: string }>;
  actualDurationMinutesInput: string;
  actualDistanceMilesInput: string;
  actualScoreInput: string;
};

export type ParseLoggedExerciseResult =
  | { ok: true; exercise: Pick<LoggedWorkoutExercise, 'actualSets' | 'actualDurationMinutes' | 'actualDistanceMiles' | 'actualScore'> }
  | { ok: false; title: string; message: string };

export function hasLoggedExerciseInput(exercise: LogExerciseDraftFields): boolean {
  switch (exercise.activityType) {
    case 'strength':
      return exercise.actualSets.some(
        (set) => set.actualRepsInput.trim().length > 0 || set.actualWeightKgInput.trim().length > 0,
      );
    case 'cardio':
      return exercise.actualDurationMinutesInput.trim().length > 0 || exercise.actualDistanceMilesInput.trim().length > 0;
    case 'sport':
      return exercise.actualDurationMinutesInput.trim().length > 0 || exercise.actualScoreInput.trim().length > 0;
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
        actualDurationMinutes: 0,
        actualDistanceMiles: 0,
        actualScore: '',
      },
    };
  }

  if (exercise.activityType === 'cardio') {
    const actualDurationMinutes = Number.parseInt(exercise.actualDurationMinutesInput.trim(), 10);
    const distanceRaw = exercise.actualDistanceMilesInput.trim().replace(',', '.');
    const actualDistanceMiles = distanceRaw.length > 0 ? Number.parseFloat(distanceRaw) : 0;

    if (!Number.isFinite(actualDurationMinutes) || actualDurationMinutes <= 0) {
      return {
        ok: false,
        title: 'Check your numbers',
        message: `Enter a positive duration in minutes for "${exerciseName}".`,
      };
    }
    if (!Number.isFinite(actualDistanceMiles) || actualDistanceMiles < 0) {
      return {
        ok: false,
        title: 'Check your numbers',
        message: `Enter a valid distance in miles for "${exerciseName}", or leave it blank.`,
      };
    }

    return {
      ok: true,
      exercise: {
        actualSets: [],
        actualDurationMinutes,
        actualDistanceMiles,
        actualScore: '',
      },
    };
  }

  const actualDurationMinutes = Number.parseInt(exercise.actualDurationMinutesInput.trim(), 10);
  const actualScore = exercise.actualScoreInput.trim();
  if (!Number.isFinite(actualDurationMinutes) || actualDurationMinutes <= 0) {
    return {
      ok: false,
      title: 'Check your numbers',
      message: `Enter a positive duration in minutes for "${exerciseName}".`,
    };
  }

  return {
    ok: true,
    exercise: {
      actualSets: [],
      actualDurationMinutes,
      actualDistanceMiles: 0,
      actualScore,
    },
  };
}
