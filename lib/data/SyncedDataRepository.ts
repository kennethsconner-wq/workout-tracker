import type { DataRepository } from '@/lib/data/DataRepository';
import type { ExerciseDefinitionMatch, ExerciseLibraryEntry } from '@/lib/exerciseLibraryStorage';
import { localDataRepository } from '@/lib/data/LocalDataRepository';
import { matchesExerciseDefinition } from '@/lib/exerciseSnapshot';
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

async function findCatalogEntryByDefinition(
  def: Parameters<DataRepository['removeExerciseLibraryEntry']>[0],
): Promise<ExerciseLibraryEntry | undefined> {
  const workouts = await localDataRepository.loadWorkouts();
  const logged = await localDataRepository.loadLoggedWorkouts();
  const catalog = await localDataRepository.loadExerciseLibraryCatalog(workouts, logged);
  return catalog.find((item) => matchesExerciseDefinition(item, def));
}

function enqueueExerciseLibrarySync(id: string, updatedAt: string = nowIso()): void {
  syncEngine.enqueueChange({ kind: 'exercise_library', id, updatedAt });
}

function enqueueExerciseLibraryCatalogSync(
  catalogEntryId: string,
  removedCatalogIds: ReadonlyArray<string>,
): void {
  const updatedAt = nowIso();
  for (const id of removedCatalogIds) {
    if (id !== catalogEntryId) {
      enqueueExerciseLibrarySync(id, updatedAt);
    }
  }
  enqueueExerciseLibrarySync(catalogEntryId, updatedAt);
}

/** Queue cloud sync for a catalog row (by id or post-edit definition). */
async function enqueueLibraryEntrySync(
  def: Parameters<DataRepository['removeExerciseLibraryEntry']>[0],
  catalogEntryId?: string,
): Promise<void> {
  if (catalogEntryId) {
    enqueueExerciseLibrarySync(catalogEntryId);
    return;
  }
  const entry = await findCatalogEntryByDefinition(def);
  if (entry) {
    enqueueExerciseLibrarySync(entry.id);
  }
}

/** Queue cloud sync for catalog rows (prefer stable exercise id over definition signature). */
async function enqueueLibraryEntriesForDefinitions(
  exercises: ReadonlyArray<ExerciseDefinitionMatch & { id?: string }>,
): Promise<void> {
  if (exercises.length === 0) {
    return;
  }
  const updatedAt = nowIso();
  const workouts = await localDataRepository.loadWorkouts();
  const logged = await localDataRepository.loadLoggedWorkouts();
  const catalog = await localDataRepository.loadExerciseLibraryCatalog(workouts, logged);
  const enqueued = new Set<string>();
  for (const exercise of exercises) {
    const explicitId = typeof exercise.id === 'string' && exercise.id.trim().length > 0 ? exercise.id : undefined;
    if (explicitId) {
      if (!enqueued.has(explicitId)) {
        enqueued.add(explicitId);
        enqueueExerciseLibrarySync(explicitId, updatedAt);
      }
      continue;
    }
    const entry = catalog.find((item) => matchesExerciseDefinition(item, exercise));
    if (entry && !enqueued.has(entry.id)) {
      enqueued.add(entry.id);
      enqueueExerciseLibrarySync(entry.id, updatedAt);
    }
  }
}

/**
 * Signed-in repository: writes to local storage immediately, queues cloud sync.
 */
export function createSyncedDataRepository(): DataRepository {
  return {
    loadWorkouts: () => localDataRepository.loadWorkouts(),
    getWorkoutById: (id) => localDataRepository.getWorkoutById(id),
    addWorkout: async (workout) => {
      const { workout: created, removedCatalogIds } = await localDataRepository.addWorkout(workout);
      const updatedAt = nowIso();
      syncEngine.enqueueChange({ kind: 'workout', id: created.id, updatedAt });
      for (const removedId of removedCatalogIds) {
        enqueueExerciseLibrarySync(removedId, updatedAt);
      }
      await enqueueLibraryEntriesForDefinitions(created.exercises);
      void syncEngine.syncNow();
      return { workout: created, removedCatalogIds };
    },
    updateWorkout: async (id, updates) => {
      const result = await localDataRepository.updateWorkout(id, updates);
      if (result) {
        const updatedAt = nowIso();
        syncEngine.enqueueChange({ kind: 'workout', id: result.workout.id, updatedAt });
        const catalogIds = new Set<string>(result.updatedCatalogEntryIds);
        for (const removedId of result.removedCatalogIds) {
          if (!catalogIds.has(removedId)) {
            enqueueExerciseLibrarySync(removedId, updatedAt);
          }
        }
        for (const entryId of catalogIds) {
          enqueueExerciseLibrarySync(entryId, updatedAt);
        }
        await enqueueLibraryEntriesForDefinitions(result.workout.exercises);
        void syncEngine.syncNow();
      }
      return result;
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
      await localDataRepository.upsertExerciseLibraryFromDefinitions(exercises);
      await enqueueAllTemplates();
      await enqueueLibraryEntriesForDefinitions(exercises);
      void syncEngine.syncNow();
    },
    updateExercisesMatchingSignatureAcrossWorkouts: async (oldDef, nextDef, options) => {
      const { catalogEntryId, removedCatalogIds } =
        await localDataRepository.updateExercisesMatchingSignatureAcrossWorkouts(oldDef, nextDef, options);
      await enqueueAllTemplates();
      await enqueueAllLogged();
      enqueueExerciseLibraryCatalogSync(catalogEntryId, removedCatalogIds);
      void syncEngine.syncNow();
    },
    removeExercisesMatchingSignatureFromAllWorkouts: async (def, options) => {
      const syncLibraryId =
        options?.catalogEntryId ?? (await findCatalogEntryByDefinition(def))?.id;
      await localDataRepository.removeExercisesMatchingSignatureFromAllWorkouts(def, options);
      await enqueueAllTemplates();
      await enqueueAllLogged();
      if (syncLibraryId) {
        enqueueExerciseLibrarySync(syncLibraryId);
      }
      void syncEngine.syncNow();
    },
    findTemplateExerciseById: localDataRepository.findTemplateExerciseById,

    loadLoggedWorkouts: () => localDataRepository.loadLoggedWorkouts(),
    getLoggedWorkoutById: (id) => localDataRepository.getLoggedWorkoutById(id),
    addLoggedWorkout: async (workout) => {
      const created = await localDataRepository.addLoggedWorkout(workout);
      const updatedAt = nowIso();
      syncEngine.enqueueChange({ kind: 'logged_workout', id: created.id, updatedAt });
      void syncEngine.syncNow();
      return created;
    },
    updateLoggedWorkout: async (id, patch) => {
      const updated = await localDataRepository.updateLoggedWorkout(id, patch);
      if (updated) {
        const updatedAt = nowIso();
        syncEngine.enqueueChange({ kind: 'logged_workout', id: updated.id, updatedAt });
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
      await enqueueLibraryEntriesForDefinitions(exercises);
      void syncEngine.syncNow();
    },
    replaceExerciseLibraryEntry: async (oldDef, nextDef, options) => {
      const { entryId, removedIds } = await localDataRepository.replaceExerciseLibraryEntry(
        oldDef,
        nextDef,
        options,
      );
      await enqueueAllTemplates();
      await enqueueAllLogged();
      enqueueExerciseLibraryCatalogSync(entryId, removedIds);
      void syncEngine.syncNow();
    },
    removeExerciseLibraryEntry: async (def, options) => {
      const syncLibraryId =
        options?.catalogEntryId ?? (await findCatalogEntryByDefinition(def))?.id;
      await localDataRepository.removeExerciseLibraryEntry(def, options);
      if (syncLibraryId) {
        enqueueExerciseLibrarySync(syncLibraryId);
      }
      void syncEngine.syncNow();
    },
  };
}
