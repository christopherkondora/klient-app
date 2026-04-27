/**
 * EU VAT / international invoicing utilities — shared between Clients.tsx and InvoiceGenerateModal.tsx.
 * Deliberately a frontend-only module (no electron imports).
 */

/** EU tagállamok ISO 3166-1 alpha-2 kódjai (HU nélkül, mert az eladó HU-ban van). */
export const EU_COUNTRIES_NON_HU = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL',
  'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

/** EU tagállamok beleértve Magyarországot (ügyfél-form EU VAT mező megjelenítéséhez). */
export const EU_COUNTRIES_WITH_HU = new Set(['HU', ...EU_COUNTRIES_NON_HU]);

export function isEuCountry(countryCode: string | undefined | null): boolean {
  if (!countryCode) return false;
  return EU_COUNTRIES_NON_HU.has(countryCode.toUpperCase());
}

/** Devizajel a megadott ISO kódhoz (pl. EUR → '€'). */
export function currencySymbol(currency: string): string {
  switch (currency) {
    case 'HUF': return 'Ft';
    case 'EUR': return '€';
    case 'USD': return '$';
    case 'GBP': return '£';
    case 'CHF': return 'CHF';
    default: return currency;
  }
}

/** Összeg formázása devizával. HUF-nál egész, egyéb devizánál 2 tizedes. */
export function formatAmount(amount: number, currency: string): string {
  const sym = currencySymbol(currency);
  if (currency === 'HUF') {
    return `${Math.round(amount).toLocaleString('hu-HU')} ${sym}`;
  }
  return `${amount.toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${sym}`;
}

/** EU B2B fordított adózás záradék (angol). */
export const EU_REVERSE_CHARGE_COMMENT =
  'Reverse charge — VAT to be accounted for by the recipient (Art. 196 of Council Directive 2006/112/EC).';

/** EU B2C határon átnyúló ÁFA-mentes záradék. */
export const EU_B2C_COMMENT = 'VAT-exempt intra-community supply.';

/** Harmadik ország (non-EU) export záradék. */
export const THIRD_COUNTRY_COMMENT = 'Export of services — outside the scope of EU VAT.';

/** Alanyi adómentes záradék (magyar). */
export const AAM_COMMENT =
  'A számla adómentes értékesítést tartalmaz. Alanyi adómentesség — Áfa tv. XIII. fejezet (187-188. §).';

export type InvoiceScenario = 'hu-domestic' | 'eu-b2b' | 'eu-b2c' | 'third-country';

/** Meghatározza a számlázási szcenáriót az ügyfél ország kódja és EU ÁFA szám alapján. */
export function resolveInvoiceScenario(
  countryCode: string | undefined | null,
  euVatNumber: string | undefined | null,
): InvoiceScenario {
  const cc = (countryCode || 'HU').toUpperCase();
  if (cc === 'HU') return 'hu-domestic';
  if (isEuCountry(cc)) {
    return euVatNumber?.trim() ? 'eu-b2b' : 'eu-b2c';
  }
  return 'third-country';
}

/** Visszaadja az adott szcenárióhoz tartozó automatikus záradékot. */
export function scenarioComment(scenario: InvoiceScenario): string {
  switch (scenario) {
    case 'eu-b2b': return EU_REVERSE_CHARGE_COMMENT;
    case 'eu-b2c': return EU_B2C_COMMENT;
    case 'third-country': return THIRD_COUNTRY_COMMENT;
    default: return '';
  }
}

/** Visszaadja az adott szcenárióhoz tartozó Billingo/Számlázz ÁFA kódot.
 *
 * Billingo hivatalos ÁFA kulcsok (support.billingo.hu/content/96272694):
 * - EU   = EU-n belül (intra-EU B2B, Art. 196 fordított adózás)
 * - EUK  = EU-n kívül (harmadik ország export)
 * - EU B2C esetén nincs speciális kód — Áfa tv. alapján a teljesítés helye HU → 27% ÁFA.
 */
export function scenarioVatCode(scenario: InvoiceScenario): 'EU' | 'EUK' | null {
  switch (scenario) {
    case 'eu-b2b': return 'EU';     // EU B2B — intra-EU reverse charge
    case 'third-country': return 'EUK'; // EU-n kívül — harmadik ország
    case 'eu-b2c':                  // EU B2C → általános HU 27% szabály (null = vatRate alapján)
    default: return null;
  }
}
