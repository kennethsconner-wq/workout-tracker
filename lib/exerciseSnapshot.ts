import type { ActivityType } from '@/lib/activityTypes';
import { normalizeActivityType } from '@/lib/activityTypes';
import { migrateLegacyCardioPaceFields } from '@/lib/cardioPlan';
import { hasLoggedExerciseActual } from '@/lib/exerciseDisplay';
import type { LoggedWorkout, LoggedWorkoutExercise, Workout, WorkoutExercise } from '@/lib/types';

export type ExerciseDefinitionFields = Pick<
  WorkoutExercise,
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
  | 'cardioPaceDuration'
  | 'cardioPaceDurationUnit'
  | 'cardioPaceDistance'
  | 'cardioPaceDistanceUnit'
  | 'cardioDistanceMode'
  | 'score'
  | 'scoreUnit'
>;

type ExerciseDefinitionSignatureInput = ExerciseDefinitionFields;

/** Canonical plan fields for stable grouping (legacy pace-in-duration logs match migrated templates). */
export function normalizeExerciseDefinitionForSignature(
  exercise: ExerciseDefinitionSignatureInput,
): ExerciseDefinitionFields {
  const activityType = normalizeActivityType(exercise.activityType);
  const migrated = migrateLegacyCardioPaceFields({
    activityType,
    duration: exercise.duration ?? 0,
    durationUnit: exercise.durationUnit,
    distance: exercise.distance ?? 0,
    distanceUnit: exercise.distanceUnit,
    cardioObjective: exercise.cardioObjective,
    cardioDurationTracking: exercise.cardioDurationTracking,
    cardioDistanceTracking: exercise.cardioDistanceTracking,
    cardioDistanceMode: exercise.cardioDistanceMode,
    cardioPaceDuration: exercise.cardioPaceDuration ?? 0,
    cardioPaceDurationUnit: exercise.cardioPaceDurationUnit,
    cardioPaceDistance: exercise.cardioPaceDistance ?? 0,
    cardioPaceDistanceUnit: exercise.cardioPaceDistanceUnit,
  });

  return {
    activityType,
    name: exercise.name,
    sets: exercise.sets ?? 0,
    reps: exercise.reps ?? 0,
    weight: exercise.weight ?? 0,
    weightUnit: exercise.weightUnit,
    duration: migrated.duration ?? 0,
    durationUnit: migrated.durationUnit,
    distance: migrated.distance ?? 0,
    distanceUnit: migrated.distanceUnit,
    cardioObjective: migrated.cardioObjective,
    cardioDurationTracking: migrated.cardioDurationTracking,
    cardioDistanceTracking: migrated.cardioDistanceTracking,
    cardioPaceDuration: migrated.cardioPaceDuration ?? 0,
    cardioPaceDurationUnit: migrated.cardioPaceDurationUnit,
    cardioPaceDistance: migrated.cardioPaceDistance ?? 0,
    cardioPaceDistanceUnit: migrated.cardioPaceDistanceUnit,
    score: exercise.score ?? '',
    scoreUnit: exercise.scoreUnit,
  };
}

/** Same grouping key as the Exercise Library list (one entry per unique exercise definition). */
export function exerciseDefinitionSignatureKey(exercise: ExerciseDefinitionSignatureInput): string {
  const normalized = normalizeExerciseDefinitionForSignature(exercise);
  return `${normalized.activityType}|${normalized.name}|${normalized.sets}|${normalized.reps}|${normalized.weight}|${normalized.weightUnit}|${normalized.duration}|${normalized.durationUnit}|${normalized.distance}|${normalized.distanceUnit}|${normalized.cardioObjective}|${normalized.cardioDurationTracking}|${normalized.cardioDistanceTracking}|${normalized.cardioPaceDuration}|${normalized.cardioPaceDurationUnit ?? ''}|${normalized.cardioPaceDistance}|${normalized.cardioPaceDistanceUnit ?? ''}|${normalized.score}|${normalized.scoreUnit}`;
}

export type StoredExerciseOption = {
  /** Signature key for this exercise definition (not a single workout slot id). */
  id: string;
  name: string;
  activityType: ActivityType;
  /** All template exercise ids across workouts that share this definition. */
  workoutExerciseIds: string[];
};

/** Target for aggregating metrics across every logged appearance of one exercise definition. */
export type StoredExerciseMetricTarget = Pick<StoredExerciseOption, 'id' | 'workoutExerciseIds'>;

function toWorkoutExerciseIdSet(workoutExerciseIds: readonly string[]): Set<string> {
  return new Set(workoutExerciseIds);
}

function matchesWorkoutExercise(workoutExerciseId: string, ids: Set<string>): boolean {
  return ids.has(workoutExerciseId);
}

type ExerciseOptionGroup = {
  name: string;
  activityType: ActivityType;
  workoutExerciseIds: Set<string>;
};

function findGroupKeyByWorkoutExerciseId(
  groups: Map<string, ExerciseOptionGroup>,
  workoutExerciseId: string,
): string | null {
  for (const [key, group] of groups) {
    if (group.workoutExerciseIds.has(workoutExerciseId)) {
      return key;
    }
  }
  return null;
}

function addExerciseToOptionGroups(
  groups: Map<string, ExerciseOptionGroup>,
  exercise: ExerciseDefinitionSignatureInput,
  workoutExerciseId: string,
): void {
  const normalized = normalizeExerciseDefinitionForSignature(exercise);
  const keyBySlot = findGroupKeyByWorkoutExerciseId(groups, workoutExerciseId);
  const key = keyBySlot ?? exerciseDefinitionSignatureKey(exercise);
  const existing = groups.get(key);
  if (existing) {
    existing.workoutExerciseIds.add(workoutExerciseId);
    return;
  }
  groups.set(key, {
    name: normalized.name,
    activityType: normalized.activityType,
    workoutExerciseIds: new Set([workoutExerciseId]),
  });
}

/** Unique exercise definitions from workouts and logs (matches Exercise Library grouping). */
export function collectStoredExerciseOptions(workouts: Workout[], logged: LoggedWorkout[]): StoredExerciseOption[] {
  const groups = new Map<string, ExerciseOptionGroup>();

  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      addExerciseToOptionGroups(groups, exercise, exercise.id);
    }
  }
  for (const log of logged) {
    for (const exercise of log.exercises) {
      addExerciseToOptionGroups(groups, exercise, exercise.workoutExerciseId);
    }
  }

  return [...groups.entries()]
    .map(([id, group]) => ({
      id,
      name: group.name,
      activityType: group.activityType,
      workoutExerciseIds: [...group.workoutExerciseIds],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function loggedExerciseMatchesOption(
  exercise: LoggedWorkoutExercise,
  option: StoredExerciseMetricTarget,
): boolean {
  const ids = toWorkoutExerciseIdSet(option.workoutExerciseIds);
  return (
    matchesWorkoutExercise(exercise.workoutExerciseId, ids) ||
    exerciseDefinitionSignatureKey(exercise) === option.id
  );
}

/** Visit every logged exercise row that matches this definition (including duplicate slots in one session). */
export function forEachLoggedExerciseForTarget(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
  visit: (exercise: LoggedWorkoutExercise, createdAt: string) => void,
): void {
  for (const log of logged) {
    for (const exercise of log.exercises) {
      if (loggedExerciseMatchesOption(exercise, target)) {
        visit(exercise, log.createdAt);
      }
    }
  }
}

/** Total logged appearances with actual data (duplicate slots in one session each count). */
export function countExerciseLoggedAppearances(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
): number {
  let count = 0;
  for (const log of logged) {
    for (const exercise of log.exercises) {
      if (!loggedExerciseMatchesOption(exercise, target)) {
        continue;
      }
      if (hasLoggedExerciseActual(exercise)) {
        count++;
      }
    }
  }
  return count;
}

/** ISO `createdAt` of the newest log that includes this exercise. */
export function getExerciseLastLoggedAtIso(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
): string | null {
  let bestTime = -Infinity;
  let bestIso: string | null = null;
  for (const log of logged) {
    if (!log.exercises.some((ex) => loggedExerciseMatchesOption(ex, target))) {
      continue;
    }
    const t = new Date(log.createdAt).getTime();
    if (!Number.isFinite(t)) {
      continue;
    }
    if (t >= bestTime) {
      bestTime = t;
      bestIso = log.createdAt;
    }
  }
  return bestIso;
}

/** Sum of (actualReps × actualWeight) for every logged set, across all appearances. */
export function getTotalWeightMovedForExercise(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
): number {
  let total = 0;
  forEachLoggedExerciseForTarget(logged, target, (ex) => {
    for (const set of ex.actualSets) {
      total += set.actualReps * set.actualWeight;
    }
  });
  return total;
}

export type LoggedExecutionSnapshot = {
  /** Log session timestamp (when the workout was saved). */
  createdAt: string;
  /** LoggedExerciseActualScore = avg(actualReps) × avg(actualWeight) × setsCompleted. */
  actualScore: number;
  plannedScore: number;
  /** actualScore / plannedScore (same ratio used for Execution Score per session on Metrics). */
  executionRatio: number;
};

export type LoggedWeightSnapshot = {
  /** Log session timestamp (when the workout was saved). */
  createdAt: string;
  /** Mean actual weight across logged sets for this exercise in this session. */
  avgActualWeightKg: number;
};

/**
 * One row per logged appearance of this exercise with at least one actual set.
 * Sorted by `createdAt` ascending.
 */
export function getLoggedExerciseWeightSnapshots(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
): LoggedWeightSnapshot[] {
  const out: LoggedWeightSnapshot[] = [];
  forEachLoggedExerciseForTarget(logged, target, (ex, createdAt) => {
    const setsCompleted = ex.actualSets.length;
    if (setsCompleted === 0) {
      return;
    }
    let sumW = 0;
    for (const set of ex.actualSets) {
      sumW += set.actualWeight;
    }
    const avgActual = sumW / setsCompleted;
    if (!Number.isFinite(avgActual) || avgActual < 0) {
      return;
    }
    out.push({
      createdAt,
      avgActualWeightKg: avgActual,
    });
  });
  out.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return out;
}

/**
 * One row per logged appearance of this exercise with valid actual + planned scores.
 * Sorted by `createdAt` ascending (chronological).
 */
export function getLoggedExerciseExecutionSnapshots(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
): LoggedExecutionSnapshot[] {
  const out: LoggedExecutionSnapshot[] = [];
  forEachLoggedExerciseForTarget(logged, target, (ex, createdAt) => {
    const setsCompleted = ex.actualSets.length;
    if (setsCompleted === 0) {
      return;
    }
    const plannedScore = ex.sets * ex.reps * ex.weight;
    if (plannedScore <= 0) {
      return;
    }
    let sumReps = 0;
    let sumWeight = 0;
    for (const set of ex.actualSets) {
      sumReps += set.actualReps;
      sumWeight += set.actualWeight;
    }
    const avgReps = sumReps / setsCompleted;
    const avgWeight = sumWeight / setsCompleted;
    const actualScore = avgReps * avgWeight * setsCompleted;
    const executionRatio = actualScore / plannedScore;
    if (!Number.isFinite(executionRatio)) {
      return;
    }
    out.push({
      createdAt,
      actualScore,
      plannedScore,
      executionRatio,
    });
  });
  out.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return out;
}

/**
 * Mean of per-appearance execution ratios (each duplicate slot in a session counts separately).
 * Returns a 0–100+ scale (values above 100 mean actual beat planned on this formula).
 */
export function averageExerciseExecutionScorePercent(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
): number | null {
  const snapshots = getLoggedExerciseExecutionSnapshots(logged, target);
  if (snapshots.length === 0) {
    return null;
  }
  const meanRatio = snapshots.reduce((sum, s) => sum + s.executionRatio, 0) / snapshots.length;
  return meanRatio * 100;
}

export type ExercisePersonalRecords = {
  maxWeight: number | null;
  maxReps: number | null;
  maxSets: number | null;
};

export function getExercisePersonalRecords(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
): ExercisePersonalRecords {
  let maxWeight: number | null = null;
  let maxReps: number | null = null;
  let maxSets: number | null = null;

  forEachLoggedExerciseForTarget(logged, target, (ex) => {
    const setCount = ex.actualSets.length;
    if (setCount > 0) {
      maxSets = maxSets === null ? setCount : Math.max(maxSets, setCount);
    }
    for (const set of ex.actualSets) {
      maxWeight = maxWeight === null ? set.actualWeight : Math.max(maxWeight, set.actualWeight);
      maxReps = maxReps === null ? set.actualReps : Math.max(maxReps, set.actualReps);
    }
  });

  return { maxWeight, maxReps, maxSets };
}
