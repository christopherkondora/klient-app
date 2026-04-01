import { queryAll, queryOne, execute } from './db-helpers';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentUserId } from './database';

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
    // Can't validate entity type here — just note it
    reasons.push('Csak egyéni vállalkozóknak elérhető');
  }

  return {
    eligible: reasons.length === 0 || reasons.every(r => r.startsWith('Csak')),
    reasons,
  };
}

/** Calculate tax for a given input */
export function calculateTax(input: TaxCalcInput): TaxCalcResult {
  const { businessType, year, revenue, expenses = 0, employeeCount } = input;
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
      // KIVA: 11% on special tax basis (personnel costs + profit adjustments)
      // Simplified: revenue - expenses as base
      const baseRule = rules.find(r => r.rate_label === 'base');
      appliedRate = baseRule?.rate_percent ?? 11;
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
      // Flat-rate: deemed cost percentage deducted from revenue, then 15% SZJA on remainder
      const generalRule = rules.find(r => r.rate_label === 'deemed_cost_general');
      const deemedCostPct = generalRule?.rate_percent ?? 40;
      const deemedCost = revenue * (deemedCostPct / 100);
      taxableBase = revenue - deemedCost;
      appliedRate = 15; // SZJA rate
      taxAmount = taxableBase * (appliedRate / 100);
      appliedRateLabel = 'deemed_cost_general';
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

    case 'kata': {
      // KATA: fixed monthly amount (stored as rate_percent but is actually Ft/month)
      const flatRule = rules.find(r => r.rate_label === 'monthly_flat');
      const monthlyAmount = flatRule?.rate_percent ?? 50000;
      appliedRate = monthlyAmount;
      taxableBase = 0; // Not revenue-based
      taxAmount = monthlyAmount * 12;
      appliedRateLabel = 'monthly_flat';
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
