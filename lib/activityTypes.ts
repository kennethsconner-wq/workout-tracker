export const ACTIVITY_TYPES = ['strength', 'cardio', 'sport'] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const DEFAULT_ACTIVITY_TYPE: ActivityType = 'strength';

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  strength: 'Strength',
  cardio: 'Cardio',
  sport: 'Sport',
};

export function isActivityType(value: string): value is ActivityType {
  return (ACTIVITY_TYPES as readonly string[]).includes(value);
}

/** Coerce stored or imported values; unknown/missing values become strength. */
export function normalizeActivityType(value: unknown): ActivityType {
  return typeof value === 'string' && isActivityType(value) ? value : DEFAULT_ACTIVITY_TYPE;
}
