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

export type WorkoutLogStats = {
  workoutId: string;
  sessionCount: number;
  lastLoggedAt: string | null;
  firstLoggedAt: string | null;
  sessionsThisMonth: number;
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

function startOfLocalMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function buildWorkoutLogStatsByWorkoutId(logged: LoggedWorkout[]): Map<string, WorkoutLogStats> {
  const statsByWorkoutId = new Map<string, WorkoutLogStats>();
  const monthStart = startOfLocalMonth(new Date());

  for (const log of logged) {
    const createdAtMs = new Date(log.createdAt).getTime();
    const existing = statsByWorkoutId.get(log.workoutId) ?? {
      workoutId: log.workoutId,
      sessionCount: 0,
      lastLoggedAt: null,
      firstLoggedAt: null,
      sessionsThisMonth: 0,
    };

    existing.sessionCount += 1;
    if (!existing.lastLoggedAt || createdAtMs > new Date(existing.lastLoggedAt).getTime()) {
      existing.lastLoggedAt = log.createdAt;
    }
    if (!existing.firstLoggedAt || createdAtMs < new Date(existing.firstLoggedAt).getTime()) {
      existing.firstLoggedAt = log.createdAt;
    }
    if (new Date(log.createdAt) >= monthStart) {
      existing.sessionsThisMonth += 1;
    }

    statsByWorkoutId.set(log.workoutId, existing);
  }

  return statsByWorkoutId;
}

export function formatWorkoutLastLogged(lastLoggedAt: string | null): string {
  if (!lastLoggedAt) {
    return 'Not yet';
  }

  const loggedDate = new Date(lastLoggedAt);
  const today = startOfLocalDay(new Date());
  const loggedDay = startOfLocalDay(loggedDate);
  const dayDiff = Math.round((today.getTime() - loggedDay.getTime()) / (1000 * 60 * 60 * 24));

  if (dayDiff <= 0) {
    return 'Today';
  }
  if (dayDiff === 1) {
    return 'Yesterday';
  }
  if (dayDiff < 7) {
    return `${dayDiff} days ago`;
  }
  if (dayDiff < 14) {
    return '1 week ago';
  }
  if (dayDiff < 30) {
    return `${Math.floor(dayDiff / 7)} weeks ago`;
  }

  return loggedDate.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function formatWorkoutSessionCount(stats: WorkoutLogStats | undefined): string {
  if (!stats || stats.sessionCount === 0) {
    return 'Not logged yet';
  }

  const countLabel = `${stats.sessionCount} time${stats.sessionCount === 1 ? '' : 's'}`;
  if (stats.sessionsThisMonth > 0) {
    const monthLabel = `${stats.sessionsThisMonth} this month`;
    return stats.sessionsThisMonth === stats.sessionCount ? countLabel : `${countLabel} · ${monthLabel}`;
  }

  return countLabel;
}

export function formatWorkoutTrackingSince(firstLoggedAt: string | null, sessionCount: number): string | null {
  if (!firstLoggedAt || sessionCount < 2) {
    return null;
  }

  return `Since ${new Date(firstLoggedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
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
