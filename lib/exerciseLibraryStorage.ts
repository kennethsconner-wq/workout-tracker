import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  exerciseDefinitionBaseSignatureKey,
  exerciseDefinitionSignatureKey,
} from '@/lib/exerciseSnapshot';
import { sanitizeWorkoutExercise } from '@/lib/exerciseDraft';
import { newId } from '@/lib/ids';
import {
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

function loggedExerciseMatchesDefinition(
  exercise: LoggedWorkoutExercise,
  def: ExerciseDefinitionMatch,
): boolean {
  return (
    matchesExerciseDefinition(exercise, def) ||
    exerciseDefinitionSignatureKey(exercise) === exerciseDefinitionSignatureKey(def)
  );
}

/** Merge workout/log definitions into the catalog without removing orphaned catalog entries. */
function mergeDefinitionsIntoCatalog(
  catalog: ExerciseLibraryEntry[],
  workouts: Workout[],
  logged: LoggedWorkout[],
): { entries: ExerciseLibraryEntry[]; changed: boolean } {
  const bySignature = new Map<string, ExerciseLibraryEntry>();
  for (const entry of catalog) {
    bySignature.set(exerciseDefinitionSignatureKey(entry), entry);
  }

  let changed = false;
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const key = exerciseDefinitionSignatureKey(exercise);
      const baseKey = exerciseDefinitionBaseSignatureKey(exercise);
      for (const existingKey of [...bySignature.keys()]) {
        if (existingKey === key) {
          continue;
        }
        const existingEntry = bySignature.get(existingKey);
        if (existingEntry && exerciseDefinitionBaseSignatureKey(existingEntry) === baseKey) {
          bySignature.delete(existingKey);
          changed = true;
        }
      }
      const existing = bySignature.get(key);
      const entry = sanitizeWorkoutExercise({ ...exercise, id: existing?.id ?? newId() });
      if (!existing || JSON.stringify(existing) !== JSON.stringify(entry)) {
        bySignature.set(key, entry);
        changed = true;
      }
    }
  }

  for (const log of logged) {
    for (const exercise of log.exercises) {
      const key = exerciseDefinitionSignatureKey(exercise);
      if (!bySignature.has(key)) {
        const entry = sanitizeWorkoutExercise({
          id: newId(),
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
        });
        bySignature.set(key, entry);
        changed = true;
      }
    }
  }

  return {
    entries: [...bySignature.values()].sort((a, b) => a.name.localeCompare(b.name)),
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
  return entries;
}

export async function upsertExerciseLibraryFromDefinitions(
  exercises: ReadonlyArray<ExerciseDefinitionMatch>,
): Promise<void> {
  if (exercises.length === 0) {
    return;
  }
  const catalog = await readExerciseLibraryRaw();
  const bySignature = new Map(catalog.map((entry) => [exerciseDefinitionSignatureKey(entry), entry]));
  let changed = false;
  for (const exercise of exercises) {
    const key = exerciseDefinitionSignatureKey(exercise);
    const baseKey = exerciseDefinitionBaseSignatureKey(exercise);
    for (const existingKey of [...bySignature.keys()]) {
      if (existingKey === key) {
        continue;
      }
      const existingEntry = bySignature.get(existingKey);
      if (existingEntry && exerciseDefinitionBaseSignatureKey(existingEntry) === baseKey) {
        bySignature.delete(existingKey);
        changed = true;
      }
    }
    const existing = bySignature.get(key);
    const entry = sanitizeWorkoutExercise({
      id: existing?.id ?? newId(),
      ...definitionFields(exercise),
    });
    if (!existing || JSON.stringify(existing) !== JSON.stringify(entry)) {
      bySignature.set(key, entry);
      changed = true;
    }
  }
  if (changed) {
    await writeExerciseLibrary(
      [...bySignature.values()].sort((a, b) => a.name.localeCompare(b.name)),
    );
  }
}

export async function replaceExerciseLibraryEntry(
  oldDef: ExerciseDefinitionMatch,
  nextDef: ExerciseDefinitionMatch,
): Promise<void> {
  const catalog = await readExerciseLibraryRaw();
  const oldKey = exerciseDefinitionSignatureKey(oldDef);
  const nextKey = exerciseDefinitionSignatureKey(nextDef);
  let changed = false;
  const next = catalog.flatMap((entry) => {
    if (!matchesExerciseDefinition(entry, oldDef)) {
      return [entry];
    }
    changed = true;
    if (oldKey === nextKey) {
      return [
        sanitizeWorkoutExercise({
          ...entry,
          ...definitionFields(nextDef),
        }),
      ];
    }
    return [];
  });
  if (oldKey !== nextKey && !next.some((entry) => exerciseDefinitionSignatureKey(entry) === nextKey)) {
    next.push(
      sanitizeWorkoutExercise({
        id: newId(),
        ...definitionFields(nextDef),
      }),
    );
    changed = true;
  }
  if (changed) {
    await writeExerciseLibrary(next.sort((a, b) => a.name.localeCompare(b.name)));
  }
}

export async function removeExerciseLibraryEntry(def: ExerciseDefinitionMatch): Promise<void> {
  const catalog = await readExerciseLibraryRaw();
  const next = catalog.filter((entry) => !matchesExerciseDefinition(entry, def));
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
