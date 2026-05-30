export const INTEGER_DECIMAL_PLACES = 0;

/** Strip non-numeric characters and cap fractional digits while typing. */
export function sanitizeNumericInput(raw: string, maxDecimalPlaces: number): string {
  if (raw === '') {
    return '';
  }

  const normalized = raw.replace(/,/g, '.');
  const digitsAndDot = normalized.replace(/[^\d.]/g, '');
  const firstDot = digitsAndDot.indexOf('.');

  let cleaned: string;
  if (firstDot === -1) {
    cleaned = digitsAndDot;
  } else {
    const before = digitsAndDot.slice(0, firstDot + 1);
    const after = digitsAndDot.slice(firstDot + 1).replace(/\./g, '');
    cleaned = before + after;
  }

  if (maxDecimalPlaces === 0) {
    return cleaned.replace(/\./g, '');
  }

  if (firstDot === -1) {
    return cleaned;
  }

  const [rawInt = '', rawFrac = ''] = cleaned.split('.');
  const limitedFrac = rawFrac.slice(0, maxDecimalPlaces);
  const hadTrailingDot = cleaned.endsWith('.');

  if (hadTrailingDot && limitedFrac.length === 0) {
    return rawInt.length > 0 ? `${rawInt}.` : '0.';
  }

  if (limitedFrac.length === 0) {
    return rawInt.length > 0 ? rawInt : '';
  }

  const intPart = rawInt.length > 0 ? rawInt : '0';
  return `${intPart}.${limitedFrac}`;
}
