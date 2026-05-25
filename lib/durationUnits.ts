export const STANDARD_DURATION_UNITS = ['minutes', 'seconds', 'hours', 'breaths'] as const;

export type StandardDurationUnit = (typeof STANDARD_DURATION_UNITS)[number];

/** Sport-only duration units (not used for cardio or stretch). */
export const SPORT_ONLY_DURATION_UNITS = ['matches', 'games', 'rounds'] as const;

export type SportOnlyDurationUnit = (typeof SPORT_ONLY_DURATION_UNITS)[number];

/** Stretch uses standard units including `breaths`. */
export const STRETCH_DURATION_UNITS = STANDARD_DURATION_UNITS;

/** Sport: time units plus matches/games/rounds; excludes `breaths`. */
export const SPORT_DURATION_UNITS = [
  'minutes',
  'seconds',
  'hours',
  'matches',
  'games',
  'rounds',
] as const;

export type SportDurationUnit = (typeof SPORT_DURATION_UNITS)[number];

/** Cardio duration: time units only (`sets` is a distance unit). */
export const CARDIO_DURATION_UNITS = ['minutes', 'seconds', 'hours'] as const;

export type CardioDurationUnit = (typeof CARDIO_DURATION_UNITS)[number];

export const DURATION_UNITS = [...STANDARD_DURATION_UNITS, ...SPORT_ONLY_DURATION_UNITS] as const;

export type DurationUnit = StandardDurationUnit | SportOnlyDurationUnit;

export const DEFAULT_DURATION_UNIT: DurationUnit = 'minutes';

export const DEFAULT_STANDARD_DURATION_UNIT: StandardDurationUnit = 'minutes';

export const DEFAULT_CARDIO_DURATION_UNIT: CardioDurationUnit = 'minutes';

export const DEFAULT_SPORT_DURATION_UNIT: SportDurationUnit = 'minutes';

/** Default duration unit for stretch exercises in create/edit workout forms. */
export const DEFAULT_STRETCH_DURATION_UNIT: DurationUnit = 'seconds';

export const DURATION_UNIT_LABELS: Record<DurationUnit, string> = {
  minutes: 'Minutes',
  seconds: 'Seconds',
  hours: 'Hours',
  breaths: 'Breaths',
  matches: 'Matches',
  games: 'Games',
  rounds: 'Rounds',
};

export const DURATION_UNIT_ABBREVIATIONS: Record<DurationUnit, string> = {
  minutes: 'min',
  seconds: 'sec',
  hours: 'hr',
  breaths: 'br',
  matches: 'matches',
  games: 'games',
  rounds: 'rnd',
};

export function isDurationUnit(value: string): value is DurationUnit {
  return (DURATION_UNITS as readonly string[]).includes(value);
}

export function isStandardDurationUnit(value: string): value is StandardDurationUnit {
  return (STANDARD_DURATION_UNITS as readonly string[]).includes(value);
}

export function isCardioDurationUnit(value: string): value is CardioDurationUnit {
  return (CARDIO_DURATION_UNITS as readonly string[]).includes(value);
}

export function isSportDurationUnit(value: string): value is SportDurationUnit {
  return (SPORT_DURATION_UNITS as readonly string[]).includes(value);
}

export function normalizeDurationUnit(value: unknown): DurationUnit {
  if (typeof value === 'string' && isDurationUnit(value)) {
    return value;
  }
  return DEFAULT_DURATION_UNIT;
}

/** Use for stretch exercises (includes `breaths`). */
export function normalizeStretchDurationUnit(value: unknown): StandardDurationUnit {
  if (typeof value === 'string' && isStandardDurationUnit(value)) {
    return value;
  }
  return DEFAULT_STANDARD_DURATION_UNIT;
}

/** Use for sport exercises (excludes `breaths`). */
export function normalizeSportDurationUnit(value: unknown): SportDurationUnit {
  if (typeof value === 'string' && isSportDurationUnit(value)) {
    return value;
  }
  return DEFAULT_SPORT_DURATION_UNIT;
}

/** Use for cardio duration (excludes `breaths`, matches, and games; `sets` is a distance unit). */
export function normalizeCardioDurationUnit(value: unknown): CardioDurationUnit {
  if (typeof value === 'string' && isCardioDurationUnit(value)) {
    return value;
  }
  return DEFAULT_CARDIO_DURATION_UNIT;
}

export function usesIntegerDurationInput(unit: DurationUnit): boolean {
  return (
    unit === 'minutes' ||
    unit === 'seconds' ||
    unit === 'breaths' ||
    unit === 'matches' ||
    unit === 'games' ||
    unit === 'rounds'
  );
}

export function parseDurationInput(raw: string, unit: DurationUnit): number {
  const trimmed = raw.trim().replace(',', '.');
  if (trimmed.length === 0) {
    return 0;
  }
  if (usesIntegerDurationInput(unit)) {
    return Number.parseInt(trimmed, 10);
  }
  return Number.parseFloat(trimmed);
}

export function formatDurationValue(value: number, unit: DurationUnit, decimalPlaces = 1): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }
  if (usesIntegerDurationInput(unit)) {
    return String(Math.round(value));
  }
  const factor = 10 ** decimalPlaces;
  const rounded = Math.round(value * factor) / factor;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(decimalPlaces);
}

export function formatDurationWithUnit(value: number, unit: DurationUnit): string {
  const formatted = formatDurationValue(value, unit);
  if (!formatted) {
    return '';
  }
  return `${formatted} ${DURATION_UNIT_ABBREVIATIONS[unit]}`;
}
