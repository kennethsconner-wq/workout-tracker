export type WorkoutSaveCelebration = {
  title: string;
  message: string;
};

let pendingCelebration: WorkoutSaveCelebration | null = null;

/** Queue a celebration to show on the workouts screen after navigating away from log workout. */
export function queueWorkoutSaveCelebration(celebration: WorkoutSaveCelebration): void {
  pendingCelebration = celebration;
}

export function hasPendingWorkoutSaveCelebration(): boolean {
  return pendingCelebration !== null;
}

export function takeWorkoutSaveCelebration(): WorkoutSaveCelebration | null {
  const celebration = pendingCelebration;
  pendingCelebration = null;
  return celebration;
}
