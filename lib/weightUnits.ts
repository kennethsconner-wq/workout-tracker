import { DISPLAY_DECIMAL_PLACES, formatDisplayDecimal } from '@/lib/displayDecimals';

export const WEIGHT_UNITS = ['pounds', 'kilograms'] as const;

export type WeightUnit = (typeof WEIGHT_UNITS)[number];

export const DEFAULT_WEIGHT_UNIT: WeightUnit = 'pounds';

export const WEIGHT_UNIT_LABELS: Record<WeightUnit, string> = {
  pounds: 'Pounds',
  kilograms: 'Kilograms',
};

export const WEIGHT_UNIT_ABBREVIATIONS: Record<WeightUnit, string> = {
  pounds: 'lb',
  kilograms: 'kg',
};

export function isWeightUnit(value: string): value is WeightUnit {
  return (WEIGHT_UNITS as readonly string[]).includes(value);
}

export function normalizeWeightUnit(value: unknown): WeightUnit {
  return typeof value === 'string' && isWeightUnit(value) ? value : DEFAULT_WEIGHT_UNIT;
}

export function formatWeightValue(value: number, unit: WeightUnit): string {
  if (!Number.isFinite(value) || value < 0) {
    return '';
  }
  return formatDisplayDecimal(value, DISPLAY_DECIMAL_PLACES);
}

export function formatWeightWithUnit(value: number, unit: WeightUnit): string {
  const formatted = formatWeightValue(value, unit);
  if (!formatted) {
    return '';
  }
  return `${formatted} ${WEIGHT_UNIT_ABBREVIATIONS[unit]}`;
}
