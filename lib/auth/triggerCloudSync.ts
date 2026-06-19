import { syncEngine } from '@/lib/sync/syncEngine';

/** Start initial cloud sync after the user becomes authenticated. */
export function triggerCloudSyncAfterAuth(userId?: string): void {
  void syncEngine.hydrateStatus();
  void syncEngine.runInitialSync(userId).catch(() => {
    // Sync errors are surfaced via useSyncStatus on the Account screen.
  });
}

/** Await initial sync — use when navigation should wait for cloud data (e.g. password reset). */
export async function awaitCloudSyncAfterAuth(userId?: string): Promise<void> {
  await syncEngine.hydrateStatus();
  try {
    await syncEngine.runInitialSync(userId);
  } catch {
    // Non-blocking; Account screen shows sync errors.
  }
}

export function authEventShouldTriggerSync(event: string): boolean {
  return event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY';
}
