export const CARDIO_DISTANCE_UNITS = [
  'miles',
  'kilometers',
  'meters',
  'yards',
  'feet',
  'steps',
  'laps',
  'floors',
] as const;

export type CardioDistanceUnit = (typeof CARDIO_DISTANCE_UNITS)[number];

export const DEFAULT_CARDIO_DISTANCE_UNIT: CardioDistanceUnit = 'miles';

export const CARDIO_DISTANCE_UNIT_LABELS: Record<CardioDistanceUnit, string> = {
  miles: 'Miles',
  kilometers: 'Kilometers',
  meters: 'Meters',
  yards: 'Yards',
  feet: 'Feet',
  steps: 'Steps',
  laps: 'Laps',
  floors: 'Floors',
};

export const CARDIO_DISTANCE_UNIT_ABBREVIATIONS: Record<CardioDistanceUnit, string> = {
  miles: 'mi',
  kilometers: 'km',
  meters: 'm',
  yards: 'yd',
  feet: 'ft',
  steps: 'steps',
  laps: 'laps',
  floors: 'floors',
};

export function isCardioDistanceUnit(value: string): value is CardioDistanceUnit {
  return (CARDIO_DISTANCE_UNITS as readonly string[]).includes(value);
}

export function normalizeCardioDistanceUnit(value: unknown): CardioDistanceUnit {
  return typeof value === 'string' && isCardioDistanceUnit(value) ? value : DEFAULT_CARDIO_DISTANCE_UNIT;
}

export function usesIntegerDistanceInput(unit: CardioDistanceUnit): boolean {
  return unit === 'steps' || unit === 'laps' || unit === 'floors';
}

export function parseCardioDistanceInput(raw: string, unit: CardioDistanceUnit): number {
  const trimmed = raw.trim().replace(',', '.');
  if (trimmed.length === 0) {
    return 0;
  }
  if (usesIntegerDistanceInput(unit)) {
    return Number.parseInt(trimmed, 10);
  }
  return Number.parseFloat(trimmed);
}

export function formatCardioDistanceValue(value: number, unit: CardioDistanceUnit): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }
  if (usesIntegerDistanceInput(unit)) {
    return String(Math.round(value));
  }
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatCardioDistanceWithUnit(value: number, unit: CardioDistanceUnit): string {
  const formatted = formatCardioDistanceValue(value, unit);
  if (!formatted) {
    return '';
  }
  return `${formatted} ${CARDIO_DISTANCE_UNIT_ABBREVIATIONS[unit]}`;
}
