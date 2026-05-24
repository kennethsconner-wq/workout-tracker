import type { LoggedWorkout } from '@/lib/types';

export type LoggedExercisePoint = {
  loggedWorkoutId: string;
  workoutId: string;
  workoutExerciseId: string;
  exerciseName: string;
  createdAt: string;
  plannedSets: number;
  plannedReps: number;
  plannedWeightKg: number;
  actualSets: number;
  actualReps: number;
  actualWeightKg: number;
  plannedVolume: number;
  actualVolume: number;
};

export type ExercisePR = {
  bestWeightKg: number;
  bestReps: number;
  bestVolume: number;
};

export type WorkoutSummary = {
  workoutId: string;
  sessions: number;
  avgCompletionRate: number;
  lastLoggedAt: string | null;
};

function toPoint(log: LoggedWorkout, exercise: LoggedWorkout['exercises'][number]): LoggedExercisePoint {
  const plannedVolume = exercise.sets * exercise.reps * exercise.weight;
  const actualSets = exercise.actualSets.length;
  const actualReps = actualSets === 0 ? 0 : Math.max(...exercise.actualSets.map((set) => set.actualReps));
  const actualWeightKg = actualSets === 0 ? 0 : Math.max(...exercise.actualSets.map((set) => set.actualWeight));
  const actualVolume = exercise.actualSets.reduce((sum, set) => sum + set.actualReps * set.actualWeight, 0);
  return {
    loggedWorkoutId: log.id,
    workoutId: log.workoutId,
    workoutExerciseId: exercise.workoutExerciseId,
    exerciseName: exercise.name,
    createdAt: log.createdAt,
    plannedSets: exercise.sets,
    plannedReps: exercise.reps,
    plannedWeightKg: exercise.weight,
    actualSets,
    actualReps,
    actualWeightKg,
    plannedVolume,
    actualVolume,
  };
}

function byCreatedAtAscending(a: { createdAt: string }, b: { createdAt: string }): number {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export function getExerciseTrend(logged: LoggedWorkout[], workoutExerciseId: string): LoggedExercisePoint[] {
  const points: LoggedExercisePoint[] = [];
  for (const log of logged) {
    for (const exercise of log.exercises) {
      if (exercise.workoutExerciseId === workoutExerciseId) {
        points.push(toPoint(log, exercise));
      }
    }
  }
  return points.sort(byCreatedAtAscending);
}

export function getExercisePR(logged: LoggedWorkout[], workoutExerciseId: string): ExercisePR | null {
  const trend = getExerciseTrend(logged, workoutExerciseId);
  if (trend.length === 0) {
    return null;
  }
  return trend.reduce(
    (best, point) => ({
      bestWeightKg: Math.max(best.bestWeightKg, point.actualWeightKg),
      bestReps: Math.max(best.bestReps, point.actualReps),
      bestVolume: Math.max(best.bestVolume, point.actualVolume),
    }),
    { bestWeightKg: 0, bestReps: 0, bestVolume: 0 },
  );
}

export function getWorkoutSummary(logged: LoggedWorkout[], workoutId: string): WorkoutSummary | null {
  const sessions = logged.filter((log) => log.workoutId === workoutId);
  if (sessions.length === 0) {
    return null;
  }

  const completionRates = sessions.map((session) => {
    if (session.exercises.length === 0) {
      return 0;
    }
    const completed = session.exercises.filter(
      (exercise) =>
        exercise.actualSets.length > 0 &&
        exercise.actualSets.every((set) => set.actualReps > 0 && set.actualWeight >= 0),
    ).length;
    return completed / session.exercises.length;
  });

  const avgCompletionRate =
    completionRates.reduce((sum, completion) => sum + completion, 0) / completionRates.length;
  const sorted = [...sessions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    workoutId,
    sessions: sessions.length,
    avgCompletionRate,
    lastLoggedAt: sorted[0]?.createdAt ?? null,
  };
}
