type Timestamped = {
  updatedAt: string;
};

export function parseSyncTime(iso: string): number {
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : 0;
}

/** True when `candidate` is at least as new as `baseline` (edit-time LWW). */
export function isEditAtLeastAsNew(candidateUpdatedAt: string, baselineUpdatedAt: string): boolean {
  return parseSyncTime(candidateUpdatedAt) >= parseSyncTime(baselineUpdatedAt);
}

export function resolveEditTimestamp(updatedAt: string | undefined): string {
  if (updatedAt && Number.isFinite(Date.parse(updatedAt))) {
    return updatedAt;
  }
  return new Date().toISOString();
}

/** Last-write-wins conflict resolution (Phase 3). */
export function resolveByUpdatedAt<T extends Timestamped>(local: T, remote: T): T {
  const localTime = Date.parse(local.updatedAt);
  const remoteTime = Date.parse(remote.updatedAt);

  if (!Number.isFinite(localTime) || !Number.isFinite(remoteTime)) {
    return local;
  }

  return isEditAtLeastAsNew(local.updatedAt, remote.updatedAt) ? local : remote;
}
