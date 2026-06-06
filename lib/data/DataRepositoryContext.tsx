import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { useAuth } from '@/lib/auth/AuthProvider';
import type { DataRepository } from '@/lib/data/DataRepository';
import { localDataRepository } from '@/lib/data/LocalDataRepository';
import { createSyncedDataRepository } from '@/lib/data/SyncedDataRepository';

const DataRepositoryContext = createContext<DataRepository | null>(null);

const syncedDataRepository = createSyncedDataRepository();

type DataRepositoryProviderProps = {
  children: ReactNode;
};

export function DataRepositoryProvider({ children }: DataRepositoryProviderProps) {
  const { isSignedIn } = useAuth();

  const repository = useMemo(
    () => (isSignedIn ? syncedDataRepository : localDataRepository),
    [isSignedIn],
  );

  return (
    <DataRepositoryContext.Provider value={repository}>{children}</DataRepositoryContext.Provider>
  );
}

export function useDataRepository(): DataRepository {
  const repository = useContext(DataRepositoryContext);
  if (!repository) {
    throw new Error('useDataRepository must be used within DataRepositoryProvider');
  }
  return repository;
}
