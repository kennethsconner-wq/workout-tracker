import type { SyncEntityKind } from '@/lib/supabase/types';

export type SyncStatus = {
  lastSyncedAt: string | null;
  isSyncing: boolean;
  lastError: string | null;
};

export type PendingSyncItem = {
  kind: SyncEntityKind;
  id: string;
  updatedAt: string;
};
