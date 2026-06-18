import {
  collectLocalLoggedWorkoutsForUpload,
  collectLocalWorkoutsForUpload,
  mergeExerciseLibraryRows,
  mergeLoggedWorkoutRows,
  mergeWorkoutRows,
} from '@/lib/sync/cloudMerge';
import {
  entityMetaKey,
  isInitialSyncDone,
  loadSyncMeta,
  markInitialSyncDone,
  saveSyncMeta,
  setEntityUpdatedAt,
} from '@/lib/sync/syncMetaStorage';
import type { PendingSyncItem } from '@/lib/sync/types';
import type {
  CloudExerciseLibraryRow,
  CloudLoggedWorkoutRow,
  CloudWorkoutRow,
  SyncEntityKind,
} from '@/lib/supabase/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { ExerciseLibraryEntry } from '@/lib/exerciseLibraryStorage';
import { loadExerciseLibraryCatalog, loadExerciseLibraryEntries } from '@/lib/exerciseLibraryStorage';
import { loadOfflineChanges } from '@/lib/sync/offlineChangeStorage';
import { findLoggedWorkoutById, findWorkoutById, loadLoggedWorkouts, loadWorkouts } from '@/lib/workoutsStorage';
import type { LoggedWorkout, Workout } from '@/lib/types';

const TABLE_BY_KIND: Record<SyncEntityKind, string> = {
  workout: 'workouts',
  logged_workout: 'logged_workouts',
  exercise_library: 'exercise_library',
};

export async function getCurrentUserId(): Promise<string | null> {
  return resolveSyncUserId();
}

/** Prefer session JWT (needed for RLS) over a bare getUser() call. */
export async function resolveSyncUserId(explicitUserId?: string): Promise<string | null> {
  if (explicitUserId) {
    return explicitUserId;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user?.id) {
    return session.user.id;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function formatSyncError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    const code = 'code' in error && typeof error.code === 'string' ? ` (${error.code})` : '';
    return `${error.message}${code}`;
  }
  return 'Sync failed.';
}

function syncTimestamp(): string {
  return new Date().toISOString();
}

function parseTime(iso: string): number {
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : 0;
}

type CloudRow = {
  id: string;
  updated_at: string;
  deleted_at: string | null;
};

/** Incremental changes plus cloud rows this device has never downloaded. */
function selectRowsForPull<T extends CloudRow>(rows: T[], since: string | null, localIds: Set<string>): T[] {
  if (!since) {
    return rows;
  }

  const sinceTime = parseTime(since);
  const selected = new Map<string, T>();

  for (const row of rows) {
    const isNewerThanLastSync = parseTime(row.updated_at) > sinceTime;
    const isMissingLocally = !row.deleted_at && !localIds.has(row.id);
    if (isNewerThanLastSync || isMissingLocally) {
      selected.set(row.id, row);
    }
  }

  return [...selected.values()];
}

async function upsertRow(
  kind: SyncEntityKind,
  userId: string,
  id: string,
  data: Workout | LoggedWorkout | ExerciseLibraryEntry,
  updatedAt: string,
  deletedAt: string | null,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase.from(TABLE_BY_KIND[kind]).upsert(
    {
      id,
      user_id: userId,
      updated_at: updatedAt,
      deleted_at: deletedAt,
      data,
    },
    { onConflict: 'id,user_id' },
  );

  if (error) {
    throw new Error(formatSyncError(error));
  }
}

async function softDeleteRow(kind: SyncEntityKind, userId: string, id: string, updatedAt: string): Promise<void> {
  await upsertRow(kind, userId, id, { id } as Workout, updatedAt, updatedAt);
}

async function uploadWorkout(userId: string, id: string, updatedAt: string): Promise<void> {
  const workout = findWorkoutById(await loadWorkouts(), id);
  if (workout) {
    await upsertRow('workout', userId, id, workout, updatedAt, null);
    return;
  }
  await softDeleteRow('workout', userId, id, updatedAt);
}

async function uploadLoggedWorkout(userId: string, id: string, updatedAt: string): Promise<void> {
  const workout = findLoggedWorkoutById(await loadLoggedWorkouts(), id);
  if (workout) {
    await upsertRow('logged_workout', userId, id, workout, updatedAt, null);
    return;
  }
  await softDeleteRow('logged_workout', userId, id, updatedAt);
}

async function uploadExerciseLibraryEntry(userId: string, id: string, updatedAt: string): Promise<void> {
  const entry = (await loadExerciseLibraryEntries()).find((item) => item.id === id);
  if (entry) {
    await upsertRow('exercise_library', userId, id, entry, updatedAt, null);
    return;
  }
  await softDeleteRow('exercise_library', userId, id, updatedAt);
}

async function uploadPendingItem(userId: string, item: PendingSyncItem): Promise<void> {
  const updatedAt = syncTimestamp();

  switch (item.kind) {
    case 'workout':
      await uploadWorkout(userId, item.id, updatedAt);
      break;
    case 'logged_workout':
      await uploadLoggedWorkout(userId, item.id, updatedAt);
      break;
    case 'exercise_library':
      await uploadExerciseLibraryEntry(userId, item.id, updatedAt);
      break;
  }
  await setEntityUpdatedAt(userId, item.kind, item.id, updatedAt);
}

async function fetchRows<T>(table: string, userId: string, since: string | null): Promise<T[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  let query = supabase.from(table).select('*').eq('user_id', userId);
  if (since) {
    query = query.gt('updated_at', since);
  }

  const { data, error } = await query.order('updated_at', { ascending: true });
  if (error) {
    throw new Error(formatSyncError(error));
  }

  return (data ?? []) as T[];
}

export async function pullRemoteChanges(userId: string, since: string | null): Promise<void> {
  const [allWorkouts, allLogged, allLibrary, localWorkouts, localLogged, localLibrary] = await Promise.all([
    fetchRows<CloudWorkoutRow>('workouts', userId, null),
    fetchRows<CloudLoggedWorkoutRow>('logged_workouts', userId, null),
    fetchRows<CloudExerciseLibraryRow>('exercise_library', userId, null),
    loadWorkouts(),
    loadLoggedWorkouts(),
    loadExerciseLibraryEntries(),
  ]);

  const workoutRows = selectRowsForPull(
    allWorkouts,
    since,
    new Set(localWorkouts.map((workout) => workout.id)),
  );
  const loggedRows = selectRowsForPull(
    allLogged,
    since,
    new Set(localLogged.map((workout) => workout.id)),
  );
  const libraryRows = selectRowsForPull(
    allLibrary,
    since,
    new Set(localLibrary.map((entry) => entry.id)),
  );

  const meta = await loadSyncMeta(userId);
  let entities = meta.entities;
  entities = await mergeWorkoutRows(workoutRows, entities);
  entities = await mergeLoggedWorkoutRows(loggedRows, entities);
  entities = await mergeExerciseLibraryRows(libraryRows, entities);

  await saveSyncMeta(userId, {
    lastSyncedAt: meta.lastSyncedAt,
    entities,
  });
}

export async function countCloudEntities(userId: string): Promise<number> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return 0;
  }

  const tables = ['workouts', 'logged_workouts', 'exercise_library'] as const;
  let total = 0;

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      throw new Error(formatSyncError(error));
    }
    total += count ?? 0;
  }

  return total;
}

export async function uploadAllLocal(userId: string): Promise<void> {
  const now = syncTimestamp();
  const [workouts, loggedWorkouts, libraryEntries] = await Promise.all([
    collectLocalWorkoutsForUpload(),
    collectLocalLoggedWorkoutsForUpload(),
    loadMergedExerciseLibraryCatalog(),
  ]);

  for (const workout of workouts) {
    await upsertRow('workout', userId, workout.id, workout, now, null);
    await setEntityUpdatedAt(userId, 'workout', workout.id, now);
  }

  for (const workout of loggedWorkouts) {
    await upsertRow('logged_workout', userId, workout.id, workout, now, null);
    await setEntityUpdatedAt(userId, 'logged_workout', workout.id, now);
  }

  for (const entry of libraryEntries) {
    await upsertRow('exercise_library', userId, entry.id, entry, now, null);
    await setEntityUpdatedAt(userId, 'exercise_library', entry.id, now);
  }
}

async function loadMergedExerciseLibraryCatalog(): Promise<ExerciseLibraryEntry[]> {
  const workouts = await loadWorkouts();
  const logged = await loadLoggedWorkouts();
  return loadExerciseLibraryCatalog(workouts, logged);
}

async function localHasPersistedData(): Promise<boolean> {
  const [workouts, logged, library] = await Promise.all([
    loadWorkouts(),
    loadLoggedWorkouts(),
    loadMergedExerciseLibraryCatalog(),
  ]);
  return workouts.length > 0 || logged.length > 0 || library.length > 0;
}

/** Queue local rows changed while signed out (already in sync meta but edited offline). */
export async function enqueueOfflineLocalChanges(): Promise<PendingSyncItem[]> {
  const offlineChanges = await loadOfflineChanges();
  if (offlineChanges.length === 0) {
    return [];
  }

  const now = syncTimestamp();
  return offlineChanges.map((change) => ({
    kind: change.kind,
    id: change.id,
    updatedAt: now,
  }));
}

/** Queue local rows that have never been uploaded for this signed-in user. */
export async function enqueueLocalChangesMissingFromSyncMeta(userId: string): Promise<PendingSyncItem[]> {
  const meta = await loadSyncMeta(userId);
  const now = syncTimestamp();
  const workouts = await loadWorkouts();
  const logged = await loadLoggedWorkouts();
  const libraryEntries = await loadMergedExerciseLibraryCatalog();
  const items: PendingSyncItem[] = [];

  for (const workout of workouts) {
    const key = entityMetaKey('workout', workout.id);
    if (!meta.entities[key]) {
      items.push({
        kind: 'workout',
        id: workout.id,
        updatedAt: now,
      });
    }
  }

  for (const log of logged) {
    const key = entityMetaKey('logged_workout', log.id);
    if (!meta.entities[key]) {
      items.push({
        kind: 'logged_workout',
        id: log.id,
        updatedAt: now,
      });
    }
  }

  const seenLibraryIds = new Set<string>();
  for (const entry of libraryEntries) {
    if (seenLibraryIds.has(entry.id)) {
      continue;
    }
    seenLibraryIds.add(entry.id);
    const key = entityMetaKey('exercise_library', entry.id);
    if (!meta.entities[key]) {
      items.push({
        kind: 'exercise_library',
        id: entry.id,
        updatedAt: now,
      });
    }
  }

  return items;
}

export async function pushPendingChanges(userId: string, pending: PendingSyncItem[]): Promise<void> {
  for (const item of pending) {
    await uploadPendingItem(userId, item);
  }
}

export async function ensureLocalDataUploadedIfCloudEmpty(userId: string): Promise<boolean> {
  const cloudCount = await countCloudEntities(userId);
  const localHasData = await localHasPersistedData();
  if (cloudCount === 0 && localHasData) {
    await uploadAllLocal(userId);
    return true;
  }

  return false;
}

export async function runDeviceInitialSync(userId: string): Promise<void> {
  const [cloudCount, localHasData] = await Promise.all([
    countCloudEntities(userId),
    localHasPersistedData(),
  ]);

  if (cloudCount === 0 && localHasData) {
    await uploadAllLocal(userId);
    await markInitialSyncDone(userId);
    return;
  }

  if (await isInitialSyncDone(userId)) {
    return;
  }

  if (cloudCount > 0) {
    await pullRemoteChanges(userId, null);
  }

  await markInitialSyncDone(userId);
}

export async function enqueueAllLocalChanges(userId: string, updatedAt: string): Promise<PendingSyncItem[]> {
  const [workouts, loggedWorkouts, libraryEntries] = await Promise.all([
    loadWorkouts(),
    loadLoggedWorkouts(),
    loadMergedExerciseLibraryCatalog(),
  ]);

  const items: PendingSyncItem[] = [
    ...workouts.map((workout) => ({ kind: 'workout' as const, id: workout.id, updatedAt })),
    ...loggedWorkouts.map((workout) => ({
      kind: 'logged_workout' as const,
      id: workout.id,
      updatedAt,
    })),
    ...libraryEntries.map((entry) => ({
      kind: 'exercise_library' as const,
      id: entry.id,
      updatedAt,
    })),
  ];

  for (const item of items) {
    await setEntityUpdatedAt(userId, item.kind, item.id, item.updatedAt);
  }

  return items;
}

export { entityMetaKey };
