import type { SyncEntityKind } from '@/lib/supabase/types';

import { showSyncMergeToast } from '@/lib/sync/syncMergeToast';

export type MergeOverwrite = {
  kind: SyncEntityKind;
  id: string;
  label: string;
  wasDeleted: boolean;
};

export function dedupeMergeOverwrites(overwrites: MergeOverwrite[]): MergeOverwrite[] {
  const byKey = new Map<string, MergeOverwrite>();
  for (const overwrite of overwrites) {
    byKey.set(`${overwrite.kind}:${overwrite.id}`, overwrite);
  }
  return [...byKey.values()];
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function formatMergeOverwriteMessage(overwrites: MergeOverwrite[]): string | null {
  if (overwrites.length === 0) {
    return null;
  }

  const updateCount = overwrites.filter((item) => !item.wasDeleted).length;
  const deleteCount = overwrites.filter((item) => item.wasDeleted).length;

  if (updateCount > 0 && deleteCount === 0) {
    return `${updateCount} ${pluralize(updateCount, 'item was', 'items were')} updated from the cloud.`;
  }

  if (deleteCount > 0 && updateCount === 0) {
    return `${deleteCount} ${pluralize(deleteCount, 'item was', 'items were')} removed on another device.`;
  }

  const total = overwrites.length;
  return `${total} ${pluralize(total, 'item was', 'items were')} changed from the cloud.`;
}

export function notifyMergeOverwrites(overwrites: MergeOverwrite[]): void {
  const message = formatMergeOverwriteMessage(dedupeMergeOverwrites(overwrites));
  if (message) {
    showSyncMergeToast(message);
  }
}
