import type { DataRepository } from '@/lib/data/DataRepository';
import { localDataRepository } from '@/lib/data/LocalDataRepository';
import { syncEngine } from '@/lib/sync/syncEngine';

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Signed-in repository: writes to local storage immediately, queues cloud sync (Phase 3).
 * Phase 0 delegates all reads/writes to local storage.
 */
export function createSyncedDataRepository(): DataRepository {
  return {
    loadWorkouts: () => localDataRepository.loadWorkouts(),
    addWorkout: async (workout) => {
      const created = await localDataRepository.addWorkout(workout);
      syncEngine.enqueueChange({ kind: 'workout', id: created.id, updatedAt: nowIso() });
      return created;
    },
    updateWorkout: async (id, updates) => {
      const updated = await localDataRepository.updateWorkout(id, updates);
      if (updated) {
        syncEngine.enqueueChange({ kind: 'workout', id: updated.id, updatedAt: nowIso() });
      }
      return updated;
    },
    deleteWorkout: async (id) => {
      await localDataRepository.deleteWorkout(id);
      syncEngine.enqueueChange({ kind: 'workout', id, updatedAt: nowIso() });
    },
    propagateExerciseDefinitionsAcrossWorkouts: async (exercises) => {
      await localDataRepository.propagateExerciseDefinitionsAcrossWorkouts(exercises);
      for (const exercise of exercises) {
        syncEngine.enqueueChange({ kind: 'workout', id: exercise.id, updatedAt: nowIso() });
      }
    },
    updateExercisesMatchingSignatureAcrossWorkouts: async (oldDef, nextDef) => {
      await localDataRepository.updateExercisesMatchingSignatureAcrossWorkouts(oldDef, nextDef);
    },
    removeExercisesMatchingSignatureFromAllWorkouts: async (def) => {
      await localDataRepository.removeExercisesMatchingSignatureFromAllWorkouts(def);
    },
    findTemplateExerciseById: localDataRepository.findTemplateExerciseById,

    loadLoggedWorkouts: () => localDataRepository.loadLoggedWorkouts(),
    addLoggedWorkout: async (workout) => {
      const created = await localDataRepository.addLoggedWorkout(workout);
      syncEngine.enqueueChange({ kind: 'logged_workout', id: created.id, updatedAt: nowIso() });
      return created;
    },
    updateLoggedWorkout: async (id, patch) => {
      const updated = await localDataRepository.updateLoggedWorkout(id, patch);
      if (updated) {
        syncEngine.enqueueChange({ kind: 'logged_workout', id: updated.id, updatedAt: nowIso() });
      }
      return updated;
    },
    deleteLoggedWorkout: async (id) => {
      await localDataRepository.deleteLoggedWorkout(id);
      syncEngine.enqueueChange({ kind: 'logged_workout', id, updatedAt: nowIso() });
    },
    deleteLoggedWorkoutsByWorkoutId: async (workoutId) => {
      await localDataRepository.deleteLoggedWorkoutsByWorkoutId(workoutId);
    },

    loadExerciseLibraryCatalog: (workouts, logged) =>
      localDataRepository.loadExerciseLibraryCatalog(workouts, logged),
    upsertExerciseLibraryFromDefinitions: (exercises) =>
      localDataRepository.upsertExerciseLibraryFromDefinitions(exercises),
    replaceExerciseLibraryEntry: async (oldDef, nextDef) => {
      await localDataRepository.replaceExerciseLibraryEntry(oldDef, nextDef);
    },
    removeExerciseLibraryEntry: async (def) => {
      await localDataRepository.removeExerciseLibraryEntry(def);
    },
  };
}
