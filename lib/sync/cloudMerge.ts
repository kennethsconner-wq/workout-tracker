import type { ExerciseLibraryEntry } from '@/lib/exerciseLibraryStorage';
import { loadExerciseLibraryEntries, replaceExerciseLibraryEntries } from '@/lib/exerciseLibraryStorage';
import { matchesExerciseDefinition } from '@/lib/exerciseSnapshot';
import type {
  CloudExerciseLibraryRow,
  CloudLoggedWorkoutRow,
  CloudWorkoutRow,
} from '@/lib/supabase/types';
import type { LoggedWorkout, Workout } from '@/lib/types';
import { loadLoggedWorkouts, loadWorkouts, replaceLoggedWorkouts, replaceWorkouts } from '@/lib/workoutsStorage';

import { isEditAtLeastAsNew, parseSyncTime } from '@/lib/sync/conflictResolver';
import type { MergeOverwrite } from '@/lib/sync/mergeOverwrites';
import { type EntityMeta, entityMetaKey } from '@/lib/sync/syncMetaStorage';
import type { SyncEntityKind } from '@/lib/supabase/types';

export type MergePullOptions = {
  /** Rows uploaded in the current sync pass — never toast for re-pulling our own writes. */
  excludeOverwriteKeys?: ReadonlySet<string>;
};

export type MergeRowsResult = {
  entities: Record<string, EntityMeta>;
  overwrites: MergeOverwrite[];
};

function overwriteEntityKey(kind: SyncEntityKind, id: string): string {
  return `${kind}:${id}`;
}

function shouldApplyRemote(localUpdatedAt: string, remoteUpdatedAt: string): boolean {
  return isEditAtLeastAsNew(remoteUpdatedAt, localUpdatedAt);
}

/** True only when cloud is strictly newer than the local edit we are replacing. */
function isCloudOverwriteOfLocal(localUpdatedAt: string, remoteUpdatedAt: string): boolean {
  return parseSyncTime(remoteUpdatedAt) > parseSyncTime(localUpdatedAt);
}

/** Cloud row primary key must match the persisted entity id inside `data` (sync tracks by row id). */
function alignCloudEntityDataId<T extends { id: string }>(rowId: string, data: T): T {
  if (data.id === rowId) {
    return data;
  }
  return { ...data, id: rowId };
}

function mergeEntityContentEqual(
  kind: SyncEntityKind,
  localEntity: Workout | LoggedWorkout | ExerciseLibraryEntry,
  remoteEntity: Workout | LoggedWorkout | ExerciseLibraryEntry,
): boolean {
  if (kind === 'exercise_library') {
    return matchesExerciseDefinition(
      localEntity as ExerciseLibraryEntry,
      remoteEntity as ExerciseLibraryEntry,
    );
  }

  return JSON.stringify(localEntity) === JSON.stringify(remoteEntity);
}

function recordOverwriteIfNeeded<T extends { id: string }>(
  overwrites: MergeOverwrite[],
  kind: SyncEntityKind,
  localEntity: T | undefined,
  row: { id: string; deleted_at: string | null; data: T; updated_at: string },
  localUpdatedAt: string,
  excludeOverwriteKeys: ReadonlySet<string> | undefined,
  getLabel: (entity: T) => string,
): void {
  if (!localEntity) {
    return;
  }

  if (excludeOverwriteKeys?.has(overwriteEntityKey(kind, row.id))) {
    return;
  }

  if (!isCloudOverwriteOfLocal(localUpdatedAt, row.updated_at)) {
    return;
  }

  if (row.deleted_at) {
    overwrites.push({
      kind,
      id: row.id,
      label: getLabel(localEntity),
      wasDeleted: true,
    });
    return;
  }

  const remoteEntity = alignCloudEntityDataId(row.id, row.data);
  if (!mergeEntityContentEqual(kind, localEntity, remoteEntity)) {
    overwrites.push({
      kind,
      id: row.id,
      label: getLabel(remoteEntity),
      wasDeleted: false,
    });
  }
}

export async function mergeWorkoutRows(
  rows: CloudWorkoutRow[],
  entities: Record<string, EntityMeta>,
  options?: MergePullOptions,
): Promise<MergeRowsResult> {
  if (rows.length === 0) {
    return { entities, overwrites: [] };
  }

  const local = await loadWorkouts();
  const byId = new Map(local.map((workout) => [workout.id, workout]));
  const nextEntities = { ...entities };
  const overwrites: MergeOverwrite[] = [];

  for (const row of rows) {
    const key = entityMetaKey('workout', row.id);
    const localWorkout = byId.get(row.id);
    const localUpdatedAt = nextEntities[key]?.updatedAt ?? localWorkout?.createdAt ?? '';
    if (!shouldApplyRemote(localUpdatedAt, row.updated_at)) {
      continue;
    }

    recordOverwriteIfNeeded(
      overwrites,
      'workout',
      localWorkout,
      row,
      localUpdatedAt,
      options?.excludeOverwriteKeys,
      (workout) => workout.title,
    );

    if (row.deleted_at) {
      byId.delete(row.id);
    } else {
      byId.set(row.id, alignCloudEntityDataId(row.id, row.data));
    }
    nextEntities[key] = { updatedAt: row.updated_at };
  }

  await replaceWorkouts([...byId.values()]);
  return { entities: nextEntities, overwrites };
}

export async function mergeLoggedWorkoutRows(
  rows: CloudLoggedWorkoutRow[],
  entities: Record<string, EntityMeta>,
  options?: MergePullOptions,
): Promise<MergeRowsResult> {
  if (rows.length === 0) {
    return { entities, overwrites: [] };
  }

  const local = await loadLoggedWorkouts();
  const byId = new Map(local.map((workout) => [workout.id, workout]));
  const nextEntities = { ...entities };
  const overwrites: MergeOverwrite[] = [];

  for (const row of rows) {
    const key = entityMetaKey('logged_workout', row.id);
    const localWorkout = byId.get(row.id);
    const localUpdatedAt = nextEntities[key]?.updatedAt ?? localWorkout?.createdAt ?? '';
    if (!shouldApplyRemote(localUpdatedAt, row.updated_at)) {
      continue;
    }

    recordOverwriteIfNeeded(
      overwrites,
      'logged_workout',
      localWorkout,
      row,
      localUpdatedAt,
      options?.excludeOverwriteKeys,
      (workout) => workout.title,
    );

    if (row.deleted_at) {
      byId.delete(row.id);
    } else {
      byId.set(row.id, alignCloudEntityDataId(row.id, row.data));
    }
    nextEntities[key] = { updatedAt: row.updated_at };
  }

  await replaceLoggedWorkouts([...byId.values()]);
  return { entities: nextEntities, overwrites };
}

export async function mergeExerciseLibraryRows(
  rows: CloudExerciseLibraryRow[],
  entities: Record<string, EntityMeta>,
  options?: MergePullOptions,
): Promise<MergeRowsResult> {
  if (rows.length === 0) {
    return { entities, overwrites: [] };
  }

  const local = await loadExerciseLibraryEntries();
  const byId = new Map(local.map((entry) => [entry.id, entry]));
  const nextEntities = { ...entities };
  const overwrites: MergeOverwrite[] = [];

  for (const row of rows) {
    const key = entityMetaKey('exercise_library', row.id);
    const localEntry = byId.get(row.id);
    const localUpdatedAt = nextEntities[key]?.updatedAt ?? '';
    if (!shouldApplyRemote(localUpdatedAt, row.updated_at)) {
      continue;
    }

    recordOverwriteIfNeeded(
      overwrites,
      'exercise_library',
      localEntry,
      row,
      localUpdatedAt,
      options?.excludeOverwriteKeys,
      (entry) => entry.name,
    );

    if (row.deleted_at) {
      byId.delete(row.id);
    } else {
      byId.set(row.id, alignCloudEntityDataId(row.id, row.data));
    }
    nextEntities[key] = { updatedAt: row.updated_at };
  }

  await replaceExerciseLibraryEntries(
    [...byId.values()].sort((a, b) => a.name.localeCompare(b.name)),
  );
  return { entities: nextEntities, overwrites };
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
