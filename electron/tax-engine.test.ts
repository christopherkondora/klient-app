import { describe, it, expect } from 'vitest';
import {
  calculateAtalanyado,
  calculateVszja,
  calculateTao,
  calculateKiva,
  calculateHipa,
  calculateFullEstimate,
  compareTaxForms,
  generateTaxDeadlines,
  generateTaxWarnings,
} from './tax-engine';
import type { TaxParameters, BusinessProfile } from './tax-types';

// ── Shared fixtures ──

const p2026: TaxParameters = {
  year: 2026,
  minimalberHavi: 322_800,
  garantaltBerminimumHavi: 373_200,
  szjaKulcs: 0.15,
  tbKulcs: 0.185,
  szochoKulcs: 0.13,
  taoKulcs: 0.09,
  kivaKulcs: 0.10,
  aamLimit: 20_000_000,
  atalanyAltalanos: 0.45,
  atalanySpecialis: 0.80,
  atalanyKisker: 0.90,
  atalanyLimitSzorzo: 5.167,
  atalanyAdomentesSzorzo: 1,
  szochoPlafonSzorzo: 24,
  hipaMaxKulcs: 2.0,
  afaStandard: 0.27,
  afaReduced: 0.18,
  afaSuperReduced: 0.05,
};

const minEves = p2026.minimalberHavi * 12;      // 3_873_600
const gbmEves = p2026.garantaltBerminimumHavi * 12; // 4_478_400
const adomentesSav = minEves * p2026.atalanyAdomentesSzorzo; // 3_873_600
const szochoPlafon = minEves * p2026.szochoPlafonSzorzo;     // 92_966_400

// ── Átalányadó ──

describe('calculateAtalanyado', () => {
  it('főfoglalkozású, szakkepzettseg=false, general 45%', () => {
    const r = calculateAtalanyado(15_000_000, p2026, {
      koltseghanyad: 0.45,
      foglalkozas: 'fofoglalkozasu',
      szakkepzettseg: false,
    });
    // income = 15M * 0.55 = 8_250_000
    expect(r.atalanyJovedelem).toBe(8_250_000);
    // taxable = 8_250_000 - 3_873_600 = 4_376_400
    expect(r.adokotelesJovedelem).toBe(4_376_400);
    // szja = 4_376_400 * 0.15 = 656_460
    expect(r.szja).toBe(656_460);
    // járulék alap = max(8_250_000, minEves=3_873_600) = 8_250_000
    expect(r.jarulekAlap).toBe(8_250_000);
    // tb = 8_250_000 * 0.185 = 1_526_250
    expect(r.tb).toBe(1_526_250);
    // szocho alap = min(8_250_000, szochoPlafon) = 8_250_000
    expect(r.szochoAlap).toBe(8_250_000);
    // szocho = 8_250_000 * 0.13 = 1_072_500
    expect(r.szocho).toBe(1_072_500);
    expect(r.osszesen).toBe(656_460 + 1_526_250 + 1_072_500);
  });

  it('főfogl, szakkepzettseg=true uses GBM as minimum', () => {
    const r = calculateAtalanyado(2_000_000, p2026, {
      koltseghanyad: 0.45,
      foglalkozas: 'fofoglalkozasu',
      szakkepzettseg: true,
    });
    // income = 2M * 0.55 = 1_100_000
    expect(r.atalanyJovedelem).toBe(1_100_000);
    // taxable = max(0, 1_100_000 - 3_873_600) = 0
    expect(r.adokotelesJovedelem).toBe(0);
    expect(r.szja).toBe(0);
    // járulék alap = max(1_100_000, gbmEves=4_478_400) = 4_478_400
    expect(r.jarulekAlap).toBe(gbmEves);
    expect(r.tb).toBe(Math.round(gbmEves * 0.185));
  });

  it('mellékfoglalkozású below tax-free threshold', () => {
    const r = calculateAtalanyado(5_000_000, p2026, {
      koltseghanyad: 0.45,
      foglalkozas: 'mellekfoglalkozasu',
      szakkepzettseg: false,
    });
    // income = 5M * 0.55 = 2_750_000 < adomentesSav = 3_873_600
    expect(r.atalanyJovedelem).toBe(2_750_000);
    expect(r.adokotelesJovedelem).toBe(0);
    expect(r.szja).toBe(0);
    // mellekfogl + under threshold → no contributions
    expect(r.tb).toBe(0);
    expect(r.szocho).toBe(0);
    expect(r.osszesen).toBe(0);
  });

  it('mellékfoglalkozású above threshold pays contributions', () => {
    const r = calculateAtalanyado(15_000_000, p2026, {
      koltseghanyad: 0.45,
      foglalkozas: 'mellekfoglalkozasu',
      szakkepzettseg: false,
    });
    // income = 8_250_000 > adomentesSav
    expect(r.atalanyJovedelem).toBe(8_250_000);
    expect(r.adokotelesJovedelem).toBe(4_376_400);
    expect(r.jarulekAlap).toBe(8_250_000);
    expect(r.tb).toBe(Math.round(8_250_000 * 0.185));
    expect(r.szocho).toBe(Math.round(8_250_000 * 0.13));
  });

  it('kisker 90% cost rate', () => {
    const r = calculateAtalanyado(15_000_000, p2026, {
      koltseghanyad: 0.90,
      foglalkozas: 'fofoglalkozasu',
      szakkepzettseg: false,
    });
    // income = 15M * 0.10 = 1_500_000
    expect(r.atalanyJovedelem).toBe(1_500_000);
    expect(r.adokotelesJovedelem).toBe(0); // under tax-free threshold
    expect(r.szja).toBe(0);
  });
});

// ── VSZJA ──

describe('calculateVszja', () => {
  it('calculates with kivét and expenses', () => {
    const r = calculateVszja(15_000_000, 5_000_000, 6_000_000, p2026, {
      foglalkozas: 'fofoglalkozasu',
      szakkepzettseg: false,
    });
    // vállalkozói jövedelem = 15M - 5M = 10M → vszja = 10M × 0.09 = 900_000
    expect(r.vallalkozoiJovedelem).toBe(10_000_000);
    expect(r.vallSzja).toBe(900_000);
    // kivét = 6M → szja = 6M × 0.15 = 900_000
    expect(r.kivetSzja).toBe(900_000);
    // tb = max(6M, minEves) × 0.185 = 6M × 0.185 = 1_110_000
    expect(r.kivetTb).toBe(Math.round(6_000_000 * 0.185));
    // szocho = min(max(6M, minEves), szochoPlafon) × 0.13 = 6M × 0.13 = 780_000
    expect(r.kivetSzocho).toBe(Math.round(6_000_000 * 0.13));
  });

  it('mellékfoglalkozású uses actual kivét as base', () => {
    const r = calculateVszja(10_000_000, 3_000_000, 2_000_000, p2026, {
      foglalkozas: 'mellekfoglalkozasu',
      szakkepzettseg: false,
    });
    expect(r.kivetTb).toBe(Math.round(2_000_000 * 0.185));
    expect(r.kivetSzocho).toBe(Math.round(2_000_000 * 0.13));
  });

  it('expenses exceeding revenue → 0 vállalkozói jövedelem', () => {
    const r = calculateVszja(5_000_000, 8_000_000, 3_000_000, p2026, {
      foglalkozas: 'fofoglalkozasu',
      szakkepzettseg: false,
    });
    expect(r.vallalkozoiJovedelem).toBe(0);
    expect(r.vallSzja).toBe(0);
  });
});

// ── TAO ──

describe('calculateTao', () => {
  it('calculates TAO 9% with minimum base and dividend taxes', () => {
    const r = calculateTao(20_000_000, 8_000_000, 5_000_000, p2026);
    // min.alap = 20M × 0.02 = 400_000
    expect(r.minimumAdoalap).toBe(400_000);
    // taoAlap = max(8M, 400K) = 8M
    expect(r.taoAlap).toBe(8_000_000);
    // tao = 8M × 0.09 = 720_000
    expect(r.tao).toBe(720_000);
    // osztalék szja = 5M × 0.15 = 750_000
    expect(r.osztalekSzja).toBe(750_000);
    // osztalék szocho = min(5M, szochoPlafon) × 0.13 = 5M × 0.13 = 650_000
    expect(r.osztalekSzocho).toBe(650_000);
    expect(r.osszesen).toBe(720_000 + 750_000 + 650_000);
  });

  it('uses minimum base when result is below 2%', () => {
    const r = calculateTao(50_000_000, 100_000, 0, p2026);
    // min = 50M × 0.02 = 1_000_000 > eredmény 100K
    expect(r.taoAlap).toBe(1_000_000);
    expect(r.tao).toBe(90_000);
  });
});

// ── KIVA ──

describe('calculateKiva', () => {
  it('pays 10% on the higher of personnel costs vs adjusted', () => {
    const r = calculateKiva(10_000_000, 2_000_000, 1_000_000, p2026);
    // adjusted = 10M + 2M - 1M = 11M
    // kivaAlap = max(10M, 11M) = 11M
    expect(r.kivaAlap).toBe(11_000_000);
    // kiva = 11M × 0.10 = 1_100_000
    expect(r.kiva).toBe(1_100_000);
    expect(r.osszesen).toBe(1_100_000);
  });

  it('uses personnel costs when adjusted is lower', () => {
    const r = calculateKiva(10_000_000, 0, 5_000_000, p2026);
    // adjusted = 10M + 0 - 5M = 5M
    // kivaAlap = max(10M, 5M) = 10M
    expect(r.kivaAlap).toBe(10_000_000);
    expect(r.kiva).toBe(1_000_000);
  });
});

// ── HIPA ──

describe('calculateHipa', () => {
  it('EV átalány egyszerűsített — sávos, low bracket', () => {
    const r = calculateHipa(10_000_000, {
      adozasForma: 'atalany', vallalkozasTipus: 'EV', hipaEgyszeru: true, koltseghanyad: 0.45,
    }, 2.0, p2026);
    // ≤12M bracket → alap=2_500_000
    expect(r.alap).toBe(2_500_000);
    expect(r.osszeg).toBe(Math.round(2_500_000 * 0.02));
    expect(r.modszer).toBe('savos_egyszerusitett');
  });

  it('EV átalány egyszerűsített — high revenue fallback', () => {
    const r = calculateHipa(30_000_000, {
      adozasForma: 'atalany', vallalkozasTipus: 'EV', hipaEgyszeru: true, koltseghanyad: 0.45,
    }, 2.0, p2026);
    // >25M → alap = 30M × 0.55 × 1.2 = 19_800_000
    expect(r.alap).toBe(19_800_000);
    expect(r.modszer).toBe('savos_egyszerusitett');
  });

  it('EV átalány normál', () => {
    const r = calculateHipa(15_000_000, {
      adozasForma: 'atalany', vallalkozasTipus: 'EV', hipaEgyszeru: false, koltseghanyad: 0.45,
    }, 2.0, p2026);
    // alap = 15M × 0.55 × 1.2 = 9_900_000
    expect(r.alap).toBe(9_900_000);
    expect(r.osszeg).toBe(Math.round(9_900_000 * 0.02));
    expect(r.modszer).toBe('atalany_normal');
  });

  it('KIVA method', () => {
    const r = calculateHipa(0, {
      adozasForma: 'KIVA', vallalkozasTipus: 'Kft', hipaEgyszeru: false, koltseghanyad: 0,
    }, 1.5, p2026, 10_000_000);
    // alap = 10M × 1.2 = 12M
    expect(r.alap).toBe(12_000_000);
    expect(r.osszeg).toBe(Math.round(12_000_000 * 0.015));
    expect(r.modszer).toBe('kiva');
  });

  it('általános method', () => {
    const r = calculateHipa(20_000_000, {
      adozasForma: 'TAO', vallalkozasTipus: 'Kft', hipaEgyszeru: false, koltseghanyad: 0,
    }, 2.0, p2026);
    expect(r.alap).toBe(20_000_000);
    expect(r.osszeg).toBe(400_000);
    expect(r.modszer).toBe('altalanos');
  });
});

// ── compareTaxForms ──

describe('compareTaxForms', () => {
  it('returns 3 forms: átalány, VSZJA, TAO', () => {
    const results = compareTaxForms(15_000_000, 5_000_000, p2026, 2.0, { foglalkozas: 'fofoglalkozasu', szakkepzettseg: false, koltseghanyad: 0.45 });
    expect(results).toHaveLength(3);
    expect(results.map(r => r.forma)).toEqual(['atalany', 'vszja', 'TAO']);
    results.forEach(r => {
      expect(r.osszesen).toBeGreaterThan(0);
      expect(r.label).toBeTruthy();
    });
  });
});

// ── generateTaxDeadlines ──

describe('generateTaxDeadlines', () => {
  const baseProfil: BusinessProfile = {
    userId: 'u1',
    vallalkozasTipus: 'EV',
    adozasForma: 'atalany',
    koltseghanyad: 0.45,
    foglalkozas: 'fofoglalkozasu',
    szakkepzettseg: false,
    aamValasztott: false,
    afaBevallas: 'negyedeves',
    hipaTelepules: 'Budapest',
    hipaKulcs: 2.0,
    hipaEgyszeru: true,
    adoev: 2026,
    beallitva: true,
  };

  it('EV generates SZJA quarterly + annual + ÁFA quarterly + HIPA', () => {
    const deadlines = generateTaxDeadlines(baseProfil, 2026);
    const types = deadlines.map(d => d.type);
    expect(types.filter(t => t === 'szja')).toHaveLength(4);
    expect(types.filter(t => t === 'szja_eves')).toHaveLength(1);
    expect(types.filter(t => t === 'afa')).toHaveLength(4);
    expect(types.filter(t => t === 'hipa')).toHaveLength(3);
    // Must be sorted by date
    for (let i = 1; i < deadlines.length; i++) {
      expect(deadlines[i].date >= deadlines[i - 1].date).toBe(true);
    }
  });

  it('AAM chosen → no ÁFA deadlines', () => {
    const profil = { ...baseProfil, aamValasztott: true };
    const deadlines = generateTaxDeadlines(profil, 2026);
    expect(deadlines.filter(d => d.type === 'afa')).toHaveLength(0);
  });

  it('Kft TAO generates TAO quarterly + annual', () => {
    const profil: BusinessProfile = {
      ...baseProfil,
      vallalkozasTipus: 'Kft',
      adozasForma: 'TAO',
      hipaKulcs: 0,
    };
    const deadlines = generateTaxDeadlines(profil, 2026);
    expect(deadlines.filter(d => d.type === 'tao')).toHaveLength(5); // 4 quarterly + 1 annual
    expect(deadlines.filter(d => d.type === 'szja')).toHaveLength(0);
  });

  it('Kft KIVA generates KIVA quarterly + annual', () => {
    const profil: BusinessProfile = {
      ...baseProfil,
      vallalkozasTipus: 'Kft',
      adozasForma: 'KIVA',
      hipaKulcs: 0,
    };
    const deadlines = generateTaxDeadlines(profil, 2026);
    expect(deadlines.filter(d => d.type === 'kiva')).toHaveLength(5);
  });

  it('havi ÁFA generates 12 monthly deadlines', () => {
    const profil = { ...baseProfil, afaBevallas: 'havi' as const };
    const deadlines = generateTaxDeadlines(profil, 2026);
    expect(deadlines.filter(d => d.type === 'afa')).toHaveLength(12);
  });

  it('éves ÁFA generates 1 deadline', () => {
    const profil = { ...baseProfil, afaBevallas: 'eves' as const };
    const deadlines = generateTaxDeadlines(profil, 2026);
    expect(deadlines.filter(d => d.type === 'afa')).toHaveLength(1);
  });

  it('no HIPA when kulcs=0', () => {
    const profil = { ...baseProfil, hipaKulcs: 0 };
    const deadlines = generateTaxDeadlines(profil, 2026);
    expect(deadlines.filter(d => d.type === 'hipa')).toHaveLength(0);
  });
});

// ── generateTaxWarnings ──

describe('generateTaxWarnings', () => {
  const baseProfil: BusinessProfile = {
    userId: 'u1',
    vallalkozasTipus: 'EV',
    adozasForma: 'atalany',
    koltseghanyad: 0.45,
    foglalkozas: 'fofoglalkozasu',
    szakkepzettseg: false,
    aamValasztott: true,
    afaBevallas: 'negyedeves',
    hipaTelepules: '',
    hipaKulcs: 0,
    hipaEgyszeru: false,
    adoev: 2026,
    beallitva: true,
  };

  it('warning at 80% of AAM limit', () => {
    const w = generateTaxWarnings(16_500_000, baseProfil, p2026);
    expect(w.some(x => x.type === 'aam_limit' && x.severity === 'warning')).toBe(true);
  });

  it('danger when AAM limit exceeded', () => {
    const w = generateTaxWarnings(21_000_000, baseProfil, p2026);
    expect(w.some(x => x.type === 'aam_limit' && x.severity === 'danger')).toBe(true);
  });

  it('no AAM warning when not chosen', () => {
    const profil = { ...baseProfil, aamValasztott: false };
    const w = generateTaxWarnings(21_000_000, profil, p2026);
    expect(w.filter(x => x.type === 'aam_limit')).toHaveLength(0);
  });
});
