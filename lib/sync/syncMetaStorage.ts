import AsyncStorage from '@react-native-async-storage/async-storage';

const META_KEY_PREFIX = 'sync-meta@v1:';
const INITIAL_SYNC_KEY_PREFIX = 'sync-initial-done@v1:';

export type EntityMeta = {
  updatedAt: string;
};

export type SyncMeta = {
  lastSyncedAt: string | null;
  entities: Record<string, EntityMeta>;
};

function metaKey(userId: string): string {
  return `${META_KEY_PREFIX}${userId}`;
}

function initialSyncKey(userId: string): string {
  return `${INITIAL_SYNC_KEY_PREFIX}${userId}`;
}

export function entityMetaKey(kind: string, id: string): string {
  return `${kind}:${id}`;
}

export async function loadSyncMeta(userId: string): Promise<SyncMeta> {
  const raw = await AsyncStorage.getItem(metaKey(userId));
  if (!raw) {
    return { lastSyncedAt: null, entities: {} };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SyncMeta>;
    return {
      lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : null,
      entities: parsed.entities && typeof parsed.entities === 'object' ? parsed.entities : {},
    };
  } catch {
    return { lastSyncedAt: null, entities: {} };
  }
}

export async function saveSyncMeta(userId: string, meta: SyncMeta): Promise<void> {
  await AsyncStorage.setItem(metaKey(userId), JSON.stringify(meta));
}

export async function getEntityUpdatedAt(
  userId: string,
  kind: string,
  id: string,
  fallbackCreatedAt?: string,
): Promise<string> {
  const meta = await loadSyncMeta(userId);
  const key = entityMetaKey(kind, id);
  return meta.entities[key]?.updatedAt ?? fallbackCreatedAt ?? '';
}

export async function setEntityUpdatedAt(
  userId: string,
  kind: string,
  id: string,
  updatedAt: string,
): Promise<void> {
  const meta = await loadSyncMeta(userId);
  meta.entities[entityMetaKey(kind, id)] = { updatedAt };
  await saveSyncMeta(userId, meta);
}

export async function isInitialSyncDone(userId: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(initialSyncKey(userId));
  return value === '1';
}

export async function markInitialSyncDone(userId: string): Promise<void> {
  await AsyncStorage.setItem(initialSyncKey(userId), '1');
}

export async function clearSyncMetaForUser(userId: string): Promise<void> {
  await AsyncStorage.multiRemove([metaKey(userId), initialSyncKey(userId)]);
}
