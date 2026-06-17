import {
  ensureLocalDataUploadedIfCloudEmpty,
  enqueueLocalChangesMissingFromSyncMeta,
  getCurrentUserId,
  pullRemoteChanges,
  pushPendingChanges,
  resolveSyncUserId,
  runDeviceInitialSync,
} from '@/lib/sync/cloudSync';
import { loadSyncMeta, saveSyncMeta } from '@/lib/sync/syncMetaStorage';
import type { PendingSyncItem, SyncStatus } from '@/lib/sync/types';

const initialStatus: SyncStatus = {
  lastSyncedAt: null,
  isSyncing: false,
  lastError: null,
};

let status: SyncStatus = { ...initialStatus };
const pendingChanges: PendingSyncItem[] = [];
const listeners = new Set<() => void>();
let syncInProgress = false;
let activeInitialSync: Promise<void> | null = null;

async function runInitialSyncInternal(userId: string): Promise<void> {
  setStatus({ isSyncing: true, lastError: null });
  try {
    await runDeviceInitialSync(userId);
    await performSync(userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Initial sync failed.';
    setStatus({ lastError: message });
    throw error;
  } finally {
    await refreshLastSyncedFromStorage(userId);
  }
}

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

function setStatus(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch };
  notifyListeners();
}

function dedupePending(change: PendingSyncItem): void {
  const existingIndex = pendingChanges.findIndex(
    (item) => item.kind === change.kind && item.id === change.id,
  );
  if (existingIndex >= 0) {
    pendingChanges[existingIndex] = change;
    return;
  }
  pendingChanges.push(change);
}

async function refreshLastSyncedFromStorage(userId: string): Promise<void> {
  const meta = await loadSyncMeta(userId);
  setStatus({ lastSyncedAt: meta.lastSyncedAt });
}

async function performSync(userId: string): Promise<void> {
  if (syncInProgress) {
    return;
  }

  syncInProgress = true;
  setStatus({ isSyncing: true, lastError: null });

  try {
    const missing = await enqueueLocalChangesMissingFromSyncMeta(userId);
    for (const item of missing) {
      dedupePending(item);
    }

    const batch = pendingChanges.splice(0, pendingChanges.length);
    if (batch.length > 0) {
      await pushPendingChanges(userId, batch);
    }

    await ensureLocalDataUploadedIfCloudEmpty(userId);

    const meta = await loadSyncMeta(userId);
    await pullRemoteChanges(userId, meta.lastSyncedAt);

    const syncedAt = new Date().toISOString();
    const nextMeta = await loadSyncMeta(userId);
    await saveSyncMeta(userId, {
      ...nextMeta,
      lastSyncedAt: syncedAt,
    });

    setStatus({
      lastSyncedAt: syncedAt,
      lastError: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed.';
    setStatus({ lastError: message });
    throw error;
  } finally {
    syncInProgress = false;
    setStatus({ isSyncing: false });
  }
}

export const syncEngine = {
  getStatus(): SyncStatus {
    return status;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  enqueueChange(change: PendingSyncItem): void {
    dedupePending(change);
  },

  enqueueAllLocal(updatedAt: string): void {
    void getCurrentUserId().then(async (userId) => {
      if (!userId) {
        return;
      }
      const { enqueueAllLocalChanges } = await import('@/lib/sync/cloudSync');
      const items = await enqueueAllLocalChanges(userId, updatedAt);
      for (const item of items) {
        dedupePending(item);
      }
    });
  },

  async syncNow(explicitUserId?: string): Promise<void> {
    const userId = await resolveSyncUserId(explicitUserId);
    if (!userId) {
      setStatus({ lastError: 'Could not sync: sign in and try again.' });
      return;
    }
    await performSync(userId);
  },

  async runInitialSync(explicitUserId?: string): Promise<void> {
    if (activeInitialSync) {
      return activeInitialSync;
    }

    const userId = await resolveSyncUserId(explicitUserId);
    if (!userId) {
      setStatus({ lastError: 'Could not sync: sign in and try again.' });
      return;
    }

    activeInitialSync = runInitialSyncInternal(userId);
    try {
      await activeInitialSync;
    } finally {
      activeInitialSync = null;
    }
  },

  async hydrateStatus(): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) {
      setStatus({ ...initialStatus });
      return;
    }
    await refreshLastSyncedFromStorage(userId);
  },

  reset(): void {
    status = { ...initialStatus };
    pendingChanges.length = 0;
    notifyListeners();
  },
};
