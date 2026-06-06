import * as SecureStore from 'expo-secure-store';

/** SecureStore value size limit on Android (bytes). */
const CHUNK_SIZE = 1800;

function chunkKey(key: string, index: number): string {
  return `${key}_chunk_${index}`;
}

async function getChunkCount(key: string): Promise<number> {
  const countRaw = await SecureStore.getItemAsync(`${key}_chunk_count`);
  if (!countRaw) {
    return 0;
  }
  const count = Number.parseInt(countRaw, 10);
  return Number.isFinite(count) ? count : 0;
}

/**
 * Secure storage adapter for Supabase auth sessions.
 * Chunks large values to stay within SecureStore size limits.
 */
export const secureAuthStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const chunkCount = await getChunkCount(key);
    if (chunkCount > 0) {
      const parts: string[] = [];
      for (let i = 0; i < chunkCount; i += 1) {
        const part = await SecureStore.getItemAsync(chunkKey(key, i));
        if (part == null) {
          return null;
        }
        parts.push(part);
      }
      return parts.join('');
    }

    return SecureStore.getItemAsync(key);
  },

  setItem: async (key: string, value: string): Promise<void> => {
    await secureAuthStorage.removeItem(key);

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const chunkCount = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < chunkCount; i += 1) {
      const start = i * CHUNK_SIZE;
      const chunk = value.slice(start, start + CHUNK_SIZE);
      await SecureStore.setItemAsync(chunkKey(key, i), chunk);
    }
    await SecureStore.setItemAsync(`${key}_chunk_count`, String(chunkCount));
  },

  removeItem: async (key: string): Promise<void> => {
    const chunkCount = await getChunkCount(key);
    for (let i = 0; i < chunkCount; i += 1) {
      await SecureStore.deleteItemAsync(chunkKey(key, i));
    }
    await SecureStore.deleteItemAsync(`${key}_chunk_count`);
    await SecureStore.deleteItemAsync(key);
  },
};
