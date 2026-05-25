import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ActivityType } from '@/lib/activityTypes';
import type { CardioDistanceUnit } from '@/lib/cardioDistanceUnits';
import { DEFAULT_CARDIO_DISTANCE_UNIT } from '@/lib/cardioDistanceUnits';
import type { DurationUnit } from '@/lib/durationUnits';
import { DEFAULT_DURATION_UNIT } from '@/lib/durationUnits';
import type { ScoreUnit } from '@/lib/scoreUnits';
import { DEFAULT_SCORE_UNIT } from '@/lib/scoreUnits';
import type { WeightUnit } from '@/lib/weightUnits';
import { DEFAULT_WEIGHT_UNIT } from '@/lib/weightUnits';
import type {
  CardioDistanceTracking,
  CardioDurationTracking,
  CardioObjective,
  LegacyCardioDistanceMode,
} from '@/lib/cardioPlan';
import { isCardioPerSegmentLogging, isCardioDurationPerDistance } from '@/lib/cardioPlan';
import { cardioPerSegmentCount } from '@/lib/cardioPerLog';
import { hasLoggedExerciseInput, type LogExerciseDraftFields } from '@/lib/logExerciseDraft';
import { readStretchSetsFromExercise } from '@/lib/stretchSets';
import type { Workout } from '@/lib/types';

export const NEW_LOG_DRAFT_KEY_PREFIX = 'workout-log-draft@v1:';

type DraftSetFields = { actualRepsInput: string; actualWeightInput: string };
type DraftStretchSetFields = { actualDurationInput: string; actualDurationUnit: DurationUnit };
type DraftCardioPerSetFields = {
  actualDurationInput: string;
  actualDurationUnit: DurationUnit;
  actualDistanceInput: string;
  actualDistanceUnit: CardioDistanceUnit;
};

type DraftExerciseFields = {
  workoutExerciseId: string;
  activityType: ActivityType;
  actualSets: DraftSetFields[];
  actualWeightUnit?: WeightUnit;
  actualStretchSets?: DraftStretchSetFields[];
  actualCardioPerSets?: DraftCardioPerSetFields[];
  cardioObjective?: CardioObjective;
  cardioDurationTracking?: CardioDurationTracking;
  cardioDistanceTracking?: CardioDistanceTracking;
  /** @deprecated Migrated to cardioObjective + tracking fields. */
  cardioDistanceMode?: LegacyCardioDistanceMode;
  actualDurationInput?: string;
  actualDurationUnit?: DurationUnit;
  actualDistanceInput?: string;
  actualDistanceUnit?: CardioDistanceUnit;
  actualScoreInput?: string;
  actualScoreUnit?: ScoreUnit;
};

export function newLogDraftStorageKey(workoutId: string): string {
  return `${NEW_LOG_DRAFT_KEY_PREFIX}${workoutId}`;
}

type StoredNewLogDraft = {
  workoutId?: string;
  loggedWorkoutId?: string;
};

function isValidNewLogDraft(raw: string, workoutId: string): boolean {
  try {
    const parsed = JSON.parse(raw) as StoredNewLogDraft;
    return Boolean(parsed && parsed.workoutId === workoutId && !parsed.loggedWorkoutId);
  } catch {
    return false;
  }
}

export async function hasNewLogDraft(workoutId: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(newLogDraftStorageKey(workoutId));
  if (!raw) {
    return false;
  }
  return isValidNewLogDraft(raw, workoutId);
}

/** Workout template ids that have an in-progress new-log draft on device. */
export async function getWorkoutIdsWithNewLogDrafts(): Promise<Set<string>> {
  const keys = await AsyncStorage.getAllKeys();
  const ids = new Set<string>();

  await Promise.all(
    keys
      .filter((key) => key.startsWith(NEW_LOG_DRAFT_KEY_PREFIX))
      .map(async (key) => {
        const workoutId = key.slice(NEW_LOG_DRAFT_KEY_PREFIX.length);
        if (!workoutId) {
          return;
        }
        const raw = await AsyncStorage.getItem(key);
        if (raw && isValidNewLogDraft(raw, workoutId)) {
          ids.add(workoutId);
        }
      }),
  );

  return ids;
}

export async function clearNewLogDraft(workoutId: string): Promise<void> {
  await AsyncStorage.removeItem(newLogDraftStorageKey(workoutId));
}

/** True when the new-log form still matches an untouched template (no draft worth persisting). */
export function isNewLogFormPristine(
  workout: Workout,
  exercises: DraftExerciseFields[],
  omittedWorkoutExerciseIds: readonly string[],
): boolean {
  if (omittedWorkoutExerciseIds.length > 0) {
    return false;
  }
  if (exercises.length !== workout.exercises.length) {
    return false;
  }

  const templateById = new Map(workout.exercises.map((exercise) => [exercise.id, exercise]));

  for (const exercise of exercises) {
    const template = templateById.get(exercise.workoutExerciseId);
    if (!template) {
      return false;
    }

    const draftFields: LogExerciseDraftFields = {
      activityType: exercise.activityType,
      actualSets: exercise.actualSets,
      actualWeightUnit: exercise.actualWeightUnit ?? DEFAULT_WEIGHT_UNIT,
      actualStretchSets: exercise.actualStretchSets ?? [],
      actualCardioPerSets: exercise.actualCardioPerSets ?? [],
      cardioObjective: exercise.cardioObjective ?? template.cardioObjective,
      cardioDurationTracking: exercise.cardioDurationTracking ?? template.cardioDurationTracking,
      cardioDistanceTracking: exercise.cardioDistanceTracking ?? template.cardioDistanceTracking,
      cardioDistanceMode: exercise.cardioDistanceMode ?? template.cardioDistanceMode,
      plannedDuration: template.duration,
      plannedDistance: template.distance,
      actualDurationInput: exercise.actualDurationInput ?? '',
      actualDurationUnit: exercise.actualDurationUnit ?? DEFAULT_DURATION_UNIT,
      actualDistanceInput: exercise.actualDistanceInput ?? '',
      actualDistanceUnit: exercise.actualDistanceUnit ?? DEFAULT_CARDIO_DISTANCE_UNIT,
      actualScoreInput: exercise.actualScoreInput ?? '',
      actualScoreUnit: exercise.actualScoreUnit ?? DEFAULT_SCORE_UNIT,
    };

    if (hasLoggedExerciseInput(draftFields)) {
      return false;
    }

    if (template.activityType === 'strength' && exercise.actualSets.length !== template.sets) {
      return false;
    }
    if (template.activityType === 'stretch') {
      const plannedCount = Math.max(readStretchSetsFromExercise(template).length, template.sets, 1);
      if ((exercise.actualStretchSets ?? []).length !== plannedCount) {
        return false;
      }
    }
    if (template.activityType === 'cardio' && isCardioPerSegmentLogging(template)) {
      const objectiveInput = isCardioDurationPerDistance(template)
        ? exercise.actualDistanceInput ?? ''
        : exercise.actualDurationInput ?? '';
      const plannedCount = cardioPerSegmentCount(template, objectiveInput);
      if ((exercise.actualCardioPerSets ?? []).length !== plannedCount) {
        return false;
      }
    }
  }

  return true;
}
