import AsyncStorage from '@react-native-async-storage/async-storage';

import { sanitizeWorkoutExercise } from '@/lib/exerciseDraft';
import { newId } from '@/lib/ids';
import {
  exerciseDefinitionSignatureKey,
  matchesExerciseDefinition,
  type ExerciseDefinitionMatch,
} from '@/lib/exerciseSnapshot';
import type { LoggedWorkout, LoggedWorkoutExercise, Workout, WorkoutExercise } from '@/lib/types';

export type { ExerciseDefinitionMatch };

const EXERCISE_LIBRARY_STORAGE_KEY = 'exercise-library@v1';

export type ExerciseLibraryEntry = WorkoutExercise;

function normalizeLibraryEntry(raw: unknown): ExerciseLibraryEntry | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.name !== 'string') {
    return null;
  }
  return sanitizeWorkoutExercise(record as WorkoutExercise);
}

async function readExerciseLibraryRaw(): Promise<ExerciseLibraryEntry[]> {
  const raw = await AsyncStorage.getItem(EXERCISE_LIBRARY_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map(normalizeLibraryEntry).filter((entry): entry is ExerciseLibraryEntry => entry != null);
  } catch {
    return [];
  }
}

async function writeExerciseLibrary(entries: ExerciseLibraryEntry[]): Promise<void> {
  await AsyncStorage.setItem(EXERCISE_LIBRARY_STORAGE_KEY, JSON.stringify(entries));
}

function sortCatalogEntries(entries: ExerciseLibraryEntry[]): ExerciseLibraryEntry[] {
  return [...entries].sort((a, b) => a.name.localeCompare(b.name));
}

/** Raw persisted catalog entries (for cloud sync). */
export async function loadExerciseLibraryEntries(): Promise<ExerciseLibraryEntry[]> {
  return readExerciseLibraryRaw();
}

/** Replace the entire exercise library cache (used when merging cloud data). */
export async function replaceExerciseLibraryEntries(entries: ExerciseLibraryEntry[]): Promise<void> {
  await writeExerciseLibrary(entries);
}

function definitionFields(
  exercise: ExerciseDefinitionMatch,
): ExerciseDefinitionMatch {
  return {
    activityType: exercise.activityType,
    name: exercise.name,
    sets: exercise.sets,
    reps: exercise.reps,
    weight: exercise.weight,
    weightUnit: exercise.weightUnit,
    duration: exercise.duration,
    durationUnit: exercise.durationUnit,
    distance: exercise.distance,
    distanceUnit: exercise.distanceUnit,
    cardioObjective: exercise.cardioObjective,
    cardioDurationTracking: exercise.cardioDurationTracking,
    cardioDistanceTracking: exercise.cardioDistanceTracking,
    cardioPaceDuration: exercise.cardioPaceDuration,
    cardioPaceDurationUnit: exercise.cardioPaceDurationUnit,
    cardioPaceDistance: exercise.cardioPaceDistance,
    cardioPaceDistanceUnit: exercise.cardioPaceDistanceUnit,
    cardioDistanceMode: exercise.cardioDistanceMode,
    score: exercise.score,
    scoreUnit: exercise.scoreUnit,
    restBetweenSetsEnabled: exercise.restBetweenSetsEnabled,
    restDuration: exercise.restDuration,
    restDurationUnit: exercise.restDurationUnit,
  };
}

function loggedExerciseToDefinitionFields(exercise: LoggedWorkoutExercise): ExerciseDefinitionMatch {
  return {
    activityType: exercise.activityType,
    name: exercise.name,
    sets: exercise.sets,
    reps: exercise.reps,
    weight: exercise.weight,
    weightUnit: exercise.weightUnit,
    duration: exercise.duration,
    durationUnit: exercise.durationUnit,
    distance: exercise.distance,
    distanceUnit: exercise.distanceUnit,
    cardioObjective: exercise.cardioObjective,
    cardioDurationTracking: exercise.cardioDurationTracking,
    cardioDistanceTracking: exercise.cardioDistanceTracking,
    cardioPaceDuration: exercise.cardioPaceDuration,
    cardioPaceDurationUnit: exercise.cardioPaceDurationUnit,
    cardioPaceDistance: exercise.cardioPaceDistance,
    cardioPaceDistanceUnit: exercise.cardioPaceDistanceUnit,
    cardioDistanceMode: exercise.cardioDistanceMode,
    score: exercise.score,
    scoreUnit: exercise.scoreUnit,
  };
}

function catalogEntriesById(catalog: ExerciseLibraryEntry[]): Map<string, ExerciseLibraryEntry> {
  return new Map(catalog.map((entry) => [entry.id, entry]));
}

function loggedExerciseMatchesDefinition(
  exercise: LoggedWorkoutExercise,
  def: ExerciseDefinitionMatch,
): boolean {
  return matchesExerciseDefinition(exercise, def);
}

/** Merge workout/log definitions into the catalog without removing orphaned catalog entries. */
function mergeDefinitionsIntoCatalog(
  catalog: ExerciseLibraryEntry[],
  workouts: Workout[],
  logged: LoggedWorkout[],
): { entries: ExerciseLibraryEntry[]; changed: boolean } {
  const byId = catalogEntriesById(catalog);
  const templateExerciseIds = new Set<string>();
  let changed = false;

  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      templateExerciseIds.add(exercise.id);
      const entry = sanitizeWorkoutExercise({
        ...exercise,
        id: exercise.id,
      });
      const existing = byId.get(exercise.id);
      if (!existing || JSON.stringify(existing) !== JSON.stringify(entry)) {
        byId.set(exercise.id, entry);
        changed = true;
      }
    }
  }

  for (const log of logged) {
    for (const exercise of log.exercises) {
      const id = exercise.workoutExerciseId;
      if (!id || templateExerciseIds.has(id) || byId.has(id)) {
        continue;
      }
      const entry = sanitizeWorkoutExercise({
        id,
        ...loggedExerciseToDefinitionFields(exercise),
      });
      byId.set(id, entry);
      changed = true;
    }
  }

  return {
    entries: sortCatalogEntries([...byId.values()]),
    changed,
  };
}

/** Catalog entries persist until removed from the Exercise Library screen. */
export async function loadExerciseLibraryCatalog(
  workouts: Workout[],
  logged: LoggedWorkout[],
): Promise<ExerciseLibraryEntry[]> {
  const catalog = await readExerciseLibraryRaw();
  const { entries, changed } = mergeDefinitionsIntoCatalog(catalog, workouts, logged);
  if (changed) {
    await writeExerciseLibrary(entries);
  }
  const preferIds = new Set(workouts.flatMap((workout) => workout.exercises.map((exercise) => exercise.id)));
  await dedupeExerciseLibraryBySignature(preferIds);
  return readExerciseLibraryRaw();
}

type ExerciseDefinitionWithId = ExerciseDefinitionMatch & { id?: string; workoutExerciseId?: string };

function catalogEntryIdFromDefinition(exercise: ExerciseDefinitionWithId): string {
  const templateId =
    typeof exercise.workoutExerciseId === 'string' && exercise.workoutExerciseId.trim().length > 0
      ? exercise.workoutExerciseId
      : undefined;
  if (templateId) {
    return templateId;
  }
  const explicitId = typeof exercise.id === 'string' && exercise.id.trim().length > 0 ? exercise.id : undefined;
  return explicitId ?? newId();
}

export async function upsertExerciseLibraryFromDefinitions(
  exercises: ReadonlyArray<ExerciseDefinitionWithId>,
): Promise<void> {
  if (exercises.length === 0) {
    return;
  }
  const catalog = await readExerciseLibraryRaw();
  const byId = catalogEntriesById(catalog);
  let changed = false;
  for (const exercise of exercises) {
    const entryId = catalogEntryIdFromDefinition(exercise);
    const entry = sanitizeWorkoutExercise({
      id: entryId,
      ...definitionFields(exercise),
    });
    const existing = byId.get(entryId);
    if (!existing || JSON.stringify(existing) !== JSON.stringify(entry)) {
      byId.set(entryId, entry);
      changed = true;
    }
  }
  if (changed) {
    await writeExerciseLibrary(sortCatalogEntries([...byId.values()]));
  }
}

/** Collapse duplicate catalog rows that share the same exercise definition signature. */
export async function dedupeExerciseLibraryBySignature(
  preferIds?: ReadonlySet<string>,
): Promise<string[]> {
  const catalog = await readExerciseLibraryRaw();
  const bySignature = new Map<string, ExerciseLibraryEntry>();
  const removedIds: string[] = [];
  for (const entry of catalog) {
    const signature = exerciseDefinitionSignatureKey(entry);
    const kept = bySignature.get(signature);
    if (!kept) {
      bySignature.set(signature, entry);
      continue;
    }
    const preferNew =
      preferIds != null && preferIds.has(entry.id) && !preferIds.has(kept.id);
    if (preferNew) {
      removedIds.push(kept.id);
      bySignature.set(signature, entry);
    } else {
      removedIds.push(entry.id);
    }
  }
  if (removedIds.length > 0) {
    await writeExerciseLibrary(sortCatalogEntries([...bySignature.values()]));
  }
  return removedIds;
}

export async function replaceExerciseLibraryEntry(
  oldDef: ExerciseDefinitionMatch,
  nextDef: ExerciseDefinitionMatch,
  options?: { catalogEntryId?: string },
): Promise<{ entryId: string; removedIds: string[] }> {
  const catalog = await readExerciseLibraryRaw();
  const removedIds: string[] = [];
  const entryId =
    options?.catalogEntryId ??
    catalog.find((entry) => matchesExerciseDefinition(entry, oldDef))?.id ??
    newId();
  const updated = sanitizeWorkoutExercise({
    id: entryId,
    ...definitionFields(nextDef),
  });

  const kept = catalog.filter((entry) => {
    if (entry.id === entryId) {
      return false;
    }
    if (options?.catalogEntryId) {
      return true;
    }
    const shouldRemove = matchesExerciseDefinition(entry, oldDef);
    if (shouldRemove) {
      removedIds.push(entry.id);
      return false;
    }
    return true;
  });

  kept.push(updated);
  await writeExerciseLibrary(sortCatalogEntries(kept));

  return {
    entryId,
    removedIds: removedIds.filter((id) => id !== entryId),
  };
}

export async function removeExerciseLibraryEntry(
  def: ExerciseDefinitionMatch,
  options?: { catalogEntryId?: string },
): Promise<void> {
  const catalog = await readExerciseLibraryRaw();
  const next = catalog.filter((entry) => {
    if (options?.catalogEntryId) {
      return entry.id !== options.catalogEntryId;
    }
    return !matchesExerciseDefinition(entry, def);
  });
  if (next.length !== catalog.length) {
    await writeExerciseLibrary(next);
  }
}

export function loggedExerciseMatchesDefinitionForRemoval(
  exercise: LoggedWorkoutExercise,
  def: ExerciseDefinitionMatch,
  templateExerciseIds: ReadonlySet<string>,
): boolean {
  return templateExerciseIds.has(exercise.workoutExerciseId) || loggedExerciseMatchesDefinition(exercise, def);
}
