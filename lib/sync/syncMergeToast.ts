type ShowSyncMergeToast = (message: string) => void;

let showSyncMergeToastImpl: ShowSyncMergeToast | null = null;

export function registerSyncMergeToast(show: ShowSyncMergeToast | null): void {
  showSyncMergeToastImpl = show;
}

export function showSyncMergeToast(message: string): void {
  if (!showSyncMergeToastImpl) {
    if (__DEV__) {
      console.warn('[syncMergeToast] SyncMergeToastProvider is not mounted.');
    }
    return;
  }
  showSyncMergeToastImpl(message);
}
