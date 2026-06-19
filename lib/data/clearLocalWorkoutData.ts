import AsyncStorage from '@react-native-async-storage/async-storage';

import { replaceExerciseLibraryEntries } from '@/lib/exerciseLibraryStorage';
import { NEW_LOG_DRAFT_KEY_PREFIX } from '@/lib/logWorkoutDraft';
import { clearAllOfflineChanges } from '@/lib/sync/offlineChangeStorage';
import { replaceLoggedWorkouts, replaceWorkouts } from '@/lib/workoutsStorage';

const EDIT_LOG_DRAFT_KEY_PREFIX = 'workout-log-draft-edit@v1:';

async function clearWorkoutDraftKeys(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const draftKeys = keys.filter(
    (key) => key.startsWith(NEW_LOG_DRAFT_KEY_PREFIX) || key.startsWith(EDIT_LOG_DRAFT_KEY_PREFIX),
  );
  if (draftKeys.length > 0) {
    await AsyncStorage.multiRemove(draftKeys);
  }
}

/** Removes all workout templates, logs, library entries, drafts, and offline sync queue from this device. */
export async function clearLocalWorkoutData(): Promise<void> {
  await Promise.all([
    replaceWorkouts([]),
    replaceLoggedWorkouts([]),
    replaceExerciseLibraryEntries([]),
    clearAllOfflineChanges(),
    clearWorkoutDraftKeys(),
  ]);
}
