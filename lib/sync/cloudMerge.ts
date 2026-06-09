import type { ExerciseLibraryEntry } from '@/lib/exerciseLibraryStorage';
import { loadExerciseLibraryEntries, replaceExerciseLibraryEntries } from '@/lib/exerciseLibraryStorage';
import type {
  CloudExerciseLibraryRow,
  CloudLoggedWorkoutRow,
  CloudWorkoutRow,
} from '@/lib/supabase/types';
import type { LoggedWorkout, Workout } from '@/lib/types';
import { loadLoggedWorkouts, loadWorkouts, replaceLoggedWorkouts, replaceWorkouts } from '@/lib/workoutsStorage';

import { type EntityMeta, entityMetaKey } from '@/lib/sync/syncMetaStorage';

function parseTime(iso: string): number {
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : 0;
}

function shouldApplyRemote(localUpdatedAt: string, remoteUpdatedAt: string): boolean {
  return parseTime(remoteUpdatedAt) >= parseTime(localUpdatedAt);
}

export async function mergeWorkoutRows(
  rows: CloudWorkoutRow[],
  entities: Record<string, EntityMeta>,
): Promise<Record<string, EntityMeta>> {
  if (rows.length === 0) {
    return entities;
  }

  const local = await loadWorkouts();
  const byId = new Map(local.map((workout) => [workout.id, workout]));
  const nextEntities = { ...entities };

  for (const row of rows) {
    const key = entityMetaKey('workout', row.id);
    const localUpdatedAt = nextEntities[key]?.updatedAt ?? byId.get(row.id)?.createdAt ?? '';
    if (!shouldApplyRemote(localUpdatedAt, row.updated_at)) {
      continue;
    }

    if (row.deleted_at) {
      byId.delete(row.id);
    } else {
      byId.set(row.id, row.data);
    }
    nextEntities[key] = { updatedAt: row.updated_at };
  }

  await replaceWorkouts([...byId.values()]);
  return nextEntities;
}

export async function mergeLoggedWorkoutRows(
  rows: CloudLoggedWorkoutRow[],
  entities: Record<string, EntityMeta>,
): Promise<Record<string, EntityMeta>> {
  if (rows.length === 0) {
    return entities;
  }

  const local = await loadLoggedWorkouts();
  const byId = new Map(local.map((workout) => [workout.id, workout]));
  const nextEntities = { ...entities };

  for (const row of rows) {
    const key = entityMetaKey('logged_workout', row.id);
    const localUpdatedAt = nextEntities[key]?.updatedAt ?? byId.get(row.id)?.createdAt ?? '';
    if (!shouldApplyRemote(localUpdatedAt, row.updated_at)) {
      continue;
    }

    if (row.deleted_at) {
      byId.delete(row.id);
    } else {
      byId.set(row.id, row.data);
    }
    nextEntities[key] = { updatedAt: row.updated_at };
  }

  await replaceLoggedWorkouts([...byId.values()]);
  return nextEntities;
}

export async function mergeExerciseLibraryRows(
  rows: CloudExerciseLibraryRow[],
  entities: Record<string, EntityMeta>,
): Promise<Record<string, EntityMeta>> {
  if (rows.length === 0) {
    return entities;
  }

  const local = await loadExerciseLibraryEntries();
  const byId = new Map(local.map((entry) => [entry.id, entry]));
  const nextEntities = { ...entities };

  for (const row of rows) {
    const key = entityMetaKey('exercise_library', row.id);
    const localUpdatedAt = nextEntities[key]?.updatedAt ?? '';
    if (!shouldApplyRemote(localUpdatedAt, row.updated_at)) {
      continue;
    }

    if (row.deleted_at) {
      byId.delete(row.id);
    } else {
      byId.set(row.id, row.data);
    }
    nextEntities[key] = { updatedAt: row.updated_at };
  }

  await replaceExerciseLibraryEntries(
    [...byId.values()].sort((a, b) => a.name.localeCompare(b.name)),
  );
  return nextEntities;
}

export async function collectLocalWorkoutsForUpload(): Promise<Workout[]> {
  return loadWorkouts();
}

export async function collectLocalLoggedWorkoutsForUpload(): Promise<LoggedWorkout[]> {
  return loadLoggedWorkouts();
}

export async function collectLocalExerciseLibraryForUpload(): Promise<ExerciseLibraryEntry[]> {
  return loadExerciseLibraryEntries();
}
