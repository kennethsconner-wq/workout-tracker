import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SyncEntityKind } from '@/lib/supabase/types';

const OFFLINE_CHANGES_KEY = 'sync-offline-changes@v1';

export type OfflineChange = {
  kind: SyncEntityKind;
  id: string;
};

function changeKey(kind: SyncEntityKind, id: string): string {
  return `${kind}:${id}`;
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
    return parsed.filter(
      (item): item is OfflineChange =>
        item != null &&
        typeof item === 'object' &&
        typeof (item as OfflineChange).id === 'string' &&
        typeof (item as OfflineChange).kind === 'string',
    );
  } catch {
    return [];
  }
}

export async function markOfflineChange(kind: SyncEntityKind, id: string): Promise<void> {
  const key = changeKey(kind, id);
  const existing = await loadOfflineChanges();
  if (existing.some((item) => changeKey(item.kind, item.id) === key)) {
    return;
  }
  await AsyncStorage.setItem(OFFLINE_CHANGES_KEY, JSON.stringify([...existing, { kind, id }]));
}

export async function markOfflineChanges(changes: OfflineChange[]): Promise<void> {
  if (changes.length === 0) {
    return;
  }
  const existing = await loadOfflineChanges();
  const seen = new Set(existing.map((item) => changeKey(item.kind, item.id)));
  const next = [...existing];
  for (const change of changes) {
    const key = changeKey(change.kind, change.id);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(change);
  }
  await AsyncStorage.setItem(OFFLINE_CHANGES_KEY, JSON.stringify(next));
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
