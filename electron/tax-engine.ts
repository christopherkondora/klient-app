/**
 * Tax Engine — Pure calculation functions, zero DB/IPC dependency.
 * All monetary values are in HUF, rounded to whole forints.
 */

import type {
  TaxParameters,
  BusinessProfile,
  AtalanyadoResult,
  VszjaResult,
  TaoResult,
  KivaResult,
  HipaResult,
  TaxEstimate,
  QuarterBreakdown,
  TaxWarning,
  TaxDeadline,
  TaxFormComparison,
  KivaAdjustmentItem,
  KivaEstimateResult,
  KivaPeriodInput,
  KivaPeriodResult,
} from './tax-types';

// ── Helper ──

function round(n: number): number {
  return Math.round(n);
}

function derivedParams(p: TaxParameters) {
  const minEves = p.minimalberHavi * 12;
  const gbmEves = p.garantaltBerminimumHavi * 12;
  const atalanyLimit = minEves * p.atalanyLimitSzorzo;
  const adomentesSav = minEves * p.atalanyAdomentesSzorzo;
  const szochoPlafon = minEves * p.szochoPlafonSzorzo;
  return { minEves, gbmEves, atalanyLimit, adomentesSav, szochoPlafon };
}

// ── Átalányadó ──

export function calculateAtalanyado(
  bevétel: number,
  params: TaxParameters,
  profil: Pick<BusinessProfile, 'koltseghanyad' | 'foglalkozas' | 'szakkepzettseg'>
): AtalanyadoResult {
  const { minEves, gbmEves, adomentesSav, szochoPlafon } = derivedParams(params);
  const koltseghanyad = profil.koltseghanyad;

  // 1. Átalány jövedelem
  const atalanyJovedelem = round(bevétel * (1 - koltseghanyad));

  // 2. Adómentes sáv
  const adokotelesJovedelem = Math.max(0, atalanyJovedelem - adomentesSav);

  // 3. SZJA
  const szja = round(adokotelesJovedelem * params.szjaKulcs);

  // 4. Járulékok
  let jarulekAlap: number;
  let tb: number;
  let szochoAlap: number;
  let szocho: number;

  if (profil.foglalkozas === 'mellekfoglalkozasu') {
    // Mellékfoglalkozású: jövedelem alapú, adómentes sáv alatti → 0
    if (atalanyJovedelem <= adomentesSav) {
      jarulekAlap = 0;
      tb = 0;
      szochoAlap = 0;
      szocho = 0;
    } else {
      jarulekAlap = atalanyJovedelem;
      tb = round(jarulekAlap * params.tbKulcs);
      szochoAlap = Math.min(atalanyJovedelem, szochoPlafon);
      szocho = round(szochoAlap * params.szochoKulcs);
    }
  } else {
    // Főfoglalkozású: minimum járulék alap
    const minJarulekAlap = profil.szakkepzettseg ? gbmEves : minEves;
    jarulekAlap = Math.max(atalanyJovedelem, minJarulekAlap);
    tb = round(jarulekAlap * params.tbKulcs);
    szochoAlap = Math.min(Math.max(atalanyJovedelem, minJarulekAlap), szochoPlafon);
    szocho = round(szochoAlap * params.szochoKulcs);
  }

  const osszesen = szja + tb + szocho;

  return {
    bevétel,
    koltseghanyad,
    atalanyJovedelem,
    adomentesSav,
    adokotelesJovedelem,
    szja,
    jarulekAlap,
    tb,
    szochoAlap,
    szocho,
    osszesen,
  };
}

// ── VSZJA (Vállalkozói személyi jövedelemadó) ──

export function calculateVszja(
  bevétel: number,
  koltsegek: number,
  kivet: number,
  params: TaxParameters,
  profil: Pick<BusinessProfile, 'foglalkozas' | 'szakkepzettseg'>
): VszjaResult {
  const { minEves, gbmEves, szochoPlafon } = derivedParams(params);

  // 1. Vállalkozói jövedelem → vállalkozói SZJA (0.09, mint a TAO)
  const vallalkozoiJovedelem = Math.max(0, bevétel - koltsegek);
  const vallSzja = round(vallalkozoiJovedelem * 0.09);

  // 2. Kivét → személyi SZJA + járulékok
  const kivetSzja = round(kivet * params.szjaKulcs);

  let kivetTb: number;
  let kivetSzocho: number;

  if (profil.foglalkozas === 'mellekfoglalkozasu') {
    kivetTb = round(kivet * params.tbKulcs);
    kivetSzocho = round(Math.min(kivet, szochoPlafon) * params.szochoKulcs);
  } else {
    const minJarulekAlap = profil.szakkepzettseg ? gbmEves : minEves;
    const jarulekAlap = Math.max(kivet, minJarulekAlap);
    kivetTb = round(jarulekAlap * params.tbKulcs);
    kivetSzocho = round(Math.min(Math.max(kivet, minJarulekAlap), szochoPlafon) * params.szochoKulcs);
  }

  const osszesen = vallSzja + kivetSzja + kivetTb + kivetSzocho;

  return {
    bevétel,
    koltsegek,
    vallalkozoiJovedelem,
    vallSzja,
    kivet,
    kivetSzja,
    kivetTb,
    kivetSzocho,
    osszesen,
  };
}

// ── TAO (Társasági adó) ──

export function calculateTao(
  bevétel: number,
  eredmeny: number,
  osztalek: number,
  params: TaxParameters
): TaoResult {
  const { szochoPlafon } = derivedParams(params);

  // 1. Minimum adóalap = bevétel × 2%
  const minimumAdoalap = round(bevétel * 0.02);

  // 2. TAO = max(eredmény, min.alap) × 9%
  const taoAlap = Math.max(eredmeny, minimumAdoalap);
  const tao = round(taoAlap * params.taoKulcs);

  // 3. Osztalék: SZJA 15% + SZOCHO 13% (plafonig)
  const osztalekSzja = round(osztalek * params.szjaKulcs);
  const osztalekSzochoAlap = Math.min(osztalek, szochoPlafon);
  const osztalekSzocho = round(osztalekSzochoAlap * params.szochoKulcs);

  const osszesen = tao + osztalekSzja + osztalekSzocho;

  return {
    bevétel,
    eredmeny,
    minimumAdoalap,
    taoAlap,
    tao,
    osztalek,
    osztalekSzja,
    osztalekSzocho,
    osszesen,
  };
}

// ── KIVA (Kisvállalati adó) ──

export function calculateKiva(
  szemelyiKifizetesek: number,
  osztalek: number,
  beruhazas: number,
  params: TaxParameters
): KivaResult {
  const period = calculateKivaPeriod({
    year: params.year,
    quarter: 1,
    autoPersonalPaymentsHuf: szemelyiKifizetesek,
    manualPersonalPaymentsHuf: null,
    personalPaymentsMode: 'auto',
    adjustments: [
      { year: params.year, quarter: 1, type: 'AAN', category: 'legacy_osztalek', amountHuf: osztalek },
      { year: params.year, quarter: 1, type: 'AACS', category: 'legacy_beruhazas', amountHuf: beruhazas },
    ],
  }, params);

  const estimate = calculateKivaEstimate([{
    year: params.year,
    quarter: 1,
    autoPersonalPaymentsHuf: szemelyiKifizetesek,
    manualPersonalPaymentsHuf: null,
    personalPaymentsMode: 'auto',
    adjustments: [
      { year: params.year, quarter: 1, type: 'AAN', category: 'legacy_osztalek', amountHuf: osztalek },
      { year: params.year, quarter: 1, type: 'AACS', category: 'legacy_beruhazas', amountHuf: beruhazas },
    ],
  }], [], params);

  return {
    ...estimate,
    szemelyiKifizetesek,
    osztalek,
    beruhazas,
    kivaAlap: period.baseHuf,
    kiva: period.taxHuf,
    osszesen: period.taxHuf,
  };
}

export function calculateKivaPeriod(input: KivaPeriodInput, params: TaxParameters): KivaPeriodResult {
  const manual = input.manualPersonalPaymentsHuf ?? 0;
  let personalPaymentsHuf: number;

  switch (input.personalPaymentsMode) {
    case 'manual':
      personalPaymentsHuf = manual;
      break;
    case 'auto_plus_manual':
      personalPaymentsHuf = input.autoPersonalPaymentsHuf + manual;
      break;
    case 'auto':
    default:
      personalPaymentsHuf = input.autoPersonalPaymentsHuf;
      break;
  }

  const aanTotalHuf = sumKivaAdjustments(input.adjustments, 'AAN');
  const aacsTotalHuf = sumKivaAdjustments(input.adjustments, 'AACS');
  const baseBeforeMinimumHuf = personalPaymentsHuf + aanTotalHuf - aacsTotalHuf;
  const baseHuf = Math.max(personalPaymentsHuf, baseBeforeMinimumHuf);
  const taxHuf = round(baseHuf * params.kivaKulcs);

  const completeness = personalPaymentsHuf > 0 || input.adjustments.length > 0 ? 'complete' : 'missing';

  return {
    year: input.year,
    quarter: input.quarter,
    personalPaymentsHuf: round(personalPaymentsHuf),
    aanTotalHuf: round(aanTotalHuf),
    aacsTotalHuf: round(aacsTotalHuf),
    baseBeforeMinimumHuf: round(baseBeforeMinimumHuf),
    baseHuf: round(baseHuf),
    taxHuf,
    completeness,
  };
}

export function calculateKivaEstimate(
  periodInputs: KivaPeriodInput[],
  annualAdjustments: KivaAdjustmentItem[],
  params: TaxParameters
): KivaEstimateResult {
  const periods = periodInputs.map(input => calculateKivaPeriod(input, params));
  const annualOnlyAanTotal = sumKivaAdjustments(annualAdjustments, 'AAN');
  const annualOnlyAacsTotal = sumKivaAdjustments(annualAdjustments, 'AACS');

  const annualPersonalPaymentsHuf = periods.reduce((sum, period) => sum + period.personalPaymentsHuf, 0);
  const annualAanTotalHuf = periods.reduce((sum, period) => sum + period.aanTotalHuf, 0) + annualOnlyAanTotal;
  const annualAacsTotalHuf = periods.reduce((sum, period) => sum + period.aacsTotalHuf, 0) + annualOnlyAacsTotal;
  const annualBaseBeforeMinimumHuf = annualPersonalPaymentsHuf + annualAanTotalHuf - annualAacsTotalHuf;
  const annualBaseHuf = Math.max(annualPersonalPaymentsHuf, annualBaseBeforeMinimumHuf);
  const annualTaxHuf = round(annualBaseHuf * params.kivaKulcs);
  const quarterlyAdvanceTaxHuf = periods.reduce((sum, period) => sum + period.taxHuf, 0);
  const settlementDifferenceHuf = annualTaxHuf - quarterlyAdvanceTaxHuf;

  const warnings: TaxWarning[] = [];
  if (annualPersonalPaymentsHuf <= 0) {
    warnings.push({ type: 'kiva_missing_personal_payments', severity: 'warning', message: 'KIVA: nincs személyi jellegű kifizetés rögzítve vagy becsülve.' });
  }
  if (annualAanTotalHuf > 0 || annualAacsTotalHuf > 0) {
    warnings.push({ type: 'kiva_adjustments_present', severity: 'info', message: 'KIVA: AAN/AACS korrekciók módosítják az adóalapot.' });
  }
  if (annualBaseBeforeMinimumHuf < annualPersonalPaymentsHuf) {
    warnings.push({ type: 'kiva_minimum_base_applied', severity: 'info', message: 'KIVA: a minimum adóalap a személyi jellegű kifizetések összege.' });
  }

  const completeness = annualPersonalPaymentsHuf > 0
    ? (periods.some(period => period.completeness !== 'complete') ? 'partial' : 'complete')
    : 'missing';

  return {
    year: params.year,
    periods,
    annualPersonalPaymentsHuf: round(annualPersonalPaymentsHuf),
    annualAanTotalHuf: round(annualAanTotalHuf),
    annualAacsTotalHuf: round(annualAacsTotalHuf),
    annualBaseBeforeMinimumHuf: round(annualBaseBeforeMinimumHuf),
    annualBaseHuf: round(annualBaseHuf),
    annualTaxHuf,
    quarterlyAdvanceTaxHuf: round(quarterlyAdvanceTaxHuf),
    settlementDifferenceHuf: round(settlementDifferenceHuf),
    completeness,
    warnings,
  };
}

function sumKivaAdjustments(adjustments: KivaAdjustmentItem[], type: 'AAN' | 'AACS'): number {
  return adjustments
    .filter(adjustment => adjustment.type === type)
    .reduce((sum, adjustment) => sum + Math.max(0, adjustment.amountHuf || 0), 0);
}

// ── HIPA (Helyi iparűzési adó) ──

export function calculateHipa(
  bevétel: number,
  profil: Pick<BusinessProfile, 'adozasForma' | 'vallalkozasTipus' | 'hipaEgyszeru' | 'koltseghanyad'>,
  hipaKulcs: number,
  params: TaxParameters,
  kivaAlap?: number
): HipaResult {
  const kulcs = hipaKulcs / 100; // DB-ben százalékban van

  // EV átalány + egyszerűsített
  if (profil.vallalkozasTipus === 'EV' && profil.adozasForma === 'atalany' && profil.hipaEgyszeru) {
    let egyszeruAlap: number;
    if (bevétel <= 12_000_000) egyszeruAlap = 2_500_000;
    else if (bevétel <= 18_000_000) egyszeruAlap = 6_000_000;
    else if (bevétel <= 25_000_000) egyszeruAlap = 8_500_000;
    else egyszeruAlap = bevétel * (1 - profil.koltseghanyad) * 1.2;

    const osszeg = round(egyszeruAlap * kulcs);
    return { alap: egyszeruAlap, kulcs: hipaKulcs, osszeg, egyszerusitett: true, modszer: 'savos_egyszerusitett' };
  }

  // EV átalány normál: jövedelem × 1.2 × kulcs
  if (profil.vallalkozasTipus === 'EV' && profil.adozasForma === 'atalany') {
    const jovedelem = bevétel * (1 - profil.koltseghanyad);
    const alap = jovedelem * 1.2;
    const osszeg = round(alap * kulcs);
    return { alap, kulcs: hipaKulcs, osszeg, egyszerusitett: false, modszer: 'atalany_normal' };
  }

  // KIVA alany: kivaAlap × 1.2 × kulcs
  if (profil.adozasForma === 'KIVA' && kivaAlap !== undefined) {
    const alap = kivaAlap * 1.2;
    const osszeg = round(alap * kulcs);
    return { alap, kulcs: hipaKulcs, osszeg, egyszerusitett: false, modszer: 'kiva' };
  }

  // Általános: árbevétel × kulcs
  const osszeg = round(bevétel * kulcs);
  return { alap: bevétel, kulcs: hipaKulcs, osszeg, egyszerusitett: false, modszer: 'altalanos' };
}

// ── Full estimate ──

export function calculateFullEstimate(
  evesBevétel: number,
  profil: BusinessProfile,
  params: TaxParameters,
  negyedevesBevételek?: [number, number, number, number],
  koltsegek?: number,
  kivet?: number,
  szemelyiKifizetesek?: number,
  osztalek?: number,
  beruhazas?: number
): TaxEstimate {
  const qRevenues = negyedevesBevételek ?? distributeQuarters(evesBevétel);

  let szja = 0, tb = 0, szocho = 0, egyebAdo = 0;
  let reszletek: TaxEstimate['reszletek'];

  switch (profil.adozasForma) {
    case 'atalany': {
      const r = calculateAtalanyado(evesBevétel, params, profil);
      szja = r.szja;
      tb = r.tb;
      szocho = r.szocho;
      reszletek = r;
      break;
    }
    case 'vszja': {
      const r = calculateVszja(evesBevétel, koltsegek ?? 0, kivet ?? 0, params, profil);
      szja = r.vallSzja + r.kivetSzja;
      tb = r.kivetTb;
      szocho = r.kivetSzocho;
      reszletek = r;
      break;
    }
    case 'TAO': {
      const eredmeny = evesBevétel - (koltsegek ?? 0);
      const r = calculateTao(evesBevétel, eredmeny, osztalek ?? 0, params);
      egyebAdo = r.tao;
      szja = r.osztalekSzja;
      szocho = r.osztalekSzocho;
      reszletek = r;
      break;
    }
    case 'KIVA': {
      const r = calculateKiva(szemelyiKifizetesek ?? 0, osztalek ?? 0, beruhazas ?? 0, params);
      egyebAdo = r.kiva;
      reszletek = r;
      break;
    }
  }

  // HIPA
  let hipa = 0;
  let hipaReszletek: HipaResult | null = null;
  if (profil.hipaKulcs > 0) {
    const kivaAlap = profil.adozasForma === 'KIVA' && reszletek
      ? (reszletek as KivaResult).kivaAlap
      : undefined;
    hipaReszletek = calculateHipa(evesBevétel, profil, profil.hipaKulcs, params, kivaAlap);
    hipa = hipaReszletek.osszeg;
  }

  const osszesen = szja + tb + szocho + hipa + egyebAdo;

  // Quarter breakdown (proportional distribution)
  const totalQ = qRevenues.reduce((s, v) => s + v, 0) || 1;
  const negyedevek: QuarterBreakdown[] = qRevenues.map((qRev, i) => {
    const ratio = qRev / totalQ;
    return {
      quarter: (i + 1) as 1 | 2 | 3 | 4,
      bevétel: round(qRev),
      szja: round(szja * ratio),
      tb: round(tb * ratio),
      szocho: round(szocho * ratio),
      hipa: round(hipa * ratio),
      osszesen: round(osszesen * ratio),
    };
  });

  return {
    adoev: profil.adoev,
    profil,
    evesBevétel,
    szja,
    tb,
    szocho,
    hipa,
    egyebAdo,
    osszesen,
    negyedevek,
    reszletek: reszletek!,
    hipaReszletek,
  };
}

function distributeQuarters(total: number): [number, number, number, number] {
  const q = round(total / 4);
  return [q, q, q, total - 3 * q];
}

// ── Compare tax forms ──

export function compareTaxForms(
  bevétel: number,
  koltsegek: number,
  params: TaxParameters,
  hipaKulcs: number,
  profil: Pick<BusinessProfile, 'foglalkozas' | 'szakkepzettseg' | 'koltseghanyad'>,
  kivet?: number
): TaxFormComparison[] {
  const results: TaxFormComparison[] = [];

  // Átalány — felhasználó saját költséghányadával
  const atalanyProfil = { koltseghanyad: profil.koltseghanyad, foglalkozas: profil.foglalkozas, szakkepzettseg: profil.szakkepzettseg };
  const atalanyResult = calculateAtalanyado(bevétel, params, atalanyProfil);
  const atalanyHipa = calculateHipa(bevétel, { adozasForma: 'atalany', vallalkozasTipus: 'EV', hipaEgyszeru: false, koltseghanyad: profil.koltseghanyad }, hipaKulcs, params);
  results.push({
    forma: 'atalany',
    label: 'Átalányadó (EV)',
    osszesen: atalanyResult.osszesen + atalanyHipa.osszeg,
    reszletek: atalanyResult,
  });

  // VSZJA
  const vszjaProfil = { foglalkozas: profil.foglalkozas, szakkepzettseg: profil.szakkepzettseg };
  const vszjaResult = calculateVszja(bevétel, koltsegek, kivet ?? bevétel * 0.5, params, vszjaProfil);
  const vszjaHipa = calculateHipa(bevétel, { adozasForma: 'vszja', vallalkozasTipus: 'EV', hipaEgyszeru: false, koltseghanyad: 0 }, hipaKulcs, params);
  results.push({
    forma: 'vszja',
    label: 'VSZJA (EV)',
    osszesen: vszjaResult.osszesen + vszjaHipa.osszeg,
    reszletek: vszjaResult,
  });

  // TAO + osztalék
  const eredmeny = Math.max(0, bevétel - koltsegek);
  const osztalek = eredmeny * 0.7; // assume 70% dividend payout
  const taoResult = calculateTao(bevétel, eredmeny, osztalek, params);
  const taoHipa = calculateHipa(bevétel, { adozasForma: 'TAO', vallalkozasTipus: 'Kft', hipaEgyszeru: false, koltseghanyad: 0 }, hipaKulcs, params);
  results.push({
    forma: 'TAO',
    label: 'Kft (TAO + osztalék)',
    osszesen: taoResult.osszesen + taoHipa.osszeg,
    reszletek: taoResult,
  });

  return results;
}

// ── Tax deadlines ──

export function generateTaxDeadlines(
  profil: BusinessProfile,
  adoev: number
): TaxDeadline[] {
  const deadlines: TaxDeadline[] = [];

  if (profil.vallalkozasTipus === 'EV') {
    // EV negyedéves SZJA+járulék előleg
    deadlines.push(
      { date: `${adoev}-04-12`, type: 'szja', description: 'SZJA + járulék előleg (Q1)', color: '#f97316' },
      { date: `${adoev}-07-12`, type: 'szja', description: 'SZJA + járulék előleg (Q2)', color: '#f97316' },
      { date: `${adoev}-10-12`, type: 'szja', description: 'SZJA + járulék előleg (Q3)', color: '#f97316' },
      { date: `${adoev + 1}-01-12`, type: 'szja', description: 'SZJA + járulék előleg (Q4)', color: '#f97316' },
    );

    // SZJA éves bevallás
    deadlines.push(
      { date: `${adoev + 1}-05-20`, type: 'szja_eves', description: `${adoev} éves SZJA bevallás`, color: '#ef4444' },
    );
  }

  if (profil.vallalkozasTipus === 'Kft' || profil.vallalkozasTipus === 'Bt' || profil.vallalkozasTipus === 'Kkt') {
    if (profil.adozasForma === 'TAO') {
      deadlines.push(
        { date: `${adoev}-04-20`, type: 'tao', description: 'TAO előleg (Q1)', color: '#a855f7' },
        { date: `${adoev}-07-20`, type: 'tao', description: 'TAO előleg (Q2)', color: '#a855f7' },
        { date: `${adoev}-10-20`, type: 'tao', description: 'TAO előleg (Q3)', color: '#a855f7' },
        { date: `${adoev + 1}-01-20`, type: 'tao', description: 'TAO előleg (Q4)', color: '#a855f7' },
      );
      deadlines.push(
        { date: `${adoev + 1}-05-31`, type: 'tao', description: `${adoev} TAO éves bevallás`, color: '#a855f7' },
      );
    }

    if (profil.adozasForma === 'KIVA') {
      deadlines.push(
        { date: `${adoev}-04-20`, type: 'kiva', description: 'KIVA előleg (Q1)', color: '#124559' },
        { date: `${adoev}-07-20`, type: 'kiva', description: 'KIVA előleg (Q2)', color: '#124559' },
        { date: `${adoev}-10-20`, type: 'kiva', description: 'KIVA előleg (Q3)', color: '#124559' },
        { date: `${adoev + 1}-01-20`, type: 'kiva', description: 'KIVA előleg (Q4)', color: '#124559' },
      );
      deadlines.push(
        { date: `${adoev + 1}-05-31`, type: 'kiva', description: `${adoev} KIVA éves bevallás`, color: '#124559' },
      );
    }
  }

  // ÁFA bevallás
  if (!profil.aamValasztott) {
    switch (profil.afaBevallas) {
      case 'havi':
        for (let m = 1; m <= 12; m++) {
          const next = m === 12 ? `${adoev + 1}-01-20` : `${adoev}-${String(m + 1).padStart(2, '0')}-20`;
          deadlines.push({ date: next, type: 'afa', description: `ÁFA bevallás (${adoev}.${String(m).padStart(2, '0')})`, color: '#3b82f6' });
        }
        break;
      case 'negyedeves':
        deadlines.push(
          { date: `${adoev}-04-20`, type: 'afa', description: 'ÁFA bevallás (Q1)', color: '#3b82f6' },
          { date: `${adoev}-07-20`, type: 'afa', description: 'ÁFA bevallás (Q2)', color: '#3b82f6' },
          { date: `${adoev}-10-20`, type: 'afa', description: 'ÁFA bevallás (Q3)', color: '#3b82f6' },
          { date: `${adoev + 1}-01-20`, type: 'afa', description: 'ÁFA bevallás (Q4)', color: '#3b82f6' },
        );
        break;
      case 'eves':
        deadlines.push(
          { date: `${adoev + 1}-02-25`, type: 'afa', description: `${adoev} ÁFA éves bevallás`, color: '#3b82f6' },
        );
        break;
    }
  }

  // HIPA
  if (profil.hipaKulcs > 0) {
    deadlines.push(
      { date: `${adoev}-03-15`, type: 'hipa', description: 'HIPA előleg (1. félév)', color: '#22c55e' },
      { date: `${adoev}-09-15`, type: 'hipa', description: 'HIPA előleg (2. félév)', color: '#22c55e' },
      { date: `${adoev + 1}-05-31`, type: 'hipa', description: `${adoev} HIPA éves bevallás`, color: '#22c55e' },
    );
  }

  return deadlines.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Warnings ──

export function generateTaxWarnings(
  bevétel: number,
  profil: BusinessProfile,
  params: TaxParameters
): TaxWarning[] {
  const warnings: TaxWarning[] = [];
  const { atalanyLimit } = derivedParams(params);

  // AAM limit
  if (profil.aamValasztott) {
    const ratio = bevétel / params.aamLimit;
    if (ratio > 1) {
      warnings.push({ type: 'aam_limit', severity: 'danger', message: `AAM határ túllépve! Bevétel ${round(bevétel / 1_000_000)}M Ft > ${round(params.aamLimit / 1_000_000)}M Ft limit` });
    } else if (ratio >= 0.8) {
      warnings.push({ type: 'aam_limit', severity: 'warning', message: `AAM határ közelében: ${round(ratio * 100)}% kihasználva (${round(bevétel / 1_000_000)}M / ${round(params.aamLimit / 1_000_000)}M Ft)` });
    }
  }

  // Átalány limit
  if (profil.adozasForma === 'atalany') {
    const ratio = bevétel / atalanyLimit;
    if (ratio > 1) {
      warnings.push({ type: 'atalany_limit', severity: 'danger', message: `Átalányadó bevételi határ túllépve! ${round(bevétel / 1_000_000)}M Ft > ${round(atalanyLimit / 1_000_000)}M Ft limit` });
    } else if (ratio >= 0.8) {
      warnings.push({ type: 'atalany_limit', severity: 'warning', message: `Átalány határ közelében: ${round(ratio * 100)}% (${round(bevétel / 1_000_000)}M / ${round(atalanyLimit / 1_000_000)}M Ft)` });
    }
  }

  return warnings;
}
