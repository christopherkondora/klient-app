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

export interface KivaResult {
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
  type: 'aam_limit' | 'atalany_limit' | 'deadline' | 'general';
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
}
