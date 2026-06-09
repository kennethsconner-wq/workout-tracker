import type { DataRepository } from '@/lib/data/DataRepository';
import { localDataRepository } from '@/lib/data/LocalDataRepository';
import { syncEngine } from '@/lib/sync/syncEngine';

function nowIso(): string {
  return new Date().toISOString();
}

async function enqueueAllTemplates(): Promise<void> {
  const workouts = await localDataRepository.loadWorkouts();
  const updatedAt = nowIso();
  for (const workout of workouts) {
    syncEngine.enqueueChange({ kind: 'workout', id: workout.id, updatedAt });
  }
}

async function enqueueAllLogged(): Promise<void> {
  const logged = await localDataRepository.loadLoggedWorkouts();
  const updatedAt = nowIso();
  for (const workout of logged) {
    syncEngine.enqueueChange({ kind: 'logged_workout', id: workout.id, updatedAt });
  }
}

async function enqueueLibraryEntryByDefinition(
  def: Parameters<DataRepository['removeExerciseLibraryEntry']>[0],
): Promise<void> {
  const workouts = await localDataRepository.loadWorkouts();
  const logged = await localDataRepository.loadLoggedWorkouts();
  const catalog = await localDataRepository.loadExerciseLibraryCatalog(workouts, logged);
  const { exerciseDefinitionSignatureKey, matchesExerciseDefinition } = await import('@/lib/exerciseSnapshot');
  const entry = catalog.find(
    (item) =>
      matchesExerciseDefinition(item, def) ||
      exerciseDefinitionSignatureKey(item) === exerciseDefinitionSignatureKey(def),
  );
  if (entry) {
    syncEngine.enqueueChange({ kind: 'exercise_library', id: entry.id, updatedAt: nowIso() });
  }
}

/**
 * Signed-in repository: writes to local storage immediately, queues cloud sync.
 */
export function createSyncedDataRepository(): DataRepository {
  return {
    loadWorkouts: () => localDataRepository.loadWorkouts(),
    addWorkout: async (workout) => {
      const created = await localDataRepository.addWorkout(workout);
      syncEngine.enqueueChange({ kind: 'workout', id: created.id, updatedAt: nowIso() });
      void syncEngine.syncNow();
      return created;
    },
    updateWorkout: async (id, updates) => {
      const updated = await localDataRepository.updateWorkout(id, updates);
      if (updated) {
        syncEngine.enqueueChange({ kind: 'workout', id: updated.id, updatedAt: nowIso() });
        void syncEngine.syncNow();
      }
      return updated;
    },
    deleteWorkout: async (id) => {
      const logged = await localDataRepository.loadLoggedWorkouts();
      const loggedIds = logged.filter((item) => item.workoutId === id).map((item) => item.id);
      await localDataRepository.deleteLoggedWorkoutsByWorkoutId(id);
      await localDataRepository.deleteWorkout(id);
      const updatedAt = nowIso();
      syncEngine.enqueueChange({ kind: 'workout', id, updatedAt });
      for (const loggedId of loggedIds) {
        syncEngine.enqueueChange({ kind: 'logged_workout', id: loggedId, updatedAt });
      }
      void syncEngine.syncNow();
    },
    propagateExerciseDefinitionsAcrossWorkouts: async (exercises) => {
      await localDataRepository.propagateExerciseDefinitionsAcrossWorkouts(exercises);
      await enqueueAllTemplates();
      void syncEngine.syncNow();
    },
    updateExercisesMatchingSignatureAcrossWorkouts: async (oldDef, nextDef) => {
      await localDataRepository.updateExercisesMatchingSignatureAcrossWorkouts(oldDef, nextDef);
      await enqueueAllTemplates();
      await enqueueAllLogged();
      await enqueueLibraryEntryByDefinition(oldDef);
      void syncEngine.syncNow();
    },
    removeExercisesMatchingSignatureFromAllWorkouts: async (def) => {
      await localDataRepository.removeExercisesMatchingSignatureFromAllWorkouts(def);
      await enqueueAllTemplates();
      await enqueueAllLogged();
      await enqueueLibraryEntryByDefinition(def);
      void syncEngine.syncNow();
    },
    findTemplateExerciseById: localDataRepository.findTemplateExerciseById,

    loadLoggedWorkouts: () => localDataRepository.loadLoggedWorkouts(),
    addLoggedWorkout: async (workout) => {
      const created = await localDataRepository.addLoggedWorkout(workout);
      syncEngine.enqueueChange({ kind: 'logged_workout', id: created.id, updatedAt: nowIso() });
      void syncEngine.syncNow();
      return created;
    },
    updateLoggedWorkout: async (id, patch) => {
      const updated = await localDataRepository.updateLoggedWorkout(id, patch);
      if (updated) {
        syncEngine.enqueueChange({ kind: 'logged_workout', id: updated.id, updatedAt: nowIso() });
        void syncEngine.syncNow();
      }
      return updated;
    },
    deleteLoggedWorkout: async (id) => {
      await localDataRepository.deleteLoggedWorkout(id);
      syncEngine.enqueueChange({ kind: 'logged_workout', id, updatedAt: nowIso() });
      void syncEngine.syncNow();
    },
    deleteLoggedWorkoutsByWorkoutId: async (workoutId) => {
      const logged = await localDataRepository.loadLoggedWorkouts();
      const removedIds = logged.filter((item) => item.workoutId === workoutId).map((item) => item.id);
      await localDataRepository.deleteLoggedWorkoutsByWorkoutId(workoutId);
      const updatedAt = nowIso();
      for (const id of removedIds) {
        syncEngine.enqueueChange({ kind: 'logged_workout', id, updatedAt });
      }
      void syncEngine.syncNow();
    },

    loadExerciseLibraryCatalog: (workouts, logged) =>
      localDataRepository.loadExerciseLibraryCatalog(workouts, logged),
    upsertExerciseLibraryFromDefinitions: async (exercises) => {
      await localDataRepository.upsertExerciseLibraryFromDefinitions(exercises);
      syncEngine.enqueueAllLocal(nowIso());
      void syncEngine.syncNow();
    },
    replaceExerciseLibraryEntry: async (oldDef, nextDef) => {
      await localDataRepository.replaceExerciseLibraryEntry(oldDef, nextDef);
      await enqueueAllTemplates();
      await enqueueAllLogged();
      await enqueueLibraryEntryByDefinition(oldDef);
      await enqueueLibraryEntryByDefinition(nextDef);
      void syncEngine.syncNow();
    },
    removeExerciseLibraryEntry: async (def) => {
      const workouts = await localDataRepository.loadWorkouts();
      const logged = await localDataRepository.loadLoggedWorkouts();
      const catalog = await localDataRepository.loadExerciseLibraryCatalog(workouts, logged);
      const { exerciseDefinitionSignatureKey, matchesExerciseDefinition } = await import(
        '@/lib/exerciseSnapshot'
      );
      const entry = catalog.find(
        (item) =>
          matchesExerciseDefinition(item, def) ||
          exerciseDefinitionSignatureKey(item) === exerciseDefinitionSignatureKey(def),
      );
      await localDataRepository.removeExerciseLibraryEntry(def);
      if (entry) {
        syncEngine.enqueueChange({ kind: 'exercise_library', id: entry.id, updatedAt: nowIso() });
      }
      void syncEngine.syncNow();
    },
  };
}
