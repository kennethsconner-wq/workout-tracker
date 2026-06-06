import type { ExerciseDefinitionMatch } from '@/lib/exerciseLibraryStorage';
import type { ExerciseLibraryEntry } from '@/lib/exerciseLibraryStorage';
import type { LoggedWorkout, Workout, WorkoutExercise } from '@/lib/types';

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
  | 'restBetweenSetsEnabled'
  | 'restDuration'
  | 'restDurationUnit'
>;

export type PropagateExerciseDefinition = Pick<
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
  | 'cardioPaceDuration'
  | 'cardioPaceDurationUnit'
  | 'cardioPaceDistance'
  | 'cardioPaceDistanceUnit'
  | 'cardioDistanceMode'
  | 'score'
  | 'scoreUnit'
  | 'restBetweenSetsEnabled'
  | 'restDuration'
  | 'restDurationUnit'
>;

/**
 * Persistence contract for workout data.
 * Screens should migrate to this interface over direct storage imports.
 */
export interface DataRepository {
  loadWorkouts(): Promise<Workout[]>;
  addWorkout(
    workout: Omit<Workout, 'id' | 'createdAt'> & Partial<Pick<Workout, 'id' | 'createdAt'>>,
  ): Promise<Workout>;
  updateWorkout(id: string, updates: Omit<Workout, 'id' | 'createdAt'>): Promise<Workout | null>;
  deleteWorkout(id: string): Promise<void>;
  propagateExerciseDefinitionsAcrossWorkouts(exercises: PropagateExerciseDefinition[]): Promise<void>;
  updateExercisesMatchingSignatureAcrossWorkouts(
    oldDef: ExerciseDefinitionFields,
    nextDef: ExerciseDefinitionFields,
  ): Promise<void>;
  removeExercisesMatchingSignatureFromAllWorkouts(def: ExerciseDefinitionFields): Promise<void>;
  findTemplateExerciseById(workouts: Workout[], exerciseId: string): WorkoutExercise | undefined;

  loadLoggedWorkouts(): Promise<LoggedWorkout[]>;
  addLoggedWorkout(
    workout: Omit<LoggedWorkout, 'id' | 'createdAt'> & Partial<Pick<LoggedWorkout, 'id' | 'createdAt'>>,
  ): Promise<LoggedWorkout>;
  updateLoggedWorkout(
    id: string,
    patch: Pick<LoggedWorkout, 'title' | 'daysOfWeek' | 'iconId' | 'exercises' | 'workoutId'> &
      Partial<Pick<LoggedWorkout, 'createdAt'>>,
  ): Promise<LoggedWorkout | null>;
  deleteLoggedWorkout(id: string): Promise<void>;
  deleteLoggedWorkoutsByWorkoutId(workoutId: string): Promise<void>;

  loadExerciseLibraryCatalog(workouts: Workout[], logged: LoggedWorkout[]): Promise<ExerciseLibraryEntry[]>;
  upsertExerciseLibraryFromDefinitions(exercises: ReadonlyArray<ExerciseDefinitionMatch>): Promise<void>;
  replaceExerciseLibraryEntry(oldDef: ExerciseDefinitionMatch, nextDef: ExerciseDefinitionMatch): Promise<void>;
  removeExerciseLibraryEntry(def: ExerciseDefinitionMatch): Promise<void>;
}
