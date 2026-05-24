export const CARDIO_DISTANCE_UNITS = [
  'miles',
  'kilometers',
  'meters',
  'yards',
  'feet',
  'steps',
  'laps',
  'floors',
  'sets',
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
  sets: 'Sets',
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
  sets: 'sets',
};

export function isCardioDistanceUnit(value: string): value is CardioDistanceUnit {
  return (CARDIO_DISTANCE_UNITS as readonly string[]).includes(value);
}

export function normalizeCardioDistanceUnit(value: unknown): CardioDistanceUnit {
  return typeof value === 'string' && isCardioDistanceUnit(value) ? value : DEFAULT_CARDIO_DISTANCE_UNIT;
}

export function usesIntegerDistanceInput(unit: CardioDistanceUnit): boolean {
  return unit === 'steps' || unit === 'laps' || unit === 'floors' || unit === 'sets';
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

/** Singular unit label for cardio "per" rate (e.g. mile, kilometer). */
export const CARDIO_DISTANCE_UNIT_PER_LABELS: Record<CardioDistanceUnit, string> = {
  miles: 'mile',
  kilometers: 'kilometer',
  meters: 'meter',
  yards: 'yard',
  feet: 'foot',
  steps: 'step',
  laps: 'lap',
  floors: 'floor',
  sets: 'set',
};

export function formatCardioPerDistanceUnit(unit: CardioDistanceUnit): string {
  return CARDIO_DISTANCE_UNIT_PER_LABELS[normalizeCardioDistanceUnit(unit)];
}

/** Legacy cardio stored `sets` on duration; move value to distance when loading. */
export function migrateLegacyCardioSetsDurationToDistance<
  T extends {
    activityType: string;
    duration: number;
    durationUnit: unknown;
    distance: number;
    distanceUnit: unknown;
  },
>(exercise: T): T {
  if (exercise.activityType !== 'cardio' || exercise.durationUnit !== 'sets') {
    return exercise;
  }
  return {
    ...exercise,
    distance: exercise.distance > 0 ? exercise.distance : exercise.duration,
    distanceUnit: 'sets',
    duration: 0,
    durationUnit: 'minutes',
  };
}

export function migrateLegacyCardioSetsDurationDraft<
  T extends {
    activityType: string;
    duration: string;
    durationUnit: unknown;
    distance: string;
    distanceUnit: unknown;
  },
>(exercise: T): T {
  if (exercise.activityType !== 'cardio' || exercise.durationUnit !== 'sets') {
    return exercise;
  }
  const distanceRaw = exercise.distance.trim();
  return {
    ...exercise,
    distance: distanceRaw.length > 0 ? exercise.distance : exercise.duration,
    distanceUnit: 'sets',
    duration: '',
    durationUnit: 'minutes',
  };
}
