import { useEffect, useState } from 'react';

import { syncEngine } from '@/lib/sync/syncEngine';
import type { SyncStatus } from '@/lib/sync/types';

export function useSyncStatus(): SyncStatus {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => syncEngine.getStatus());

  useEffect(() => {
    return syncEngine.subscribe(() => {
      setSyncStatus(syncEngine.getStatus());
    });
  }, []);

  return syncStatus;
}
