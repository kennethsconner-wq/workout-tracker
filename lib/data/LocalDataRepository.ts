import type { DataRepository } from '@/lib/data/DataRepository';
import {
  loadExerciseLibraryCatalog,
  removeExerciseLibraryEntry,
  replaceExerciseLibraryEntry,
  upsertExerciseLibraryFromDefinitions,
} from '@/lib/exerciseLibraryStorage';
import {
  addLoggedWorkout,
  addWorkout,
  deleteLoggedWorkout,
  deleteLoggedWorkoutsByWorkoutId,
  deleteWorkout,
  findTemplateExerciseById,
  loadLoggedWorkouts,
  loadWorkouts,
  propagateExerciseDefinitionsAcrossWorkouts,
  removeExercisesMatchingSignatureFromAllWorkouts,
  updateExercisesMatchingSignatureAcrossWorkouts,
  updateLoggedWorkout,
  updateWorkout,
} from '@/lib/workoutsStorage';

/** AsyncStorage-only repository; used for all users and as the local cache when signed in. */
export const localDataRepository: DataRepository = {
  loadWorkouts,
  addWorkout,
  updateWorkout,
  deleteWorkout,
  propagateExerciseDefinitionsAcrossWorkouts,
  updateExercisesMatchingSignatureAcrossWorkouts,
  removeExercisesMatchingSignatureFromAllWorkouts,
  findTemplateExerciseById,

  loadLoggedWorkouts,
  addLoggedWorkout,
  updateLoggedWorkout,
  deleteLoggedWorkout,
  deleteLoggedWorkoutsByWorkoutId,

  loadExerciseLibraryCatalog,
  upsertExerciseLibraryFromDefinitions,
  replaceExerciseLibraryEntry,
  removeExerciseLibraryEntry,
};
