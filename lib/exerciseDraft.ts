import { DEFAULT_ACTIVITY_TYPE, normalizeActivityType, type ActivityType } from '@/lib/activityTypes';
import {
  DEFAULT_CARDIO_DISTANCE_UNIT,
  formatCardioDistanceValue,
  normalizeCardioDistanceUnit,
  parseCardioDistanceInput,
  type CardioDistanceUnit,
} from '@/lib/cardioDistanceUnits';
import {
  DEFAULT_DURATION_UNIT,
  formatDurationValue,
  normalizeDurationUnit,
  parseDurationInput,
  type DurationUnit,
} from '@/lib/durationUnits';
import { newId } from '@/lib/ids';
import type { WorkoutExercise } from '@/lib/types';

export type ExerciseDraftRow = {
  clientId: string;
  sourceExerciseId?: string;
  activityType: ActivityType;
  name: string;
  sets: string;
  reps: string;
  weightKg: string;
  duration: string;
  durationUnit: DurationUnit;
  distance: string;
  distanceUnit: CardioDistanceUnit;
  score: string;
};

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
    weightKg: '',
    duration: '',
    durationUnit: DEFAULT_DURATION_UNIT,
    distance: '',
    distanceUnit: DEFAULT_CARDIO_DISTANCE_UNIT,
    score: '',
  };
}

export function workoutExerciseToDraftRow(exercise: WorkoutExercise, options?: { clientId?: string; sourceExerciseId?: string }): ExerciseDraftRow {
  const distanceUnit = normalizeCardioDistanceUnit(exercise.distanceUnit);
  const durationUnit = normalizeDurationUnit(exercise.durationUnit);
  return {
    clientId: options?.clientId ?? newId(),
    sourceExerciseId: options?.sourceExerciseId ?? exercise.id,
    activityType: exercise.activityType,
    name: exercise.name,
    sets: String(exercise.sets),
    reps: String(exercise.reps),
    weightKg: String(exercise.weightKg),
    duration: exercise.duration > 0 ? formatDurationValue(exercise.duration, durationUnit) : '',
    durationUnit,
    distance: exercise.distance > 0 ? formatCardioDistanceValue(exercise.distance, distanceUnit) : '',
    distanceUnit,
    score: exercise.score,
  };
}

export function isExerciseDraftRowEmpty(ex: ExerciseDraftRow): boolean {
  const hasName = ex.name.trim().length > 0;
  if (hasName) {
    return false;
  }
  switch (ex.activityType) {
    case 'strength':
      return !ex.sets.trim() && !ex.reps.trim() && !ex.weightKg.trim();
    case 'cardio':
      return !ex.duration.trim() && !ex.distance.trim();
    case 'sport':
      return !ex.duration.trim() && !ex.score.trim();
    default:
      return true;
  }
}

export function parseWorkoutExerciseFromDraft(ex: ExerciseDraftRow, id: string): ParseExerciseDraftResult {
  const name = ex.name.trim();
  const activityType = normalizeActivityType(ex.activityType);

  if (isExerciseDraftRowEmpty(ex)) {
    return { ok: false, title: '', message: '' };
  }

  if (!name) {
    return { ok: false, title: 'Name your exercise', message: 'One of your exercises is missing a name.' };
  }

  if (activityType === 'strength') {
    const setsCount = Number.parseInt(ex.sets.trim(), 10);
    const reps = Number.parseInt(ex.reps.trim(), 10);
    const weightKg = Number.parseFloat(ex.weightKg.trim().replace(',', '.'));
    if (
      !Number.isFinite(setsCount) ||
      setsCount <= 0 ||
      !Number.isFinite(reps) ||
      reps <= 0 ||
      !Number.isFinite(weightKg) ||
      weightKg < 0
    ) {
      return {
        ok: false,
        title: 'Check your numbers',
        message: 'Strength exercises need a positive set count, positive rep count, and a weight (use 0 for bodyweight).',
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
        weightKg,
        duration: 0,
        durationUnit: DEFAULT_DURATION_UNIT,
        distance: 0,
        distanceUnit: DEFAULT_CARDIO_DISTANCE_UNIT,
        score: '',
      },
    };
  }

  if (activityType === 'cardio') {
    const durationRaw = ex.duration.trim();
    const hasDurationInput = durationRaw.length > 0;
    const hasDistanceInput = ex.distance.trim().length > 0;
    const durationUnit = normalizeDurationUnit(ex.durationUnit);
    const distanceUnit = normalizeCardioDistanceUnit(ex.distanceUnit);
    const duration = parseDurationInput(ex.duration, durationUnit);
    const distance = parseCardioDistanceInput(ex.distance, distanceUnit);

    if (!hasDurationInput && !hasDistanceInput) {
      return {
        ok: false,
        title: 'Check your numbers',
        message: 'Cardio exercises need a duration, a distance, or both.',
      };
    }
    if (hasDurationInput && (!Number.isFinite(duration) || duration <= 0)) {
      return {
        ok: false,
        title: 'Check your numbers',
        message: 'Enter a positive duration.',
      };
    }
    if (hasDistanceInput && (!Number.isFinite(distance) || distance < 0)) {
      return {
        ok: false,
        title: 'Check your numbers',
        message: 'Enter a valid distance.',
      };
    }
    return {
      ok: true,
      exercise: {
        id,
        activityType,
        name,
        sets: 0,
        reps: 0,
        weightKg: 0,
        duration,
        durationUnit,
        distance,
        distanceUnit,
        score: '',
      },
    };
  }

  const durationUnit = normalizeDurationUnit(ex.durationUnit);
  const duration = parseDurationInput(ex.duration, durationUnit);
  const score = ex.score.trim();
  if (!Number.isFinite(duration) || duration <= 0) {
    return {
      ok: false,
      title: 'Check your numbers',
      message: 'Sport activities need a positive duration.',
    };
  }
  return {
    ok: true,
    exercise: {
      id,
      activityType: 'sport',
      name,
      sets: 0,
      reps: 0,
      weightKg: 0,
      duration,
      durationUnit,
      distance: 0,
      distanceUnit: DEFAULT_CARDIO_DISTANCE_UNIT,
      score,
    },
  };
}

export type ExerciseDraftSeed = Pick<
  ExerciseDraftRow,
  'sourceExerciseId' | 'activityType' | 'name' | 'sets' | 'reps' | 'weightKg' | 'duration' | 'durationUnit' | 'distance' | 'distanceUnit' | 'score'
> & {
  /** @deprecated Legacy import payloads used distanceMiles. */
  distanceMiles?: string;
  /** @deprecated Legacy import payloads used durationMinutes. */
  durationMinutes?: string;
};

export function exerciseDraftSeedFromRow(ex: ExerciseDraftRow): ExerciseDraftSeed {
  return {
    sourceExerciseId: ex.sourceExerciseId,
    activityType: ex.activityType,
    name: ex.name,
    sets: ex.sets,
    reps: ex.reps,
    weightKg: ex.weightKg,
    duration: ex.duration,
    durationUnit: ex.durationUnit,
    distance: ex.distance,
    distanceUnit: ex.distanceUnit,
    score: ex.score,
  };
}

export function exerciseDraftRowFromSeed(seed: ExerciseDraftSeed): ExerciseDraftRow {
  return {
    clientId: newId(),
    sourceExerciseId: seed.sourceExerciseId,
    activityType: normalizeActivityType(seed.activityType),
    name: seed.name,
    sets: seed.sets,
    reps: seed.reps,
    weightKg: seed.weightKg,
    duration: seed.duration ?? seed.durationMinutes ?? '',
    durationUnit: normalizeDurationUnit(seed.durationUnit),
    distance: seed.distance ?? seed.distanceMiles ?? '',
    distanceUnit: normalizeCardioDistanceUnit(seed.distanceUnit),
    score: seed.score ?? '',
  };
}
