import AsyncStorage from '@react-native-async-storage/async-storage';

import { resolveEditTimestamp } from '@/lib/sync/conflictResolver';
import type { SyncEntityKind } from '@/lib/supabase/types';

const OFFLINE_CHANGES_KEY = 'sync-offline-changes@v1';

export type OfflineChange = {
  kind: SyncEntityKind;
  id: string;
  updatedAt?: string;
};

function changeKey(kind: SyncEntityKind, id: string): string {
  return `${kind}:${id}`;
}

function laterUpdatedAt(left: string | undefined, right: string | undefined): string {
  const leftTime = left ? Date.parse(left) : Number.NaN;
  const rightTime = right ? Date.parse(right) : Number.NaN;
  const leftValid = Number.isFinite(leftTime);
  const rightValid = Number.isFinite(rightTime);

  if (leftValid && rightValid) {
    return leftTime >= rightTime ? resolveEditTimestamp(left) : resolveEditTimestamp(right);
  }
  if (leftValid) {
    return resolveEditTimestamp(left);
  }
  if (rightValid) {
    return resolveEditTimestamp(right);
  }
  return resolveEditTimestamp(undefined);
}

function upsertOfflineChange(existing: OfflineChange[], change: OfflineChange): OfflineChange[] {
  const key = changeKey(change.kind, change.id);
  const index = existing.findIndex((item) => changeKey(item.kind, item.id) === key);
  const updatedAt = resolveEditTimestamp(change.updatedAt);

  if (index >= 0) {
    const next = [...existing];
    next[index] = {
      kind: change.kind,
      id: change.id,
      updatedAt: laterUpdatedAt(existing[index].updatedAt, updatedAt),
    };
    return next;
  }

  return [...existing, { kind: change.kind, id: change.id, updatedAt }];
}

function normalizeOfflineChange(item: unknown): OfflineChange | null {
  if (item == null || typeof item !== 'object') {
    return null;
  }
  const record = item as Partial<OfflineChange>;
  if (typeof record.id !== 'string' || typeof record.kind !== 'string') {
    return null;
  }
  return {
    kind: record.kind,
    id: record.id,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  };
}

export async function loadOfflineChanges(): Promise<OfflineChange[]> {
  const raw = await AsyncStorage.getItem(OFFLINE_CHANGES_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => normalizeOfflineChange(item))
      .filter((item): item is OfflineChange => item != null);
  } catch {
    return [];
  }
}

export async function markOfflineChange(
  kind: SyncEntityKind,
  id: string,
  updatedAt: string = resolveEditTimestamp(undefined),
): Promise<void> {
  const existing = await loadOfflineChanges();
  const next = upsertOfflineChange(existing, { kind, id, updatedAt });
  await AsyncStorage.setItem(OFFLINE_CHANGES_KEY, JSON.stringify(next));
}

export async function markOfflineChanges(changes: OfflineChange[]): Promise<void> {
  if (changes.length === 0) {
    return;
  }

  let next = await loadOfflineChanges();
  for (const change of changes) {
    next = upsertOfflineChange(next, change);
  }
  await AsyncStorage.setItem(OFFLINE_CHANGES_KEY, JSON.stringify(next));
}

export async function clearAllOfflineChanges(): Promise<void> {
  await AsyncStorage.removeItem(OFFLINE_CHANGES_KEY);
}

export async function clearOfflineChanges(changes: OfflineChange[]): Promise<void> {
  if (changes.length === 0) {
    return;
  }
  const removeKeys = new Set(changes.map((item) => changeKey(item.kind, item.id)));
  const existing = await loadOfflineChanges();
  const next = existing.filter((item) => !removeKeys.has(changeKey(item.kind, item.id)));
  if (next.length === 0) {
    await AsyncStorage.removeItem(OFFLINE_CHANGES_KEY);
    return;
  }
  await AsyncStorage.setItem(OFFLINE_CHANGES_KEY, JSON.stringify(next));
}
