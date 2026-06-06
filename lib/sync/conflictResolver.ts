type Timestamped = {
  updatedAt: string;
};

/** Last-write-wins conflict resolution (Phase 3). */
export function resolveByUpdatedAt<T extends Timestamped>(local: T, remote: T): T {
  const localTime = Date.parse(local.updatedAt);
  const remoteTime = Date.parse(remote.updatedAt);

  if (!Number.isFinite(localTime) || !Number.isFinite(remoteTime)) {
    return local;
  }

  return localTime >= remoteTime ? local : remote;
}
