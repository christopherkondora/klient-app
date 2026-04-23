/** Hungarian business tax type identifiers, matching database IDs */
export enum BusinessType {
  KIVA = 'kiva',
  AFA = 'afa',
  AAM = 'aam',
  ATALANYADOZAS = 'atalanyadozas',
  KFT_TAO = 'kft_tao',
}

/** Vállalkozás típus */
export type VallalkozasTipus = 'EV' | 'Kft' | 'Bt' | 'Kkt';

/** Adózási forma */
export type AdozasForma = 'atalany' | 'vszja' | 'TAO' | 'KIVA';

/** Foglalkozás típus */
export type FoglalkozasTipus = 'fofoglalkozasu' | 'mellekfoglalkozasu';

/** ÁFA bevallás gyakoriság */
export type AfaBevallas = 'havi' | 'negyedeves' | 'eves';

/** Rate label categorization for tax rules */
export type TaxRateLabel =
  | 'base'
  | 'standard'
  | 'reduced'
  | 'super_reduced'
  | 'exempt'
  | 'deemed_cost_general'
  | 'deemed_cost_retail'
  | 'deemed_cost_kisker';

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

// ── New interfaces for the tax module ──

/** Yearly tax parameters from tax_parameters table */
export interface TaxParameters {
  year: number;
  minimalberHavi: number;
  garantaltBerminimumHavi: number;
  szjaKulcs: number;
  tbKulcs: number;
  szochoKulcs: number;
  taoKulcs: number;
  kivaKulcs: number;
  aamLimit: number;
  atalanyAltalanos: number;
  atalanySpecialis: number;
  atalanyKisker: number;
  atalanyLimitSzorzo: number;
  atalanyAdomentesSzorzo: number;
  szochoPlafonSzorzo: number;
  hipaMaxKulcs: number;
  afaStandard: number;
  afaReduced: number;
  afaSuperReduced: number;
}

/** User's business profile from business_profile table */
export interface BusinessProfile {
  userId: string;
  vallalkozasTipus: VallalkozasTipus;
  adozasForma: AdozasForma;
  foglalkozas: FoglalkozasTipus;
  koltseghanyad: number;
  szakkepzettseg: boolean;
  aamValasztott: boolean;
  afaBevallas: AfaBevallas;
  hipaKulcs: number;
  hipaTelepules: string;
  hipaEgyszeru: boolean;
  adoev: number;
  beallitva: boolean;
}

/** Átalányadó calculation result */
export interface AtalanyadoResult {
  bevétel: number;
  koltseghanyad: number;
  atalanyJovedelem: number;
  adomentesSav: number;
  adokotelesJovedelem: number;
  szja: number;
  jarulekAlap: number;
  tb: number;
  szochoAlap: number;
  szocho: number;
  osszesen: number;
}

/** VSZJA calculation result */
export interface VszjaResult {
  bevétel: number;
  koltsegek: number;
  vallalkozoiJovedelem: number;
  vallSzja: number;
  kivet: number;
  kivetSzja: number;
  kivetTb: number;
  kivetSzocho: number;
  osszesen: number;
}

/** TAO calculation result */
export interface TaoResult {
  bevétel: number;
  eredmeny: number;
  minimumAdoalap: number;
  taoAlap: number;
  tao: number;
  osztalek: number;
  osztalekSzja: number;
  osztalekSzocho: number;
  osszesen: number;
}

/** KIVA calculation result */
export interface KivaResult {
  szemelyiKifizetesek: number;
  osztalek: number;
  beruhazas: number;
  kivaAlap: number;
  kiva: number;
  osszesen: number;
}

/** HIPA calculation result */
export interface HipaResult {
  alap: number;
  kulcs: number;
  osszeg: number;
  egyszerusitett: boolean;
  modszer: string;
}

/** HIPA settlement rate */
export interface HipaRate {
  megye: string;
  telepules: string;
  kulcs: number;
}

/** Quarter breakdown for estimates */
export interface QuarterBreakdown {
  quarter: 1 | 2 | 3 | 4;
  bevétel: number;
  szja: number;
  tb: number;
  szocho: number;
  hipa: number;
  osszesen: number;
}

/** Full tax estimate */
export interface TaxEstimate {
  adoev: number;
  profil: BusinessProfile;
  evesBevétel: number;
  szja: number;
  tb: number;
  szocho: number;
  hipa: number;
  egyebAdo: number;
  osszesen: number;
  negyedevek: QuarterBreakdown[];
  reszletek: AtalanyadoResult | VszjaResult | TaoResult | KivaResult;
  hipaReszletek: HipaResult | null;
}

/** Tax warning / alert */
export interface TaxWarning {
  type: 'aam_limit' | 'atalany_limit' | 'deadline' | 'general';
  severity: 'info' | 'warning' | 'danger';
  message: string;
}

/** Tax deadline entry */
export interface TaxDeadline {
  date: string;
  type: 'szja' | 'afa' | 'hipa' | 'tao' | 'kiva' | 'szja_eves';
  description: string;
  color: string;
}

/** Tax form comparison result */
export interface TaxFormComparison {
  forma: AdozasForma;
  label: string;
  osszesen: number;
  reszletek: AtalanyadoResult | VszjaResult | TaoResult | KivaResult;
}
