export const CARDIO_DISTANCE_MODES = ['per', 'total'] as const;

export type CardioDistanceMode = (typeof CARDIO_DISTANCE_MODES)[number];

export const DEFAULT_CARDIO_DISTANCE_MODE: CardioDistanceMode = 'total';

export const CARDIO_DISTANCE_MODE_LABELS: Record<CardioDistanceMode, string> = {
  per: 'Per',
  total: 'Total',
};

export function isCardioDistanceMode(value: string): value is CardioDistanceMode {
  return (CARDIO_DISTANCE_MODES as readonly string[]).includes(value);
}

export function normalizeCardioDistanceMode(value: unknown): CardioDistanceMode {
  return typeof value === 'string' && isCardioDistanceMode(value) ? value : DEFAULT_CARDIO_DISTANCE_MODE;
}
