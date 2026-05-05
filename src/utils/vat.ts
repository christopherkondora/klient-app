/**
 * UI-szintű deviza formázók a számla űrlapokon és kliens listákon. A domain
 * logika (ÁFA szabályok, záradékok, számla szcenárió) a `shared/invoice-scenario.ts`
 * modulban él — onnan re-exportáljuk az ország-listákat, hogy a Clients.tsx
 * meglévő importja ne törjön.
 */

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

export {
  EU_COUNTRIES_NON_HU,
  EU_COUNTRIES_WITH_HU,
  isEuCountry,
} from '../../shared/invoice-scenario';
