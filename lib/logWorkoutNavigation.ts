import { router } from 'expo-router';

import { clearNewLogDraft } from '@/lib/logWorkoutDraft';

export type LogWorkoutSession = {
  intent: 'new' | 'edit';
  workoutId: string;
  loggedWorkoutId?: string;
};

/**
 * Set synchronously before `router.push`. Route params on the hidden `(tabs)/add`
 * screen often lag or reset; this is the source of truth until cleared.
 */
let pendingSession: LogWorkoutSession | null = null;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function beginLogWorkoutSession(session: LogWorkoutSession): void {
  pendingSession = session;
}

export function clearLogWorkoutSession(): void {
  pendingSession = null;
}

export function resolveLogWorkoutSession(
  params: Record<string, string | string[] | undefined>,
): LogWorkoutSession | null {
  if (pendingSession) {
    return pendingSession;
  }

  const workoutId = firstParam(params.workoutId);
  const loggedWorkoutId = firstParam(params.loggedWorkoutId);
  const logIntent = firstParam(params.logIntent);

  if (!workoutId) {
    return null;
  }

  if (logIntent === 'edit' && loggedWorkoutId) {
    return { intent: 'edit', workoutId, loggedWorkoutId };
  }

  if (logIntent === 'new' || !loggedWorkoutId) {
    return { intent: 'new', workoutId };
  }

  return { intent: 'edit', workoutId, loggedWorkoutId };
}

/** Opens log screen and restores an in-progress new-log draft when one exists. */
export function navigateToResumeLogWorkout(workoutId: string): void {
  navigateToNewLogWorkout(workoutId);
}

export function navigateToNewLogWorkout(workoutId: string): void {
  beginLogWorkoutSession({ intent: 'new', workoutId });
  router.push({
    pathname: '/log-workout',
    params: { workoutId, logIntent: 'new', t: String(Date.now()) },
  });
}

/** Clears the saved draft, then opens a blank log for this workout template. */
export async function navigateToNewLogWorkoutFresh(workoutId: string): Promise<void> {
  await clearNewLogDraft(workoutId);
  navigateToNewLogWorkout(workoutId);
}

export function navigateToEditLoggedWorkout(workoutId: string, loggedWorkoutId: string): void {
  beginLogWorkoutSession({ intent: 'edit', workoutId, loggedWorkoutId });
  router.push({
    pathname: '/log-workout',
    params: { workoutId, loggedWorkoutId, logIntent: 'edit', t: String(Date.now()) },
  });
}
