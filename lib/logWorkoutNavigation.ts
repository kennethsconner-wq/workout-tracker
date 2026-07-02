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
let pendingFocusExerciseId: string | null = null;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function beginLogWorkoutSession(session: LogWorkoutSession): void {
  pendingSession = session;
}

export function clearLogWorkoutSession(): void {
  pendingSession = null;
  pendingFocusExerciseId = null;
}

export function consumePendingFocusExerciseId(): string | null {
  const exerciseId = pendingFocusExerciseId;
  pendingFocusExerciseId = null;
  return exerciseId;
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

/** Focus an in-progress log session without pushing a duplicate screen (e.g. notification tap). */
export function focusLogWorkoutSession(session: LogWorkoutSession): void {
  focusLogWorkoutExercise(session, null);
}

export function focusLogWorkoutExercise(session: LogWorkoutSession, exerciseId: string | null): void {
  beginLogWorkoutSession(session);
  pendingFocusExerciseId = exerciseId;
  router.navigate({
    pathname: '/log-workout',
    params: logWorkoutRouteParams(session, exerciseId),
  });
}

function logWorkoutRouteParams(
  session: LogWorkoutSession,
  focusExerciseId?: string | null,
): Record<string, string> {
  const base =
    session.intent === 'edit' && session.loggedWorkoutId
      ? {
          workoutId: session.workoutId,
          loggedWorkoutId: session.loggedWorkoutId,
          logIntent: 'edit',
        }
      : {
          workoutId: session.workoutId,
          logIntent: 'new',
        };

  if (focusExerciseId) {
    return { ...base, focusExerciseId, t: String(Date.now()) };
  }

  return base;
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
