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
