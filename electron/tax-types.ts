/**
 * Shared tax types for the electron process.
 * These mirror the types in src/types/tax.ts for use in the main process.
 */

export type VallalkozasTipus = 'EV' | 'Kft' | 'Bt' | 'Kkt';
export type AdozasForma = 'atalany' | 'vszja' | 'TAO' | 'KIVA';
export type FoglalkozasTipus = 'fofoglalkozasu' | 'mellekfoglalkozasu';
export type AfaBevallas = 'havi' | 'negyedeves' | 'eves';

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

export type KivaCompleteness = 'missing' | 'partial' | 'complete';
export type KivaPersonalPaymentsMode = 'auto' | 'manual' | 'auto_plus_manual';
export type KivaAdjustmentType = 'AAN' | 'AACS';

export interface KivaAdjustmentItem {
  id?: string;
  year: number;
  quarter?: 1 | 2 | 3 | 4;
  type: KivaAdjustmentType;
  category: string;
  amountHuf: number;
  note?: string | null;
}

export interface KivaPeriodInput {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  autoPersonalPaymentsHuf: number;
  manualPersonalPaymentsHuf?: number | null;
  personalPaymentsMode: KivaPersonalPaymentsMode;
  adjustments: KivaAdjustmentItem[];
}

export interface KivaPeriodResult {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  personalPaymentsHuf: number;
  aanTotalHuf: number;
  aacsTotalHuf: number;
  baseBeforeMinimumHuf: number;
  baseHuf: number;
  taxHuf: number;
  completeness: KivaCompleteness;
}

export interface KivaEstimateResult {
  year: number;
  periods: KivaPeriodResult[];
  annualPersonalPaymentsHuf: number;
  annualAanTotalHuf: number;
  annualAacsTotalHuf: number;
  annualBaseBeforeMinimumHuf: number;
  annualBaseHuf: number;
  annualTaxHuf: number;
  quarterlyAdvanceTaxHuf: number;
  settlementDifferenceHuf: number;
  completeness: KivaCompleteness;
  warnings: TaxWarning[];
}

export interface KivaResult extends KivaEstimateResult {
  szemelyiKifizetesek: number;
  osztalek: number;
  beruhazas: number;
  kivaAlap: number;
  kiva: number;
  osszesen: number;
}

export interface HipaResult {
  alap: number;
  kulcs: number;
  osszeg: number;
  egyszerusitett: boolean;
  modszer: string;
}

export interface HipaRate {
  megye: string;
  telepules: string;
  kulcs: number;
}

export interface QuarterBreakdown {
  quarter: 1 | 2 | 3 | 4;
  bevétel: number;
  szja: number;
  tb: number;
  szocho: number;
  hipa: number;
  osszesen: number;
}

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

export interface TaxWarning {
  type:
    | 'aam_limit'
    | 'atalany_limit'
    | 'deadline'
    | 'general'
    | 'kiva_missing_personal_payments'
    | 'kiva_auto_personal_payments'
    | 'kiva_manual_override'
    | 'kiva_adjustments_present'
    | 'kiva_minimum_base_applied'
    | 'kiva_external_fees_not_included'
    | 'kiva_revenue_limit_near'
    | 'kiva_revenue_limit_exceeded'
    | 'kiva_employee_limit_near'
    | 'kiva_employee_limit_exceeded';
  severity: 'info' | 'warning' | 'danger';
  message: string;
}

export interface TaxDeadline {
  date: string;
  type: 'szja' | 'afa' | 'hipa' | 'tao' | 'kiva' | 'szja_eves';
  description: string;
  color: string;
}

export interface TaxFormComparison {
  forma: AdozasForma;
  label: string;
  osszesen: number;
  reszletek: AtalanyadoResult | VszjaResult | TaoResult | KivaResult;
  status?: 'ready' | 'needs_data';
  note?: string;
}
