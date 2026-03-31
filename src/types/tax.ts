/** Hungarian business tax type identifiers, matching database IDs */
export enum BusinessType {
  KIVA = 'kiva',
  AFA = 'afa',
  AAM = 'aam',
  ATALANYADOZAS = 'atalanyadozas',
  KFT_TAO = 'kft_tao',
  KATA = 'kata',
}

/** Rate label categorization for tax rules */
export type TaxRateLabel =
  | 'base'
  | 'standard'
  | 'reduced'
  | 'super_reduced'
  | 'exempt'
  | 'deemed_cost_general'
  | 'deemed_cost_retail'
  | 'monthly_flat';

/** Business type lookup record from tax_business_types table */
export interface TaxBusinessType {
  id: string;
  code: string;
  nameHu: string;
  description: string | null;
  sortOrder: number;
}

/** Year-specific tax rate from tax_rules table */
export interface TaxRule {
  id: string;
  businessType: BusinessType;
  year: number;
  ratePercent: number;
  rateLabel: TaxRateLabel | string;
  notes: string | null;
}

/** Eligibility thresholds from tax_eligibility_criteria table */
export interface TaxEligibilityCriteria {
  id: string;
  businessType: BusinessType;
  year: number;
  maxRevenueHuf: number | null;
  maxEmployees: number | null;
  conditionsJson: Record<string, unknown>;
}

/** Input for a tax calculation */
export interface TaxCalculationInput {
  businessType: BusinessType;
  year: number;
  revenue: number;
  expenses?: number;
  employeeCount?: number;
}

/** Breakdown of how a tax amount was computed */
export interface TaxBreakdown {
  revenue: number;
  deductibleExpenses: number;
  taxableBase: number;
  appliedRate: number;
  appliedRateLabel: TaxRateLabel | string;
}

/** Result of a tax calculation */
export interface TaxCalculationResult {
  businessType: BusinessType;
  year: number;
  taxAmount: number;
  effectiveRate: number;
  eligible: boolean;
  warnings: string[];
  breakdown: TaxBreakdown;
}

/** Persisted tax calculation audit record from tax_calculations table */
export interface TaxCalculationRecord {
  id: string;
  userId: string;
  businessType: BusinessType;
  year: number;
  revenue: number;
  expenses: number;
  taxAmount: number;
  calculationJson: TaxCalculationResult;
  createdAt: string;
}

/** User's chosen tax configuration from user_tax_settings table */
export interface UserTaxSettings {
  id: string;
  userId: string;
  businessType: BusinessType;
  year: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
