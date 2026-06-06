import type { SyncStatus, PendingSyncItem } from '@/lib/sync/types';

const initialStatus: SyncStatus = {
  lastSyncedAt: null,
  isSyncing: false,
  lastError: null,
};

let status: SyncStatus = { ...initialStatus };
const pendingChanges: PendingSyncItem[] = [];

/**
 * Cloud sync engine stub (Phase 0).
 * Phase 3 will implement upload/download against Supabase tables.
 */
export const syncEngine = {
  getStatus(): SyncStatus {
    return status;
  },

  enqueueChange(change: PendingSyncItem): void {
    const existingIndex = pendingChanges.findIndex(
      (item) => item.kind === change.kind && item.id === change.id,
    );
    if (existingIndex >= 0) {
      pendingChanges[existingIndex] = change;
      return;
    }
    pendingChanges.push(change);
  },

  async syncNow(): Promise<void> {
    if (pendingChanges.length === 0) {
      return;
    }
    // No-op until Phase 3 wires Supabase upserts/pulls.
  },

  async runInitialUpload(): Promise<void> {
    // No-op until Phase 3.
  },

  reset(): void {
    status = { ...initialStatus };
    pendingChanges.length = 0;
  },
};
