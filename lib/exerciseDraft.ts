import { DEFAULT_ACTIVITY_TYPE, normalizeActivityType, type ActivityType } from '@/lib/activityTypes';

import {

  DEFAULT_CARDIO_DISTANCE_UNIT,

  formatCardioDistanceValue,

  migrateLegacyCardioSetsDurationDraft,

  migrateLegacyCardioSetsDurationToDistance,

  normalizeCardioDistanceUnit,

  parseCardioDistanceInput,

  type CardioDistanceUnit,

} from '@/lib/cardioDistanceUnits';

import {
  DEFAULT_CARDIO_DISTANCE_TRACKING,
  DEFAULT_CARDIO_DURATION_TRACKING,
  DEFAULT_CARDIO_OBJECTIVE,
  hydrateCardioDraftFromStored,
  normalizeCardioDistanceTracking,
  normalizeCardioDurationTracking,
  normalizeCardioObjective,
  normalizeCardioPlanFields,
  type CardioDistanceTracking,
  type CardioDurationTracking,
  type CardioObjective,
} from '@/lib/cardioPlan';

import {

  DEFAULT_DURATION_UNIT,

  DEFAULT_STRETCH_DURATION_UNIT,

  formatDurationValue,

  normalizeDurationUnit,

  normalizeCardioDurationUnit,

  normalizeSportDurationUnit,

  normalizeStretchDurationUnit,

  parseDurationInput,

  type DurationUnit,

} from '@/lib/durationUnits';

import {

  DEFAULT_SCORE_UNIT,

  normalizeScoreUnit,

  type ScoreUnit,

} from '@/lib/scoreUnits';

import { DEFAULT_WEIGHT_UNIT, normalizeWeightUnit, type WeightUnit } from '@/lib/weightUnits';

import { newId } from '@/lib/ids';

import type { Workout, WorkoutExercise } from '@/lib/types';



export type ExerciseDraftRow = {

  clientId: string;

  sourceExerciseId?: string;

  activityType: ActivityType;

  name: string;

  sets: string;

  reps: string;

  weight: string;

  weightUnit: WeightUnit;

  duration: string;

  durationUnit: DurationUnit;

  distance: string;

  distanceUnit: CardioDistanceUnit;

  cardioObjective: CardioObjective;

  cardioDurationTracking: CardioDurationTracking;

  cardioDistanceTracking: CardioDistanceTracking;

  score: string;

  scoreUnit: ScoreUnit;

};

/** Exercise fields preserved when copying a workout template to Create Workout. */
export type CopyWorkoutExercisePayload = Pick<
  WorkoutExercise,
  | 'id'
  | 'activityType'
  | 'name'
  | 'sets'
  | 'reps'
  | 'weight'
  | 'weightUnit'
  | 'duration'
  | 'durationUnit'
  | 'distance'
  | 'distanceUnit'
  | 'cardioObjective'
  | 'cardioDurationTracking'
  | 'cardioDistanceTracking'
  | 'cardioDistanceMode'
  | 'score'
  | 'scoreUnit'
  | 'stretchSets'
>;

export type CopyWorkoutPayload = Pick<Workout, 'title' | 'daysOfWeek' | 'iconId'> & {
  exercises: CopyWorkoutExercisePayload[];
};

export function buildCopyWorkoutPayload(workout: Workout): CopyWorkoutPayload {
  return {
    title: workout.title,
    daysOfWeek: workout.daysOfWeek,
    iconId: workout.iconId,
    exercises: workout.exercises.map((exercise) => ({
      id: exercise.id,
      activityType: exercise.activityType,
      name: exercise.name,
      sets: exercise.sets,
      reps: exercise.reps,
      weight: exercise.weight,
      weightUnit: exercise.weightUnit,
      duration: exercise.duration,
      durationUnit: exercise.durationUnit,
      distance: exercise.distance,
      distanceUnit: exercise.distanceUnit,
      cardioObjective: exercise.cardioObjective,
      cardioDurationTracking: exercise.cardioDurationTracking,
      cardioDistanceTracking: exercise.cardioDistanceTracking,
      cardioDistanceMode: exercise.cardioDistanceMode,
      score: exercise.score,
      scoreUnit: exercise.scoreUnit,
      stretchSets: exercise.stretchSets,
    })),
  };
}

export type ParseExerciseDraftResult =

  | { ok: true; exercise: WorkoutExercise }

  | { ok: false; title: string; message: string };



export function emptyExerciseDraftRow(): ExerciseDraftRow {

  return {

    clientId: newId(),

    activityType: DEFAULT_ACTIVITY_TYPE,

    name: '',

    sets: '',

    reps: '',

    weight: '',

    weightUnit: DEFAULT_WEIGHT_UNIT,

    duration: '',

    durationUnit: DEFAULT_DURATION_UNIT,

    distance: '',

    distanceUnit: DEFAULT_CARDIO_DISTANCE_UNIT,

    cardioObjective: DEFAULT_CARDIO_OBJECTIVE,

    cardioDurationTracking: DEFAULT_CARDIO_DURATION_TRACKING,

    cardioDistanceTracking: DEFAULT_CARDIO_DISTANCE_TRACKING,

    score: '',

    scoreUnit: DEFAULT_SCORE_UNIT,

  };

}



/** Clear draft fields that do not apply to the selected activity type. */
export function sanitizeExerciseDraftRow(ex: ExerciseDraftRow): ExerciseDraftRow {
  const activityType = normalizeActivityType(ex.activityType);
  switch (activityType) {
    case 'strength':
      return {
        ...ex,
        duration: '',
        durationUnit: DEFAULT_DURATION_UNIT,
        distance: '',
        distanceUnit: DEFAULT_CARDIO_DISTANCE_UNIT,
        score: '',
        scoreUnit: DEFAULT_SCORE_UNIT,
      };
    case 'cardio': {
      const plan = normalizeCardioPlanFields({
        activityType: 'cardio',
        duration: 0,
        distance: 0,
        cardioObjective: ex.cardioObjective,
        cardioDurationTracking: ex.cardioDurationTracking,
        cardioDistanceTracking: ex.cardioDistanceTracking,
      });
      return {
        ...ex,
        sets: '',
        reps: '',
        weight: '',
        weightUnit: DEFAULT_WEIGHT_UNIT,
        score: '',
        scoreUnit: DEFAULT_SCORE_UNIT,
        cardioObjective: plan.cardioObjective,
        cardioDurationTracking: plan.cardioDurationTracking,
        cardioDistanceTracking: plan.cardioDistanceTracking,
        durationUnit: normalizeCardioDurationUnit(ex.durationUnit),
        distanceUnit: normalizeCardioDistanceUnit(ex.distanceUnit),
      };
    }
    case 'sport':
      return {
        ...ex,
        sets: '',
        reps: '',
        weight: '',
        weightUnit: DEFAULT_WEIGHT_UNIT,
        distance: '',
        distanceUnit: DEFAULT_CARDIO_DISTANCE_UNIT,
        durationUnit: normalizeSportDurationUnit(ex.durationUnit),
      };
    case 'stretch':
      return {
        ...ex,
        reps: '',
        weight: '',
        weightUnit: DEFAULT_WEIGHT_UNIT,
        distance: '',
        distanceUnit: DEFAULT_CARDIO_DISTANCE_UNIT,
        score: '',
        scoreUnit: DEFAULT_SCORE_UNIT,
        durationUnit:
          ex.duration.trim().length > 0
            ? normalizeStretchDurationUnit(ex.durationUnit)
            : DEFAULT_STRETCH_DURATION_UNIT,
      };
    default:
      return ex;
  }
}

export function applyActivityTypeChangeToDraftRow(ex: ExerciseDraftRow, activityType: ActivityType): ExerciseDraftRow {
  const next = sanitizeExerciseDraftRow({ ...ex, activityType });
  if (activityType === 'stretch') {
    return { ...next, durationUnit: DEFAULT_STRETCH_DURATION_UNIT };
  }
  if (activityType === 'cardio') {
    const durationUnit =
      next.durationUnit === 'breaths' ? DEFAULT_DURATION_UNIT : normalizeCardioDurationUnit(next.durationUnit);
    return {
      ...next,
      durationUnit,
      cardioObjective: DEFAULT_CARDIO_OBJECTIVE,
      cardioDurationTracking: DEFAULT_CARDIO_DURATION_TRACKING,
      cardioDistanceTracking: DEFAULT_CARDIO_DISTANCE_TRACKING,
      duration: '',
      distance: '',
    };
  }
  if (activityType === 'sport') {
    return { ...next, durationUnit: normalizeSportDurationUnit(next.durationUnit) };
  }
  return next;
}

export function applyCardioObjectiveChangeToDraftRow(ex: ExerciseDraftRow, objective: CardioObjective): ExerciseDraftRow {
  return {
    ...ex,
    cardioObjective: objective,
    cardioDurationTracking: DEFAULT_CARDIO_DURATION_TRACKING,
    cardioDistanceTracking: DEFAULT_CARDIO_DISTANCE_TRACKING,
    duration: objective === 'distance' ? '' : ex.duration,
    distance: objective === 'duration' ? '' : ex.distance,
  };
}

export function applyCardioDurationTrackingChangeToDraftRow(
  ex: ExerciseDraftRow,
  tracking: CardioDurationTracking,
): ExerciseDraftRow {
  return {
    ...ex,
    cardioDurationTracking: tracking,
    duration: tracking === 'none' ? '' : ex.duration,
  };
}

export function applyCardioDistanceTrackingChangeToDraftRow(
  ex: ExerciseDraftRow,
  tracking: CardioDistanceTracking,
): ExerciseDraftRow {
  return {
    ...ex,
    cardioDistanceTracking: tracking,
    distance: tracking === 'none' ? '' : ex.distance,
  };
}

/** Clear stored exercise fields that do not apply to the selected activity type. */
export function sanitizeWorkoutExercise(exercise: WorkoutExercise): WorkoutExercise {
  const activityType = normalizeActivityType(exercise.activityType);
  switch (activityType) {
    case 'strength':
      return {
        ...exercise,
        duration: 0,
        durationUnit: DEFAULT_DURATION_UNIT,
        distance: 0,
        distanceUnit: DEFAULT_CARDIO_DISTANCE_UNIT,
        score: '',
        scoreUnit: DEFAULT_SCORE_UNIT,
      };
    case 'cardio': {
      const plan = normalizeCardioPlanFields(exercise);
      return {
        ...exercise,
        sets: 0,
        reps: 0,
        weight: 0,
        weightUnit: DEFAULT_WEIGHT_UNIT,
        score: '',
        scoreUnit: DEFAULT_SCORE_UNIT,
        cardioObjective: plan.cardioObjective,
        cardioDurationTracking: plan.cardioDurationTracking,
        cardioDistanceTracking: plan.cardioDistanceTracking,
      };
    }
    case 'sport':
      return {
        ...exercise,
        sets: 0,
        reps: 0,
        weight: 0,
        weightUnit: DEFAULT_WEIGHT_UNIT,
        distance: 0,
        distanceUnit: DEFAULT_CARDIO_DISTANCE_UNIT,
      };
    case 'stretch':
      return {
        ...exercise,
        reps: 0,
        weight: 0,
        weightUnit: DEFAULT_WEIGHT_UNIT,
        distance: 0,
        distanceUnit: DEFAULT_CARDIO_DISTANCE_UNIT,
        score: '',
        scoreUnit: DEFAULT_SCORE_UNIT,
      };
    default:
      return exercise;
  }
}



export function workoutExerciseToDraftRow(exercise: WorkoutExercise, options?: { clientId?: string; sourceExerciseId?: string }): ExerciseDraftRow {

  const migrated = migrateLegacyCardioSetsDurationToDistance({
    activityType: exercise.activityType,
    duration: exercise.duration,
    durationUnit: exercise.durationUnit,
    distance: exercise.distance,
    distanceUnit: exercise.distanceUnit,
  });

  const distanceUnit = normalizeCardioDistanceUnit(migrated.distanceUnit);

  const durationUnit =
    migrated.activityType === 'cardio'
      ? normalizeCardioDurationUnit(migrated.durationUnit)
      : migrated.activityType === 'sport'
        ? normalizeSportDurationUnit(migrated.durationUnit)
        : migrated.activityType === 'stretch'
          ? normalizeStretchDurationUnit(migrated.durationUnit)
          : normalizeDurationUnit(migrated.durationUnit);

  const weightUnit = normalizeWeightUnit(exercise.weightUnit);
  const cardioDraft =
    migrated.activityType === 'cardio'
      ? hydrateCardioDraftFromStored({
          ...exercise,
          duration: migrated.duration,
          distance: migrated.distance,
          distanceUnit: migrated.distanceUnit,
        })
      : null;

  return {

    clientId: options?.clientId ?? newId(),

    sourceExerciseId: options?.sourceExerciseId ?? exercise.id,

    activityType: exercise.activityType,

    name: exercise.name,

    sets: String(exercise.sets),

    reps: String(exercise.reps),

    weight: String(exercise.weight),

    weightUnit,

    duration: cardioDraft?.duration ?? (migrated.duration > 0 ? formatDurationValue(migrated.duration, durationUnit) : ''),

    durationUnit,

    distance: cardioDraft?.distance ?? (migrated.distance > 0 ? formatCardioDistanceValue(migrated.distance, distanceUnit) : ''),

    distanceUnit,

    cardioObjective: cardioDraft?.cardioObjective ?? DEFAULT_CARDIO_OBJECTIVE,

    cardioDurationTracking: cardioDraft?.cardioDurationTracking ?? DEFAULT_CARDIO_DURATION_TRACKING,

    cardioDistanceTracking: cardioDraft?.cardioDistanceTracking ?? DEFAULT_CARDIO_DISTANCE_TRACKING,

    score: exercise.score,

    scoreUnit: normalizeScoreUnit(exercise.scoreUnit),

  };

}



export function isExerciseDraftRowEmpty(ex: ExerciseDraftRow): boolean {

  const hasName = ex.name.trim().length > 0;

  if (hasName) {

    return false;

  }

  switch (ex.activityType) {

    case 'strength':

      return !ex.sets.trim() && !ex.reps.trim() && !ex.weight.trim();

    case 'cardio':

      return !ex.duration.trim() && !ex.distance.trim();

    case 'sport':

      return !ex.duration.trim() && !ex.score.trim();

    case 'stretch':

      return !ex.sets.trim() && !ex.duration.trim();

    default:

      return true;

  }

}



/** Strength and stretch exercises default to 1 set when unset or zero. */
export function resolveExerciseSetCount(raw: string | number): number {
  const trimmed = typeof raw === 'number' ? String(raw) : raw.trim();
  if (trimmed.length === 0) {
    return 1;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}



export function parseWorkoutExerciseFromDraft(ex: ExerciseDraftRow, id: string): ParseExerciseDraftResult {

  const sanitized = sanitizeExerciseDraftRow(ex);

  const name = sanitized.name.trim();

  const activityType = normalizeActivityType(sanitized.activityType);



  if (isExerciseDraftRowEmpty(sanitized)) {

    return { ok: false, title: '', message: '' };

  }



  if (!name) {

    return { ok: false, title: 'Name your exercise', message: 'One of your exercises is missing a name.' };

  }



  if (activityType === 'strength') {

    const setsCount = resolveExerciseSetCount(sanitized.sets);

    const reps = Number.parseInt(sanitized.reps.trim(), 10);

    const weight = Number.parseFloat(sanitized.weight.trim().replace(',', '.'));

    const weightUnit = normalizeWeightUnit(sanitized.weightUnit);

    if (

      !Number.isFinite(reps) ||

      reps <= 0 ||

      !Number.isFinite(weight) ||

      weight < 0

    ) {

      return {

        ok: false,

        title: 'Check your numbers',

        message: 'Strength exercises need a positive rep count and a weight (use 0 for bodyweight).',

      };

    }

    return {

      ok: true,

      exercise: {

        id,

        activityType,

        name,

        sets: setsCount,

        reps,

        weight,

        weightUnit,

        duration: 0,

        durationUnit: DEFAULT_DURATION_UNIT,

        distance: 0,

        distanceUnit: DEFAULT_CARDIO_DISTANCE_UNIT,

        score: '',

        scoreUnit: DEFAULT_SCORE_UNIT,

      },

    };

  }



  if (activityType === 'cardio') {

    const objective = normalizeCardioObjective(sanitized.cardioObjective);
    const durationTracking = normalizeCardioDurationTracking(sanitized.cardioDurationTracking);
    const distanceTracking = normalizeCardioDistanceTracking(sanitized.cardioDistanceTracking);
    const durationUnit = normalizeCardioDurationUnit(sanitized.durationUnit);
    const distanceUnit = normalizeCardioDistanceUnit(sanitized.distanceUnit);
    const duration = parseDurationInput(sanitized.duration, durationUnit);
    const distance = parseCardioDistanceInput(sanitized.distance, distanceUnit);

    if (objective === 'distance') {
      if (!sanitized.distance.trim()) {
        return { ok: false, title: 'Check your numbers', message: 'Enter a distance for this cardio exercise.' };
      }
      if (!Number.isFinite(distance) || distance <= 0) {
        return { ok: false, title: 'Check your numbers', message: 'Enter a positive distance.' };
      }
      if (durationTracking !== 'none') {
        if (!sanitized.duration.trim()) {
          return { ok: false, title: 'Check your numbers', message: 'Enter a duration for this cardio exercise.' };
        }
        if (!Number.isFinite(duration) || duration <= 0) {
          return { ok: false, title: 'Check your numbers', message: 'Enter a positive duration.' };
        }
      }
    } else {
      if (!sanitized.duration.trim()) {
        return { ok: false, title: 'Check your numbers', message: 'Enter a duration for this cardio exercise.' };
      }
      if (!Number.isFinite(duration) || duration <= 0) {
        return { ok: false, title: 'Check your numbers', message: 'Enter a positive duration.' };
      }
      if (distanceTracking !== 'none') {
        if (!sanitized.distance.trim()) {
          return { ok: false, title: 'Check your numbers', message: 'Enter a distance for this cardio exercise.' };
        }
        if (!Number.isFinite(distance) || distance <= 0) {
          return { ok: false, title: 'Check your numbers', message: 'Enter a positive distance.' };
        }
      }
    }

    const savedDuration = objective === 'distance' && durationTracking === 'none' ? 0 : duration;
    const savedDistance = objective === 'duration' && distanceTracking === 'none' ? 0 : distance;

    return {
      ok: true,
      exercise: {
        id,
        activityType,
        name,
        sets: 0,
        reps: 0,
        weight: 0,
        weightUnit: DEFAULT_WEIGHT_UNIT,
        duration: savedDuration,
        durationUnit,
        distance: savedDistance,
        distanceUnit,
        cardioObjective: objective,
        cardioDurationTracking: objective === 'distance' ? durationTracking : DEFAULT_CARDIO_DURATION_TRACKING,
        cardioDistanceTracking: objective === 'duration' ? distanceTracking : DEFAULT_CARDIO_DISTANCE_TRACKING,
        score: '',
        scoreUnit: DEFAULT_SCORE_UNIT,
      },
    };
  }



  if (activityType === 'sport') {

    const durationUnit = normalizeSportDurationUnit(sanitized.durationUnit);

    const durationRaw = sanitized.duration.trim();

    const hasDurationInput = durationRaw.length > 0;

    const score = sanitized.score.trim();

    const hasScoreInput = score.length > 0;

    const duration = parseDurationInput(sanitized.duration, durationUnit);



    if (!hasDurationInput && !hasScoreInput) {

      return {

        ok: false,

        title: 'Check your numbers',

        message: 'Sport activities need a duration, a score, or both.',

      };

    }

    if (hasDurationInput && (!Number.isFinite(duration) || duration <= 0)) {

      return {

        ok: false,

        title: 'Check your numbers',

        message: 'Enter a positive duration.',

      };

    }

    const scoreUnit = normalizeScoreUnit(sanitized.scoreUnit);

    return {

      ok: true,

      exercise: {

        id,

        activityType: 'sport',

        name,

        sets: 0,

        reps: 0,

        weight: 0,

        weightUnit: DEFAULT_WEIGHT_UNIT,

        duration,

        durationUnit,

        distance: 0,

        distanceUnit: DEFAULT_CARDIO_DISTANCE_UNIT,

        score,

        scoreUnit,

      },

    };

  }



  if (activityType === 'stretch') {

    const setsCount = resolveExerciseSetCount(sanitized.sets);

    const durationUnit = normalizeDurationUnit(sanitized.durationUnit);

    const duration = parseDurationInput(sanitized.duration, durationUnit);

    if (!Number.isFinite(duration) || duration <= 0) {

      return {

        ok: false,

        title: 'Check your numbers',

        message: 'Enter a positive duration.',

      };

    }

    return {

      ok: true,

      exercise: {

        id,

        activityType: 'stretch',

        name,

        sets: setsCount,

        reps: 0,

        weight: 0,

        weightUnit: DEFAULT_WEIGHT_UNIT,

        duration,

        durationUnit,

        distance: 0,

        distanceUnit: DEFAULT_CARDIO_DISTANCE_UNIT,

        score: '',

        scoreUnit: DEFAULT_SCORE_UNIT,

      },

    };

  }



  return { ok: false, title: 'Check your numbers', message: 'Unknown activity type.' };
}



export type ExerciseDraftSeed = Pick<

  ExerciseDraftRow,

  'sourceExerciseId' | 'activityType' | 'name' | 'sets' | 'reps' | 'weight' | 'weightUnit' | 'duration' | 'durationUnit' | 'distance' | 'distanceUnit' | 'cardioObjective' | 'cardioDurationTracking' | 'cardioDistanceTracking' | 'score' | 'scoreUnit'

> & {

  /** @deprecated Legacy import payloads used weightKg. */

  weightKg?: string;

  /** @deprecated Legacy import payloads used distanceMiles. */

  distanceMiles?: string;

  /** @deprecated Legacy import payloads used durationMinutes. */

  durationMinutes?: string;

  /** @deprecated Migrated to cardioObjective + tracking fields. */

  cardioDistanceMode?: 'per' | 'total';

};



export function exerciseDraftSeedFromRow(ex: ExerciseDraftRow): ExerciseDraftSeed {
  const sanitized = sanitizeExerciseDraftRow(ex);
  return {

    sourceExerciseId: sanitized.sourceExerciseId,

    activityType: sanitized.activityType,

    name: sanitized.name,

    sets: sanitized.sets,

    reps: sanitized.reps,

    weight: sanitized.weight,

    weightUnit: sanitized.weightUnit,

    duration: sanitized.duration,

    durationUnit: sanitized.durationUnit,

    distance: sanitized.distance,

    distanceUnit: sanitized.distanceUnit,

    cardioObjective: sanitized.cardioObjective,

    cardioDurationTracking: sanitized.cardioDurationTracking,

    cardioDistanceTracking: sanitized.cardioDistanceTracking,

    score: sanitized.score,

    scoreUnit: sanitized.scoreUnit,

  };

}



export function exerciseDraftRowFromSeed(seed: ExerciseDraftSeed): ExerciseDraftRow {

  const migratedDraft = migrateLegacyCardioSetsDurationDraft({
    activityType: normalizeActivityType(seed.activityType),
    duration: seed.duration ?? seed.durationMinutes ?? '',
    durationUnit: seed.durationUnit,
    distance: seed.distance ?? seed.distanceMiles ?? '',
    distanceUnit: seed.distanceUnit,
  });

  const activityType = normalizeActivityType(seed.activityType);
  const durationRaw = migratedDraft.duration;
  const distanceRaw = migratedDraft.distance;
  const parsedDuration =
    activityType === 'cardio' && durationRaw.trim()
      ? parseDurationInput(durationRaw, normalizeDurationUnit(migratedDraft.durationUnit))
      : 0;
  const parsedDistance =
    activityType === 'cardio' && distanceRaw.trim()
      ? parseCardioDistanceInput(distanceRaw, normalizeCardioDistanceUnit(migratedDraft.distanceUnit))
      : 0;
  const cardioPlan =
    activityType === 'cardio'
      ? normalizeCardioPlanFields({
          activityType: 'cardio',
          duration: parsedDuration,
          distance: parsedDistance,
          cardioObjective: normalizeCardioObjective((seed as { cardioObjective?: unknown }).cardioObjective),
          cardioDurationTracking: normalizeCardioDurationTracking(
            (seed as { cardioDurationTracking?: unknown }).cardioDurationTracking,
          ),
          cardioDistanceTracking: normalizeCardioDistanceTracking(
            (seed as { cardioDistanceTracking?: unknown }).cardioDistanceTracking,
          ),
          cardioDistanceMode: seed.cardioDistanceMode,
        })
      : null;

  return sanitizeExerciseDraftRow({

    clientId: newId(),

    sourceExerciseId: seed.sourceExerciseId,

    activityType,

    name: seed.name,

    sets: seed.sets,

    reps: seed.reps,

    weight: seed.weight ?? seed.weightKg ?? '',

    weightUnit: normalizeWeightUnit(seed.weightUnit),

    duration: migratedDraft.duration,

    durationUnit: normalizeDurationUnit(migratedDraft.durationUnit),

    distance: migratedDraft.distance,

    distanceUnit: normalizeCardioDistanceUnit(migratedDraft.distanceUnit),

    cardioObjective: cardioPlan?.cardioObjective ?? DEFAULT_CARDIO_OBJECTIVE,

    cardioDurationTracking: cardioPlan?.cardioDurationTracking ?? DEFAULT_CARDIO_DURATION_TRACKING,

    cardioDistanceTracking: cardioPlan?.cardioDistanceTracking ?? DEFAULT_CARDIO_DISTANCE_TRACKING,

    score: seed.score ?? '',

    scoreUnit: normalizeScoreUnit(seed.scoreUnit),

  });

}


