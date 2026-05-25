/** Default fractional precision for logged values, summaries, and metrics. */
export const DISPLAY_DECIMAL_PLACES = 2;

export function roundToDisplayDecimals(
  value: number,
  decimalPlaces = DISPLAY_DECIMAL_PLACES,
): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}

export function formatDisplayDecimal(
  value: number,
  decimalPlaces = DISPLAY_DECIMAL_PLACES,
): string {
  if (!Number.isFinite(value)) {
    return '';
  }
  const rounded = roundToDisplayDecimals(value, decimalPlaces);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(decimalPlaces);
}
