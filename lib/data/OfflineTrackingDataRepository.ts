import type { DataRepository } from '@/lib/data/DataRepository';
import type { ExerciseDefinitionMatch } from '@/lib/exerciseLibraryStorage';
import { matchesExerciseDefinition } from '@/lib/exerciseSnapshot';
import { markOfflineChange, markOfflineChanges } from '@/lib/sync/offlineChangeStorage';
import type { SyncEntityKind } from '@/lib/supabase/types';

function nowIso(): string {
  return new Date().toISOString();
}

function markKind(kind: SyncEntityKind, id: string): void {
  void markOfflineChange(kind, id, nowIso());
}

async function markLibraryEntriesForDefinitions(
  repo: DataRepository,
  exercises: ReadonlyArray<ExerciseDefinitionMatch & { id?: string }>,
): Promise<void> {
  if (exercises.length === 0) {
    return;
  }
  const updatedAt = nowIso();
  const workouts = await repo.loadWorkouts();
  const logged = await repo.loadLoggedWorkouts();
  const catalog = await repo.loadExerciseLibraryCatalog(workouts, logged);
  const changes: Array<{ kind: SyncEntityKind; id: string; updatedAt: string }> = [];
  const seen = new Set<string>();
  for (const exercise of exercises) {
    const explicitId = typeof exercise.id === 'string' && exercise.id.trim().length > 0 ? exercise.id : undefined;
    if (explicitId) {
      if (!seen.has(explicitId)) {
        seen.add(explicitId);
        changes.push({ kind: 'exercise_library', id: explicitId, updatedAt });
      }
      continue;
    }
    const entry = catalog.find((item) => matchesExerciseDefinition(item, exercise));
    if (entry && !seen.has(entry.id)) {
      seen.add(entry.id);
      changes.push({ kind: 'exercise_library', id: entry.id, updatedAt });
    }
  }
  await markOfflineChanges(changes);
}

async function markAllTemplates(repo: DataRepository): Promise<void> {
  const updatedAt = nowIso();
  const workouts = await repo.loadWorkouts();
  await markOfflineChanges(workouts.map((workout) => ({ kind: 'workout', id: workout.id, updatedAt })));
}

async function markAllLogged(repo: DataRepository): Promise<void> {
  const updatedAt = nowIso();
  const logged = await repo.loadLoggedWorkouts();
  await markOfflineChanges(logged.map((workout) => ({ kind: 'logged_workout', id: workout.id, updatedAt })));
}

async function findCatalogEntryByDefinition(
  repo: DataRepository,
  def: Parameters<DataRepository['removeExerciseLibraryEntry']>[0],
) {
  const workouts = await repo.loadWorkouts();
  const logged = await repo.loadLoggedWorkouts();
  const catalog = await repo.loadExerciseLibraryCatalog(workouts, logged);
  return catalog.find((item) => matchesExerciseDefinition(item, def));
}

/**
 * Wraps local storage writes while signed out so changes can be uploaded after sign-in.
 */
export function createOfflineTrackingDataRepository(base: DataRepository): DataRepository {
  return {
    loadWorkouts: () => base.loadWorkouts(),
    getWorkoutById: (id) => base.getWorkoutById(id),
    addWorkout: async (workout) => {
      const result = await base.addWorkout(workout);
      markKind('workout', result.workout.id);
      for (const removedId of result.removedCatalogIds) {
        markKind('exercise_library', removedId);
      }
      await markLibraryEntriesForDefinitions(base, result.workout.exercises);
      return result;
    },
    updateWorkout: async (id, updates) => {
      const result = await base.updateWorkout(id, updates);
      if (result) {
        markKind('workout', result.workout.id);
        const catalogIds = new Set(result.updatedCatalogEntryIds);
        for (const removedId of result.removedCatalogIds) {
          if (!catalogIds.has(removedId)) {
            markKind('exercise_library', removedId);
          }
        }
        for (const entryId of catalogIds) {
          markKind('exercise_library', entryId);
        }
        await markLibraryEntriesForDefinitions(base, result.workout.exercises);
      }
      return result;
    },
    deleteWorkout: async (id) => {
      const logged = await base.loadLoggedWorkouts();
      const loggedIds = logged.filter((item) => item.workoutId === id).map((item) => item.id);
      await base.deleteLoggedWorkoutsByWorkoutId(id);
      await base.deleteWorkout(id);
      markKind('workout', id);
      for (const loggedId of loggedIds) {
        markKind('logged_workout', loggedId);
      }
    },
    propagateExerciseDefinitionsAcrossWorkouts: async (exercises) => {
      await base.propagateExerciseDefinitionsAcrossWorkouts(exercises);
      await base.upsertExerciseLibraryFromDefinitions(exercises);
      await markAllTemplates(base);
      await markLibraryEntriesForDefinitions(base, exercises);
    },
    updateExercisesMatchingSignatureAcrossWorkouts: async (oldDef, nextDef, options) => {
      const result = await base.updateExercisesMatchingSignatureAcrossWorkouts(oldDef, nextDef, options);
      await markAllTemplates(base);
      await markAllLogged(base);
      markKind('exercise_library', result.catalogEntryId);
      for (const removedId of result.removedCatalogIds) {
        if (removedId !== result.catalogEntryId) {
          markKind('exercise_library', removedId);
        }
      }
      return result;
    },
    removeExercisesMatchingSignatureFromAllWorkouts: async (def, options) => {
      const syncLibraryId =
        options?.catalogEntryId ?? (await findCatalogEntryByDefinition(base, def))?.id;
      await base.removeExercisesMatchingSignatureFromAllWorkouts(def, options);
      await markAllTemplates(base);
      await markAllLogged(base);
      if (syncLibraryId) {
        markKind('exercise_library', syncLibraryId);
      }
    },
    findTemplateExerciseById: base.findTemplateExerciseById,

    loadLoggedWorkouts: () => base.loadLoggedWorkouts(),
    getLoggedWorkoutById: (id) => base.getLoggedWorkoutById(id),
    addLoggedWorkout: async (workout) => {
      const created = await base.addLoggedWorkout(workout);
      markKind('logged_workout', created.id);
      return created;
    },
    updateLoggedWorkout: async (id, patch) => {
      const updated = await base.updateLoggedWorkout(id, patch);
      if (updated) {
        markKind('logged_workout', updated.id);
      }
      return updated;
    },
    deleteLoggedWorkout: async (id) => {
      await base.deleteLoggedWorkout(id);
      markKind('logged_workout', id);
    },
    deleteLoggedWorkoutsByWorkoutId: async (workoutId) => {
      const logged = await base.loadLoggedWorkouts();
      const removedIds = logged.filter((item) => item.workoutId === workoutId).map((item) => item.id);
      await base.deleteLoggedWorkoutsByWorkoutId(workoutId);
      for (const removedId of removedIds) {
        markKind('logged_workout', removedId);
      }
    },

    loadExerciseLibraryCatalog: (workouts, logged) => base.loadExerciseLibraryCatalog(workouts, logged),
    upsertExerciseLibraryFromDefinitions: async (exercises) => {
      await base.upsertExerciseLibraryFromDefinitions(exercises);
      await markLibraryEntriesForDefinitions(base, exercises);
    },
    replaceExerciseLibraryEntry: async (oldDef, nextDef, options) => {
      const result = await base.replaceExerciseLibraryEntry(oldDef, nextDef, options);
      await markAllTemplates(base);
      await markAllLogged(base);
      markKind('exercise_library', result.entryId);
      for (const removedId of result.removedIds) {
        if (removedId !== result.entryId) {
          markKind('exercise_library', removedId);
        }
      }
      return result;
    },
    removeExerciseLibraryEntry: async (def, options) => {
      const syncLibraryId =
        options?.catalogEntryId ?? (await findCatalogEntryByDefinition(base, def))?.id;
      await base.removeExerciseLibraryEntry(def, options);
      if (syncLibraryId) {
        markKind('exercise_library', syncLibraryId);
      }
    },
  };
}
