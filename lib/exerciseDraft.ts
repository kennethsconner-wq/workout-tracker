import { DEFAULT_ACTIVITY_TYPE, normalizeActivityType, type ActivityType } from '@/lib/activityTypes';
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
  durationMinutes: string;
  distanceMiles: string;
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
    durationMinutes: '',
    distanceMiles: '',
    score: '',
  };
}

export function workoutExerciseToDraftRow(exercise: WorkoutExercise, options?: { clientId?: string; sourceExerciseId?: string }): ExerciseDraftRow {
  return {
    clientId: options?.clientId ?? newId(),
    sourceExerciseId: options?.sourceExerciseId ?? exercise.id,
    activityType: exercise.activityType,
    name: exercise.name,
    sets: String(exercise.sets),
    reps: String(exercise.reps),
    weightKg: String(exercise.weightKg),
    durationMinutes: exercise.durationMinutes > 0 ? String(exercise.durationMinutes) : '',
    distanceMiles: exercise.distanceMiles > 0 ? String(exercise.distanceMiles) : '',
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
      return !ex.durationMinutes.trim() && !ex.distanceMiles.trim();
    case 'sport':
      return !ex.durationMinutes.trim() && !ex.score.trim();
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
        durationMinutes: 0,
        distanceMiles: 0,
        score: '',
      },
    };
  }

  if (activityType === 'cardio') {
    const durationMinutes = Number.parseInt(ex.durationMinutes.trim(), 10);
    const distanceRaw = ex.distanceMiles.trim().replace(',', '.');
    const distanceMiles = distanceRaw.length > 0 ? Number.parseFloat(distanceRaw) : 0;
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return {
        ok: false,
        title: 'Check your numbers',
        message: 'Cardio exercises need a positive duration in minutes.',
      };
    }
    if (!Number.isFinite(distanceMiles) || distanceMiles < 0) {
      return {
        ok: false,
        title: 'Check your numbers',
        message: 'Enter a valid distance in miles, or leave it blank.',
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
        durationMinutes,
        distanceMiles,
        score: '',
      },
    };
  }

  const durationMinutes = Number.parseInt(ex.durationMinutes.trim(), 10);
  const score = ex.score.trim();
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return {
      ok: false,
      title: 'Check your numbers',
      message: 'Sport activities need a positive duration in minutes.',
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
      durationMinutes,
      distanceMiles: 0,
      score,
    },
  };
}

export type ExerciseDraftSeed = Pick<
  ExerciseDraftRow,
  'sourceExerciseId' | 'activityType' | 'name' | 'sets' | 'reps' | 'weightKg' | 'durationMinutes' | 'distanceMiles' | 'score'
>;

export function exerciseDraftSeedFromRow(ex: ExerciseDraftRow): ExerciseDraftSeed {
  return {
    sourceExerciseId: ex.sourceExerciseId,
    activityType: ex.activityType,
    name: ex.name,
    sets: ex.sets,
    reps: ex.reps,
    weightKg: ex.weightKg,
    durationMinutes: ex.durationMinutes,
    distanceMiles: ex.distanceMiles,
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
    durationMinutes: seed.durationMinutes ?? '',
    distanceMiles: seed.distanceMiles ?? '',
    score: seed.score ?? '',
  };
}
