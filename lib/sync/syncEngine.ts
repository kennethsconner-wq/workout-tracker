import {
  ensureLocalDataUploadedIfCloudEmpty,
  enqueueLocalChangesMissingFromSyncMeta,
  enqueueOfflineLocalChanges,
  getCurrentUserId,
  pullRemoteChanges,
  pushPendingChanges,
  resolveSyncUserId,
  runDeviceInitialSync,
} from '@/lib/sync/cloudSync';
import { isEditAtLeastAsNew } from '@/lib/sync/conflictResolver';
import { isOfflineSyncError } from '@/lib/sync/isOfflineSyncError';
import { clearOfflineChanges, loadOfflineChanges, markOfflineChanges } from '@/lib/sync/offlineChangeStorage';
import { notifyMergeOverwrites, type MergeOverwrite } from '@/lib/sync/mergeOverwrites';
import { loadSyncMeta, saveSyncMeta } from '@/lib/sync/syncMetaStorage';
import type { PendingSyncItem, SyncStatus } from '@/lib/sync/types';

const OFFLINE_SYNC_MESSAGE = 'Offline — connect to the internet to sync.';

type SyncOptions = {
  userInitiated?: boolean;
  /** Re-evaluate all cloud rows — used on sign-in to catch local overwrites. */
  fullPull?: boolean;
};

function handleSyncFailure(error: unknown, options?: SyncOptions): void {
  if (isOfflineSyncError(error)) {
    if (options?.userInitiated) {
      setStatus({ lastError: OFFLINE_SYNC_MESSAGE });
    }
    return;
  }

  const message = error instanceof Error ? error.message : 'Sync failed.';
  setStatus({ lastError: message });
}

function restorePendingBatch(batch: PendingSyncItem[]): void {
  for (const item of batch) {
    dedupePending(item);
  }
}

function persistUnsyncedBatch(batch: PendingSyncItem[]): void {
  void markOfflineChanges(
    batch.map((item) => ({
      kind: item.kind,
      id: item.id,
      updatedAt: item.updatedAt,
    })),
  );
}

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
let syncRequestedWhileBusy = false;

async function runInitialSyncInternal(userId: string): Promise<void> {
  setStatus({ isSyncing: true, lastError: null });
  try {
    const initialOverwrites = await runDeviceInitialSync(userId);
    const syncOverwrites = await performSync(userId, { fullPull: true });
    notifyMergeOverwrites([...initialOverwrites, ...syncOverwrites]);
  } catch (error) {
    handleSyncFailure(error);
    if (!isOfflineSyncError(error)) {
      throw error;
    }
  } finally {
    setStatus({ isSyncing: false });
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
    const existing = pendingChanges[existingIndex];
    pendingChanges[existingIndex] = isEditAtLeastAsNew(change.updatedAt, existing.updatedAt)
      ? change
      : existing;
    return;
  }
  pendingChanges.push(change);
}

async function refreshLastSyncedFromStorage(userId: string): Promise<void> {
  const meta = await loadSyncMeta(userId);
  setStatus({ lastSyncedAt: meta.lastSyncedAt });
}

async function performSync(userId: string, options?: SyncOptions): Promise<MergeOverwrite[]> {
  if (syncInProgress) {
    syncRequestedWhileBusy = true;
    return [];
  }

  syncInProgress = true;
  setStatus({ isSyncing: true, lastError: null });

  let pushCompleted = false;
  let batch: PendingSyncItem[] = [];
  let overwrites: MergeOverwrite[] = [];

  try {
    const [missing, offline] = await Promise.all([
      enqueueLocalChangesMissingFromSyncMeta(userId),
      enqueueOfflineLocalChanges(),
    ]);
    for (const item of [...missing, ...offline]) {
      dedupePending(item);
    }

    batch = pendingChanges.splice(0, pendingChanges.length);
    const offlineBeforePush = await loadOfflineChanges();
    if (batch.length > 0) {
      await pushPendingChanges(userId, batch);
      const uploadedOffline = offlineBeforePush.filter((change) =>
        batch.some((item) => item.kind === change.kind && item.id === change.id),
      );
      await clearOfflineChanges(uploadedOffline);
      pushCompleted = true;
    }

    await ensureLocalDataUploadedIfCloudEmpty(userId);

    const meta = await loadSyncMeta(userId);
    const pushedThisSync = new Set(batch.map((item) => `${item.kind}:${item.id}`));
    const pullSince = options?.fullPull ? null : meta.lastSyncedAt;
    overwrites = await pullRemoteChanges(userId, pullSince, {
      excludeOverwriteKeys: pushedThisSync,
    });

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
    return overwrites;
  } catch (error) {
    if (!pushCompleted && batch.length > 0) {
      restorePendingBatch(batch);
      persistUnsyncedBatch(batch);
    }
    handleSyncFailure(error, options);
    if (!isOfflineSyncError(error)) {
      throw error;
    }
    return [];
  } finally {
    syncInProgress = false;
    setStatus({ isSyncing: false });
    if (syncRequestedWhileBusy) {
      syncRequestedWhileBusy = false;
      void performSync(userId, options).then((queuedOverwrites) => {
        notifyMergeOverwrites(queuedOverwrites);
      });
    }
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
    const overwrites = await performSync(userId, { userInitiated: true });
    notifyMergeOverwrites(overwrites);
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
