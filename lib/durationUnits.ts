export const DURATION_UNITS = ['minutes', 'seconds', 'hours'] as const;

export type DurationUnit = (typeof DURATION_UNITS)[number];

export const DEFAULT_DURATION_UNIT: DurationUnit = 'minutes';

export const DURATION_UNIT_LABELS: Record<DurationUnit, string> = {
  minutes: 'Minutes',
  seconds: 'Seconds',
  hours: 'Hours',
};

export const DURATION_UNIT_ABBREVIATIONS: Record<DurationUnit, string> = {
  minutes: 'min',
  seconds: 'sec',
  hours: 'hr',
};

export function isDurationUnit(value: string): value is DurationUnit {
  return (DURATION_UNITS as readonly string[]).includes(value);
}

export function normalizeDurationUnit(value: unknown): DurationUnit {
  return typeof value === 'string' && isDurationUnit(value) ? value : DEFAULT_DURATION_UNIT;
}

export function usesIntegerDurationInput(unit: DurationUnit): boolean {
  return unit === 'minutes' || unit === 'seconds';
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

export function formatDurationValue(value: number, unit: DurationUnit): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }
  if (usesIntegerDurationInput(unit)) {
    return String(Math.round(value));
  }
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatDurationWithUnit(value: number, unit: DurationUnit): string {
  const formatted = formatDurationValue(value, unit);
  if (!formatted) {
    return '';
  }
  return `${formatted} ${DURATION_UNIT_ABBREVIATIONS[unit]}`;
}
