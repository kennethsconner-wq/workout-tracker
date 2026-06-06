import type { LoggedWorkout, Workout } from '@/lib/types';
import type { ExerciseLibraryEntry } from '@/lib/exerciseLibraryStorage';

/** Row shape for cloud tables; `data` holds the full domain object. */
export type CloudWorkoutRow = {
  id: string;
  user_id: string;
  updated_at: string;
  deleted_at: string | null;
  data: Workout;
};

export type CloudLoggedWorkoutRow = {
  id: string;
  user_id: string;
  updated_at: string;
  deleted_at: string | null;
  data: LoggedWorkout;
};

export type CloudExerciseLibraryRow = {
  id: string;
  user_id: string;
  updated_at: string;
  deleted_at: string | null;
  data: ExerciseLibraryEntry;
};

export type SyncEntityKind = 'workout' | 'logged_workout' | 'exercise_library';

export type SyncChange = {
  kind: SyncEntityKind;
  id: string;
  updatedAt: string;
};
