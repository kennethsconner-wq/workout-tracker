import type { LoggedWorkout, Workout } from '@/lib/types';

export type StoredExerciseOption = {
  id: string;
  name: string;
};

/** All exercises from saved workouts, plus any ids seen only in logs (legacy / deleted templates). */
export function collectStoredExerciseOptions(workouts: Workout[], logged: LoggedWorkout[]): StoredExerciseOption[] {
  const byId = new Map<string, string>();
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      if (!byId.has(exercise.id)) {
        byId.set(exercise.id, exercise.name);
      }
    }
  }
  for (const log of logged) {
    for (const exercise of log.exercises) {
      if (!byId.has(exercise.workoutExerciseId)) {
        byId.set(exercise.workoutExerciseId, exercise.name);
      }
    }
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** How many completed logs include this template exercise id at least once. */
export function countExerciseLoggedSessions(logged: LoggedWorkout[], workoutExerciseId: string): number {
  return logged.filter((log) => log.exercises.some((ex) => ex.workoutExerciseId === workoutExerciseId)).length;
}

/** ISO `createdAt` of the newest log that includes this exercise (same sessions as Times Logged on Metrics). */
export function getExerciseLastLoggedAtIso(logged: LoggedWorkout[], workoutExerciseId: string): string | null {
  let bestTime = -Infinity;
  let bestIso: string | null = null;
  for (const log of logged) {
    if (!log.exercises.some((ex) => ex.workoutExerciseId === workoutExerciseId)) {
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

/** Sum of (actualReps × actualWeightKg) for every logged set of this exercise, across all sessions. */
export function getTotalWeightMovedForExercise(logged: LoggedWorkout[], workoutExerciseId: string): number {
  let total = 0;
  for (const log of logged) {
    for (const ex of log.exercises) {
      if (ex.workoutExerciseId !== workoutExerciseId) {
        continue;
      }
      for (const set of ex.actualSets) {
        total += set.actualReps * set.actualWeightKg;
      }
    }
  }
  return total;
}

export type LoggedExecutionSnapshot = {
  /** Log session timestamp (when the workout was saved). */
  createdAt: string;
  /** LoggedExerciseActualScore = avg(actualReps) × avg(actualWeightKg) × setsCompleted. */
  actualScore: number;
  plannedScore: number;
  /** actualScore / plannedScore (same ratio used for Execution Score per session on Metrics). */
  executionRatio: number;
};

export type LoggedWeightSnapshot = {
  /** Log session timestamp (when the workout was saved). */
  createdAt: string;
  /** Mean `actualWeightKg` across logged sets for this exercise in this session. */
  avgActualWeightKg: number;
  /** Planned weight (`ex.weightKg`) for this exercise in that session. */
  plannedWeightKg: number;
};

/**
 * One row per logged appearance of this exercise with at least one actual set.
 * `avgActualWeightKg` = mean weight across actual sets; `plannedWeightKg` = planned weight on the log.
 * Sorted by `createdAt` ascending.
 */
export function getLoggedExerciseWeightSnapshots(
  logged: LoggedWorkout[],
  workoutExerciseId: string,
): LoggedWeightSnapshot[] {
  const out: LoggedWeightSnapshot[] = [];
  for (const log of logged) {
    for (const ex of log.exercises) {
      if (ex.workoutExerciseId !== workoutExerciseId) {
        continue;
      }
      const setsCompleted = ex.actualSets.length;
      if (setsCompleted === 0) {
        continue;
      }
      let sumW = 0;
      for (const set of ex.actualSets) {
        sumW += set.actualWeightKg;
      }
      const avgActual = sumW / setsCompleted;
      if (!Number.isFinite(avgActual) || avgActual < 0) {
        continue;
      }
      const planned = ex.weightKg;
      if (!Number.isFinite(planned) || planned < 0) {
        continue;
      }
      out.push({
        createdAt: log.createdAt,
        avgActualWeightKg: avgActual,
        plannedWeightKg: planned,
      });
    }
  }
  out.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return out;
}

/**
 * One row per logged appearance of this exercise with valid actual + planned scores.
 * Sorted by `createdAt` ascending (chronological).
 */
export function getLoggedExerciseExecutionSnapshots(
  logged: LoggedWorkout[],
  workoutExerciseId: string,
): LoggedExecutionSnapshot[] {
  const out: LoggedExecutionSnapshot[] = [];
  for (const log of logged) {
    for (const ex of log.exercises) {
      if (ex.workoutExerciseId !== workoutExerciseId) {
        continue;
      }
      const setsCompleted = ex.actualSets.length;
      if (setsCompleted === 0) {
        continue;
      }
      const plannedScore = ex.sets * ex.reps * ex.weightKg;
      if (plannedScore <= 0) {
        continue;
      }
      let sumReps = 0;
      let sumWeight = 0;
      for (const set of ex.actualSets) {
        sumReps += set.actualReps;
        sumWeight += set.actualWeightKg;
      }
      const avgReps = sumReps / setsCompleted;
      const avgWeight = sumWeight / setsCompleted;
      const actualScore = avgReps * avgWeight * setsCompleted;
      const executionRatio = actualScore / plannedScore;
      if (!Number.isFinite(executionRatio)) {
        continue;
      }
      out.push({
        createdAt: log.createdAt,
        actualScore,
        plannedScore,
        executionRatio,
      });
    }
  }
  out.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return out;
}

/**
 * Mean of per-log execution ratios for this exercise.
 * For each logged row: ActualScore = avg(actualReps) * avg(actualWeightKg) * setsCompleted,
 * PlannedScore = planned sets * planned reps * planned weight (fields on the log),
 * ratio = ActualScore / PlannedScore. Averages every such ratio (skips rows with no actual sets or zero planned score).
 * Returns a 0–100+ scale (values above 100 mean actual beat planned on this formula).
 */
export function averageExerciseExecutionScorePercent(
  logged: LoggedWorkout[],
  workoutExerciseId: string,
): number | null {
  const snapshots = getLoggedExerciseExecutionSnapshots(logged, workoutExerciseId);
  if (snapshots.length === 0) {
    return null;
  }
  const meanRatio = snapshots.reduce((sum, s) => sum + s.executionRatio, 0) / snapshots.length;
  return meanRatio * 100;
}

export type ExercisePersonalRecords = {
  /** Max `actualWeightKg` seen in any single logged set (matches app weight labels as lb). */
  maxWeight: number | null;
  /** Max `actualReps` in any single logged set. */
  maxReps: number | null;
  /** Largest `actualSets.length` for this exercise in any one logged session. */
  maxSets: number | null;
};

export function getExercisePersonalRecords(
  logged: LoggedWorkout[],
  workoutExerciseId: string,
): ExercisePersonalRecords {
  let maxWeight: number | null = null;
  let maxReps: number | null = null;
  let maxSets: number | null = null;

  for (const log of logged) {
    for (const ex of log.exercises) {
      if (ex.workoutExerciseId !== workoutExerciseId) {
        continue;
      }
      const setCount = ex.actualSets.length;
      if (setCount > 0) {
        maxSets = maxSets === null ? setCount : Math.max(maxSets, setCount);
      }
      for (const set of ex.actualSets) {
        maxWeight = maxWeight === null ? set.actualWeightKg : Math.max(maxWeight, set.actualWeightKg);
        maxReps = maxReps === null ? set.actualReps : Math.max(maxReps, set.actualReps);
      }
    }
  }

  return { maxWeight, maxReps, maxSets };
}
