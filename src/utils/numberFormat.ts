/**
 * Strip formatting characters → raw digit string.
 * Removes spaces (Hungarian thousands separator) and any other non-digit characters.
 */
export function parseNum(formatted: string): string {
  return formatted.replace(/[^\d]/g, '');
}

/**
 * Format a raw digit/number string with Hungarian thousands separator (space).
 * e.g. "50000" → "50 000"
 */
export function fmtNum(raw: string): string {
  const clean = raw.replace(/[^\d]/g, '');
  if (!clean) return '';
  const num = parseInt(clean, 10);
  if (isNaN(num)) return '';
  // Explicit space grouping — reliable from 1 000 upward, locale-independent
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
}

/**
 * Parse a currency amount that may contain cents.
 * Accepts either comma or dot as decimal separator and keeps at most two decimals.
 */
export function parseDecimalNum(formatted: string): string {
  const normalized = formatted.replace(/,/g, '.');
  let result = '';
  let hasDecimal = false;

  for (const char of normalized) {
    if (/\d/.test(char)) {
      result += char;
    } else if (char === '.' && !hasDecimal) {
      result = result || '0';
      result += '.';
      hasDecimal = true;
    }
  }

  if (!result) return '';

  const [whole, decimal = ''] = result.split('.');
  const cleanWhole = whole.replace(/^0+(?=\d)/, '') || '0';
  return hasDecimal ? `${cleanWhole}.${decimal.slice(0, 2)}` : cleanWhole;
}

/**
 * Format a decimal currency amount while preserving an in-progress decimal separator.
 */
export function fmtDecimalNum(raw: string): string {
  const clean = parseDecimalNum(raw);
  if (!clean) return '';

  const hasDecimal = clean.includes('.');
  const [whole, decimal = ''] = clean.split('.');
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return hasDecimal ? `${groupedWhole}.${decimal}` : groupedWhole;
}
