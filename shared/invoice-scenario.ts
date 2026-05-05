/**
 * Számla szcenárió — a magyar számlázás ÁFA-szabályainak egyetlen igazsága.
 *
 * Mindkét oldalról használt (renderer: űrlap-előnézet az InvoiceGenerateModal-ban;
 * main: tényleges számla összeállítás a billing-service-ben). Ezért tilos electron-
 * vagy React-specifikus importot tenni ebbe a fájlba.
 *
 * A kimeneti `vatCode` mezőben szereplő kódok a magyar számlázási hagyomány
 * szerinti rövidítések (AAM, EU, EUK, ATHK, stb.). A Billingo és a Számlázz.hu
 * adapter ezeket a saját formátumára fordítja át — a szcenárió-modul nem ismeri
 * sem a Billingo, sem a Számlázz API kódkészletét.
 */

// ── EU országok ──

/** EU tagállamok ISO 3166-1 alpha-2 kódjai HU nélkül (mert az eladó HU-ban van). */
export const EU_COUNTRIES_NON_HU = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL',
  'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

/** EU tagállamok beleértve Magyarországot — űrlap selectorhoz. */
export const EU_COUNTRIES_WITH_HU = new Set(['HU', ...EU_COUNTRIES_NON_HU]);

export function isEuCountry(countryCode: string | undefined | null): boolean {
  if (!countryCode) return false;
  return EU_COUNTRIES_NON_HU.has(countryCode.toUpperCase());
}

// ── Típusok ──

export type InvoiceScenarioKind =
  | 'hu-domestic-standard'  // HU vevő, eladó áfás → normál ÁFA kulcs
  | 'hu-domestic-aam'       // HU vevő, eladó alanyi adómentes (AAM)
  | 'eu-b2b'                // EU vevő érvényes EU ÁFA-számmal → fordított adózás
  | 'eu-b2c'                // EU vevő EU ÁFA-szám nélkül → HU domestic szabály
  | 'third-country';        // EU-n kívüli vevő → EUK export

export type SellerVatStatus = 'standard' | 'exempt';

export type DomesticVatRate = 27 | 18 | 5 | 0;

/**
 * Magyar számlázási VAT kódok. Egy adapter-réteg fordítja a Billingo/Számlázz
 * provider formátumára.
 */
export type HungarianVatCode =
  | 'AM'      // adómentes (általános)
  | 'AAM'     // alanyi adómentes (Áfa tv. XIII. fej.)
  | 'TAM'     // tárgyi adómentes
  | 'EU'      // EU-n belüli, fordított adózás (Art. 196)
  | 'EUK'     // EU-n kívüli (harmadik ország, export)
  | 'ATHK'    // adóhatáskörén kívüli
  | 'MAA'     // mezőgazdasági átalány
  | 'FAD'     // fordított adózás (belföldi)
  | 'AKK'     // áfa-körön kívüli kompenzáció
  | 'K_AFA';  // különleges áfa

export type InvoiceLanguage = 'hu' | 'en' | 'de';

export interface InvoiceScenarioInput {
  /** Vevő ISO 3166-1 alpha-2 országkódja. Üres / null → 'HU' alapértelmezett. */
  buyerCountryCode: string | null | undefined;
  /** Vevő EU ÁFA-száma (pl. 'DE123456789'). Csak EU országoknál releváns. */
  buyerEuVatNumber: string | null | undefined;
  /** Eladó áfa-státusza a `user_settings.vat_status`-ból. */
  sellerVatStatus: SellerVatStatus;
  /** Eladó alapértelmezett HU ÁFA kulcsa a `user_settings.vat_rate_default`-ből. */
  defaultDomesticRate: DomesticVatRate;
  /** Számla nyelve a záradékhoz. Alapértelmezett: 'hu'. */
  invoiceLanguage?: InvoiceLanguage;
}

export interface InvoiceScenario {
  kind: InvoiceScenarioKind;
  vatRate: DomesticVatRate;
  vatCode?: HungarianVatCode;
  /** Automatikus záradék (üres string ha nincs). Az `invoiceLanguage` alapján fordított. */
  comment: string;
  /**
   * Igaz, ha a számlázón a partner `taxcode` mezőjébe a vevő EU ÁFA számát kell tenni
   * (nem a belföldi adószámot). EU B2B fordított adózásnál mindig.
   */
  useEuVatNumberAsTaxCode: boolean;
}

// ── Záradékok ──

const COMMENTS = {
  'eu-b2b': {
    hu: 'Fordított adózás — az ÁFA-t a vevő számolja el (Art. 196, 2006/112/EK irányelv).',
    en: 'Reverse charge — VAT to be accounted for by the recipient (Art. 196 of Council Directive 2006/112/EC).',
    de: 'Reverse-Charge — Die Umsatzsteuer schuldet der Leistungsempfänger (Art. 196 der Richtlinie 2006/112/EG).',
  },
  'eu-b2c': {
    hu: 'EU-n belüli adómentes szolgáltatásnyújtás.',
    en: 'VAT-exempt intra-community supply.',
    de: 'Innergemeinschaftliche steuerfreie Lieferung.',
  },
  'third-country': {
    hu: 'Szolgáltatás export — az EU ÁFA hatályán kívül.',
    en: 'Export of services — outside the scope of EU VAT.',
    de: 'Dienstleistungsexport — außerhalb des EU-Umsatzsteuerbereichs.',
  },
  /**
   * AAM kötelező záradék — Áfa tv. 188. §. Magyar nyelven kötelező feltüntetni
   * akkor is, ha a számla maga idegen nyelvű, ezért nyelvfüggetlen.
   */
  'hu-domestic-aam': {
    hu: 'A számla adómentes értékesítést tartalmaz. Alanyi adómentesség — Áfa tv. XIII. fejezet (187-188. §).',
  },
} as const;

// ── Egyenkénti exportok visszafelé kompatibilitásra ──

export const EU_REVERSE_CHARGE_COMMENT = COMMENTS['eu-b2b'].en;
export const EU_B2C_COMMENT = COMMENTS['eu-b2c'].en;
export const THIRD_COUNTRY_COMMENT = COMMENTS['third-country'].en;
export const AAM_COMMENT = COMMENTS['hu-domestic-aam'].hu;

// ── Fő függvény ──

/**
 * Az ügyfél és az eladó adatai alapján visszaadja a teljes számla szcenáriót:
 * milyen ÁFA kulcsot kell alkalmazni, milyen kódot kell használni a magyar
 * VAT-kategóriák közül, milyen kötelező vagy ajánlott záradékot kell
 * a számlára írni, és hogy a partner adószáma mezőbe az EU VAT számot kell-e tenni.
 */
export function resolveInvoiceScenario(input: InvoiceScenarioInput): InvoiceScenario {
  const cc = (input.buyerCountryCode || 'HU').toUpperCase();
  const lang: InvoiceLanguage = input.invoiceLanguage || 'hu';
  const hasEuVat = !!input.buyerEuVatNumber?.trim();

  // 1. Magyar belföldi
  if (cc === 'HU') {
    if (input.sellerVatStatus === 'exempt') {
      return {
        kind: 'hu-domestic-aam',
        vatRate: 0,
        vatCode: 'AAM',
        comment: COMMENTS['hu-domestic-aam'].hu,
        useEuVatNumberAsTaxCode: false,
      };
    }
    return {
      kind: 'hu-domestic-standard',
      vatRate: input.defaultDomesticRate,
      comment: '',
      useEuVatNumberAsTaxCode: false,
    };
  }

  // 2. EU-n belüli
  if (isEuCountry(cc)) {
    if (hasEuVat) {
      return {
        kind: 'eu-b2b',
        vatRate: 0,
        vatCode: 'EU',
        comment: COMMENTS['eu-b2b'][lang],
        useEuVatNumberAsTaxCode: true,
      };
    }
    // EU B2C — nincs EU VAT szám, HU domestic szabály érvényes (a teljesítés helye HU,
    // ezért az eladó ÁFÁ-s számlát ad). AAM eladó esetén AAM kóddal mentes a számla.
    if (input.sellerVatStatus === 'exempt') {
      return {
        kind: 'hu-domestic-aam',
        vatRate: 0,
        vatCode: 'AAM',
        comment: COMMENTS['hu-domestic-aam'].hu,
        useEuVatNumberAsTaxCode: false,
      };
    }
    return {
      kind: 'eu-b2c',
      vatRate: input.defaultDomesticRate,
      comment: '', // B2C-re a HU domestic rate alkalmazandó, nincs auto záradék
      useEuVatNumberAsTaxCode: false,
    };
  }

  // 3. Harmadik ország (EU-n kívüli)
  return {
    kind: 'third-country',
    vatRate: 0,
    vatCode: 'EUK',
    comment: COMMENTS['third-country'][lang],
    useEuVatNumberAsTaxCode: false,
  };
}
