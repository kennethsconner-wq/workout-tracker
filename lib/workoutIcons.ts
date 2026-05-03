/**
 * Curated Ionicons for workout templates. `id` is persisted on {@link Workout};
 * `ion` is the glyph name passed to `@expo/vector-icons/Ionicons`.
 */
export const WORKOUT_ICON_OPTIONS = [
  { id: 'barbell', ion: 'barbell' },
  { id: 'fitness', ion: 'fitness' },
  { id: 'body', ion: 'body' },
  { id: 'pulse', ion: 'pulse' },
  { id: 'footsteps', ion: 'footsteps' },
  { id: 'walk', ion: 'walk' },
  { id: 'bicycle', ion: 'bicycle' },
  { id: 'flame', ion: 'flame' },
  { id: 'flash', ion: 'flash' },
  { id: 'heart', ion: 'heart' },
  { id: 'trophy', ion: 'trophy' },
  { id: 'water', ion: 'water' },
] as const;

export type WorkoutIconId = (typeof WORKOUT_ICON_OPTIONS)[number]['id'];

const VALID_IDS = new Set<string>(WORKOUT_ICON_OPTIONS.map((o) => o.id));

export const DEFAULT_WORKOUT_ICON_ID: WorkoutIconId = 'barbell';

export function normalizeWorkoutIconId(value: unknown): WorkoutIconId {
  if (typeof value === 'string' && VALID_IDS.has(value)) {
    return value as WorkoutIconId;
  }
  return DEFAULT_WORKOUT_ICON_ID;
}

export function workoutIoniconName(id: WorkoutIconId): (typeof WORKOUT_ICON_OPTIONS)[number]['ion'] {
  const found = WORKOUT_ICON_OPTIONS.find((o) => o.id === id);
  return found?.ion ?? 'barbell';
}
