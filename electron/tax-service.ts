import { queryAll, queryOne, execute } from './db-helpers';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentUserId } from './database';
import {
  calculateAtalanyado,
  calculateVszja,
  calculateTao,
  calculateKiva,
  calculateFullEstimate,
  generateTaxDeadlines,
  generateTaxWarnings,
  compareTaxForms,
} from './tax-engine';
import type {
  TaxParameters,
  BusinessProfile,
  TaxEstimate,
  TaxDeadline,
  TaxWarning,
  TaxFormComparison,
  HipaRate,
} from './tax-types';

export interface TaxRuleRow {
  id: string;
  business_type: string;
  year: number;
  rate_percent: number;
  rate_label: string;
  notes: string | null;
}

export interface EligibilityRow {
  id: string;
  business_type: string;
  year: number;
  max_revenue_huf: number | null;
  max_employees: number | null;
  conditions_json: string;
}

export interface TaxCalcInput {
  businessType: string;
  year: number;
  revenue: number;
  expenses?: number;
  employeeCount?: number;
}

export interface TaxCalcResult {
  businessType: string;
  year: number;
  taxAmount: number;
  effectiveRate: number;
  eligible: boolean;
  warnings: string[];
  breakdown: {
    revenue: number;
    deductibleExpenses: number;
    taxableBase: number;
    appliedRate: number;
    appliedRateLabel: string;
  };
}

/** Resolve all tax rules for a business type and year */
export function resolveTaxRules(businessType: string, year: number): TaxRuleRow[] {
  const rows = queryAll(
    'SELECT * FROM tax_rules WHERE business_type = ? AND year = ?',
    [businessType, year]
  );
  return rows as unknown as TaxRuleRow[];
}

/** Check eligibility for a given business type */
export function checkEligibility(
  businessType: string,
  revenue: number,
  employeeCount?: number,
  year: number = new Date().getFullYear()
): { eligible: boolean; reasons: string[] } {
  const row = queryOne(
    'SELECT * FROM tax_eligibility_criteria WHERE business_type = ? AND year = ?',
    [businessType, year]
  ) as unknown as EligibilityRow | undefined;

  if (!row) {
    return { eligible: true, reasons: [] };
  }

  const reasons: string[] = [];

  if (row.max_revenue_huf !== null && revenue > row.max_revenue_huf) {
    reasons.push(`Bevétel meghaladja a maximumot: ${(row.max_revenue_huf / 1_000_000).toFixed(0)}M Ft`);
  }

  if (row.max_employees !== null && employeeCount !== undefined && employeeCount > row.max_employees) {
    reasons.push(`Alkalmazottak száma meghaladja a maximumot: ${row.max_employees} fő`);
  }

  const conditions = JSON.parse(row.conditions_json || '{}');
  if (conditions.entity_type === 'egyeni_vallalkozo') {
    // Can't validate entity type here — just note it as informational
    reasons.push('Csak egyéni vállalkozóknak elérhető');
  }

  // Eligibility is determined only by hard disqualifiers (revenue/employee limits).
  // "Csak" (entity type) notes are informational — they can't be validated here
  // since we don't have the entity type as input, but they are NOT exemptions.
  const hardDisqualifiers = reasons.filter(r => !r.startsWith('Csak'));

  return {
    eligible: hardDisqualifiers.length === 0,
    reasons,
  };
}

/** Calculate tax for a given input */
export function calculateTax(input: TaxCalcInput): TaxCalcResult {
  const { businessType, year, revenue, expenses = 0, employeeCount } = input;

  if (!businessType || typeof businessType !== 'string') {
    throw new Error('Érvénytelen adótípus');
  }
  if (typeof revenue !== 'number' || revenue < 0) {
    throw new Error('A bevétel nem lehet negatív');
  }
  if (typeof expenses !== 'number' || expenses < 0) {
    throw new Error('A kiadások nem lehetnek negatívak');
  }
  if (typeof year !== 'number' || year < 2020 || year > 2100) {
    throw new Error('Érvénytelen év');
  }
  if (employeeCount !== undefined && (typeof employeeCount !== 'number' || employeeCount < 0 || !Number.isInteger(employeeCount))) {
    throw new Error('Az alkalmazottak száma nem negatív egész szám kell legyen');
  }

  const rules = resolveTaxRules(businessType, year);
  const eligibility = checkEligibility(businessType, revenue, employeeCount, year);

  const warnings: string[] = [];
  if (!eligibility.eligible) {
    warnings.push(...eligibility.reasons);
  }

  let taxAmount = 0;
  let taxableBase = revenue;
  let appliedRate = 0;
  let appliedRateLabel = 'base';

  switch (businessType) {
    case 'kiva': {
      // KIVA: 10% on special tax basis (personnel costs + profit adjustments)
      // Simplified: revenue - expenses as base
      const baseRule = rules.find(r => r.rate_label === 'base');
      appliedRate = baseRule?.rate_percent ?? 10;
      taxableBase = Math.max(revenue - expenses, 0);
      taxAmount = taxableBase * (appliedRate / 100);
      appliedRateLabel = 'base';
      break;
    }

    case 'afa': {
      // AFA: apply standard 27% rate
      const stdRule = rules.find(r => r.rate_label === 'standard');
      appliedRate = stdRule?.rate_percent ?? 27;
      taxableBase = revenue;
      taxAmount = taxableBase * (appliedRate / 100);
      appliedRateLabel = 'standard';
      break;
    }

    case 'aam': {
      // AAM: VAT exempt — no tax
      appliedRate = 0;
      taxableBase = revenue;
      taxAmount = 0;
      appliedRateLabel = 'exempt';
      break;
    }

    case 'atalanyadozas': {
      // Use the new engine for comprehensive calculation
      const taxParams = getTaxParameters(year);
      if (taxParams) {
        const profilData = { koltseghanyad: taxParams.atalanyAltalanos, foglalkozas: 'fofoglalkozasu' as const, szakkepzettseg: false };
        const result = calculateAtalanyado(revenue, taxParams, profilData);
        taxAmount = result.osszesen;
        taxableBase = result.adokotelesJovedelem;
        appliedRate = taxParams.szjaKulcs * 100;
        appliedRateLabel = 'deemed_cost_general';
      } else {
        // Fallback: simple calculation
        const generalRule = rules.find(r => r.rate_label === 'deemed_cost_general');
        const deemedCostPct = generalRule?.rate_percent ?? 45;
        const deemedCost = revenue * (deemedCostPct / 100);
        taxableBase = revenue - deemedCost;
        appliedRate = 15;
        taxAmount = taxableBase * (appliedRate / 100);
        appliedRateLabel = 'deemed_cost_general';
      }
      break;
    }

    case 'kft_tao': {
      // Corporate tax: 9% on profit
      const baseRule = rules.find(r => r.rate_label === 'base');
      appliedRate = baseRule?.rate_percent ?? 9;
      taxableBase = Math.max(revenue - expenses, 0);
      taxAmount = taxableBase * (appliedRate / 100);
      appliedRateLabel = 'base';
      break;
    }

    default:
      warnings.push(`Ismeretlen adótípus: ${businessType}`);
  }

  const effectiveRate = revenue > 0 ? (taxAmount / revenue) * 100 : 0;

  // Log calculation to audit table
  const userId = getCurrentUserId();
  if (userId) {
    const result: TaxCalcResult = {
      businessType,
      year,
      taxAmount: Math.round(taxAmount),
      effectiveRate: Math.round(effectiveRate * 100) / 100,
      eligible: eligibility.eligible,
      warnings,
      breakdown: {
        revenue,
        deductibleExpenses: expenses,
        taxableBase: Math.round(taxableBase),
        appliedRate,
        appliedRateLabel,
      },
    };

    execute(
      `INSERT INTO tax_calculations (id, user_id, business_type, year, revenue, expenses, tax_amount, calculation_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), userId, businessType, year, revenue, expenses, Math.round(taxAmount), JSON.stringify(result)]
    );

    return result;
  }

  return {
    businessType,
    year,
    taxAmount: Math.round(taxAmount),
    effectiveRate: Math.round(effectiveRate * 100) / 100,
    eligible: eligibility.eligible,
    warnings,
    breakdown: {
      revenue,
      deductibleExpenses: expenses,
      taxableBase: Math.round(taxableBase),
      appliedRate,
      appliedRateLabel,
    },
  };
}

/** Get all business types available for a user's situation */
export function getAvailableTaxTypes(
  revenue: number,
  employeeCount?: number,
  year: number = new Date().getFullYear()
): string[] {
  const allTypes = queryAll('SELECT id FROM tax_business_types ORDER BY sort_order');
  const available: string[] = [];

  for (const row of allTypes) {
    const typeId = row.id as string;
    const { eligible } = checkEligibility(typeId, revenue, employeeCount, year);
    if (eligible) {
      available.push(typeId);
    }
  }

  return available;
}

/** Get all business types with their details */
export function getAllBusinessTypes() {
  return queryAll('SELECT * FROM tax_business_types ORDER BY sort_order');
}

/** Get/set user tax settings */
export function getUserTaxSettings(year: number = new Date().getFullYear()) {
  const userId = getCurrentUserId();
  if (!userId) return null;
  return queryOne(
    'SELECT * FROM user_tax_settings WHERE user_id = ? AND year = ?',
    [userId, year]
  );
}

export function setUserTaxSettings(businessType: string, year: number = new Date().getFullYear()) {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('No user logged in');

  const existing = queryOne(
    'SELECT id FROM user_tax_settings WHERE user_id = ? AND year = ?',
    [userId, year]
  );

  if (existing) {
    execute(
      `UPDATE user_tax_settings SET business_type = ?, is_active = 1, updated_at = datetime('now')
       WHERE user_id = ? AND year = ?`,
      [businessType, userId, year]
    );
  } else {
    execute(
      `INSERT INTO user_tax_settings (id, user_id, business_type, year, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [uuidv4(), userId, businessType, year]
    );
  }
}

/** Get calculation history */
export function getTaxCalculationHistory(limit: number = 50) {
  const userId = getCurrentUserId();
  if (!userId) return [];
  return queryAll(
    'SELECT * FROM tax_calculations WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, limit]
  );
}

// ── New service functions ──

/** Get tax parameters for a given year */
export function getTaxParameters(year: number): TaxParameters | null {
  const row = queryOne('SELECT * FROM tax_parameters WHERE year = ?', [year]);
  if (!row) return null;
  return {
    year: row.year as number,
    minimalberHavi: row.minimalber_havi as number,
    garantaltBerminimumHavi: row.garantalt_berminimum_havi as number,
    szjaKulcs: row.szja_kulcs as number,
    tbKulcs: row.tb_kulcs as number,
    szochoKulcs: row.szocho_kulcs as number,
    taoKulcs: row.tao_kulcs as number,
    kivaKulcs: row.kiva_kulcs as number,
    aamLimit: row.aam_limit as number,
    atalanyAltalanos: row.atalany_altalanos as number,
    atalanySpecialis: row.atalany_specialis as number,
    atalanyKisker: row.atalany_kisker as number,
    atalanyLimitSzorzo: row.atalany_limit_szorzo as number,
    atalanyAdomentesSzorzo: row.atalany_adomentes_szorzo as number,
    szochoPlafonSzorzo: row.szocho_plafon_szorzo as number,
    hipaMaxKulcs: row.hipa_max_kulcs as number,
    afaStandard: row.afa_standard as number,
    afaReduced: row.afa_reduced as number,
    afaSuperReduced: row.afa_super_reduced as number,
  };
}

/** Get business profile for a user */
export function getBusinessProfile(userId?: string): BusinessProfile | null {
  const uid = userId ?? getCurrentUserId();
  if (!uid) return null;
  const row = queryOne('SELECT * FROM business_profile WHERE user_id = ?', [uid]);
  if (!row) return null;
  return {
    userId: row.user_id as string,
    vallalkozasTipus: row.vallalkozas_tipus as BusinessProfile['vallalkozasTipus'],
    adozasForma: row.adozas_forma as BusinessProfile['adozasForma'],
    foglalkozas: row.foglalkozas as BusinessProfile['foglalkozas'],
    koltseghanyad: row.koltseghanyad as number,
    szakkepzettseg: !!(row.szakkepzettseg as number),
    aamValasztott: !!(row.aam_valasztott as number),
    afaBevallas: row.afa_bevallas as BusinessProfile['afaBevallas'],
    hipaKulcs: row.hipa_kulcs as number,
    hipaTelepules: row.hipa_telepules as string,
    hipaEgyszeru: !!(row.hipa_egyszeru as number),
    adoev: row.adoev as number,
    beallitva: !!(row.beallitva as number),
  };
}

/** Save (upsert) business profile */
export function saveBusinessProfile(profile: BusinessProfile): void {
  const uid = profile.userId || getCurrentUserId();
  if (!uid) throw new Error('No user logged in');

  const existing = queryOne('SELECT user_id FROM business_profile WHERE user_id = ?', [uid]);

  if (existing) {
    execute(
      `UPDATE business_profile SET
        vallalkozas_tipus = ?, adozas_forma = ?, foglalkozas = ?,
        koltseghanyad = ?, szakkepzettseg = ?, aam_valasztott = ?,
        afa_bevallas = ?, hipa_kulcs = ?, hipa_telepules = ?,
        hipa_egyszeru = ?, adoev = ?, beallitva = 1,
        updated_at = datetime('now')
      WHERE user_id = ?`,
      [
        profile.vallalkozasTipus, profile.adozasForma, profile.foglalkozas,
        profile.koltseghanyad, profile.szakkepzettseg ? 1 : 0, profile.aamValasztott ? 1 : 0,
        profile.afaBevallas, profile.hipaKulcs, profile.hipaTelepules,
        profile.hipaEgyszeru ? 1 : 0, profile.adoev, uid,
      ]
    );
  } else {
    execute(
      `INSERT INTO business_profile (
        user_id, vallalkozas_tipus, adozas_forma, foglalkozas,
        koltseghanyad, szakkepzettseg, aam_valasztott,
        afa_bevallas, hipa_kulcs, hipa_telepules,
        hipa_egyszeru, adoev, beallitva
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        uid, profile.vallalkozasTipus, profile.adozasForma, profile.foglalkozas,
        profile.koltseghanyad, profile.szakkepzettseg ? 1 : 0, profile.aamValasztott ? 1 : 0,
        profile.afaBevallas, profile.hipaKulcs, profile.hipaTelepules,
        profile.hipaEgyszeru ? 1 : 0, profile.adoev,
      ]
    );
  }
}

/** Search HIPA rates by settlement name (LIKE query, max 10) */
export function searchHipaRates(query: string): HipaRate[] {
  const rows = queryAll(
    'SELECT megye, telepules, kulcs FROM hipa_rates WHERE telepules LIKE ? COLLATE NOCASE ORDER BY telepules LIMIT 10',
    [`%${query}%`]
  );
  return rows.map(r => ({
    megye: r.megye as string,
    telepules: r.telepules as string,
    kulcs: r.kulcs as number,
  }));
}

/** Get exact HIPA rate for a settlement */
export function getHipaRate(megye: string, telepules: string): HipaRate | null {
  const row = queryOne(
    'SELECT megye, telepules, kulcs FROM hipa_rates WHERE megye = ? AND telepules = ?',
    [megye, telepules]
  );
  if (!row) return null;
  return { megye: row.megye as string, telepules: row.telepules as string, kulcs: row.kulcs as number };
}

/** Get full tax estimate for a user */
export function getFullTaxEstimate(userId: string | undefined, adoev: number, evesBevétel: number): TaxEstimate | null {
  const uid = userId ?? getCurrentUserId();
  if (!uid) return null;

  const profil = getBusinessProfile(uid);
  if (!profil || !profil.beallitva) return null;

  const params = getTaxParameters(adoev);
  if (!params) return null;

  return calculateFullEstimate(evesBevétel, profil, params);
}

/** Get tax deadlines for a user */
export function getTaxDeadlines(userId: string | undefined, adoev: number): TaxDeadline[] {
  const uid = userId ?? getCurrentUserId();
  if (!uid) return [];

  const profil = getBusinessProfile(uid);
  if (!profil || !profil.beallitva) return [];

  return generateTaxDeadlines(profil, adoev);
}

/** Get tax warnings for a user */
export function getTaxWarnings(userId: string | undefined, bevétel: number, adoev: number): TaxWarning[] {
  const uid = userId ?? getCurrentUserId();
  if (!uid) return [];

  const profil = getBusinessProfile(uid);
  if (!profil || !profil.beallitva) return [];

  const params = getTaxParameters(adoev);
  if (!params) return [];

  return generateTaxWarnings(bevétel, profil, params);
}

/** Compare tax forms for a user */
export function compareTaxFormsService(
  bevétel: number,
  koltsegek: number,
  adoev: number,
  hipaKulcs: number,
  kivet?: number
): TaxFormComparison[] {
  const params = getTaxParameters(adoev);
  if (!params) return [];

  const uid = getCurrentUserId();
  const profil = uid ? getBusinessProfile(uid) : null;
  const profilFields = profil
    ? { foglalkozas: profil.foglalkozas, szakkepzettseg: profil.szakkepzettseg, koltseghanyad: profil.koltseghanyad }
    : { foglalkozas: 'fofoglalkozasu' as const, szakkepzettseg: false, koltseghanyad: params.atalanyAltalanos };

  return compareTaxForms(bevétel, koltsegek, params, hipaKulcs, profilFields, kivet);
}

/** Sync tax deadlines into calendar_events.
 *  Deletes all existing [TAX] events for the given year range, then inserts fresh ones.
 */
export function syncTaxDeadlinesToCalendar(userId: string | undefined): void {
  const uid = userId ?? getCurrentUserId();
  if (!uid) return;

  const profil = getBusinessProfile(uid);
  if (!profil || !profil.beallitva) {
    // No profile → just delete old tax events
    execute(`DELETE FROM calendar_events WHERE title LIKE '[TAX]%'`);
    return;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  // Generate for current year and next year
  const deadlines = [
    ...generateTaxDeadlines(profil, currentYear),
    ...generateTaxDeadlines(profil, currentYear + 1),
  ];

  // Delete old tax events
  execute(`DELETE FROM calendar_events WHERE title LIKE '[TAX]%'`);

  // Insert new
  for (const d of deadlines) {
    const id = uuidv4();
    execute(
      `INSERT INTO calendar_events (id, title, description, date, type, color) VALUES (?, ?, ?, ?, 'deadline', ?)`,
      [id, `[TAX] ${d.description}`, d.type, d.date, d.color]
    );
  }
}
