import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db-helpers
vi.mock('./db-helpers', () => ({
  queryAll: vi.fn(),
  queryOne: vi.fn(),
  execute: vi.fn(),
}));

// Mock database
vi.mock('./database', () => ({
  getCurrentUserId: vi.fn(),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-1234'),
}));

import { queryAll, queryOne, execute } from './db-helpers';
import { getCurrentUserId } from './database';
import {
  resolveTaxRules,
  checkEligibility,
  calculateTax,
  getAvailableTaxTypes,
  getAllBusinessTypes,
  getUserTaxSettings,
  setUserTaxSettings,
  getTaxCalculationHistory,
  type TaxCalcInput,
} from './tax-service';

const mockQueryAll = vi.mocked(queryAll);
const mockQueryOne = vi.mocked(queryOne);
const mockExecute = vi.mocked(execute);
const mockGetCurrentUserId = vi.mocked(getCurrentUserId);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── resolveTaxRules ──────────────────────────────────────────────

describe('resolveTaxRules', () => {
  it('returns tax rules for a given business type and year', () => {
    const mockRules = [
      { id: '1', business_type: 'kiva', year: 2026, rate_percent: 11, rate_label: 'base', notes: null },
    ];
    mockQueryAll.mockReturnValue(mockRules);

    const result = resolveTaxRules('kiva', 2026);

    expect(mockQueryAll).toHaveBeenCalledWith(
      'SELECT * FROM tax_rules WHERE business_type = ? AND year = ?',
      ['kiva', 2026]
    );
    expect(result).toEqual(mockRules);
  });

  it('returns empty array when no rules found', () => {
    mockQueryAll.mockReturnValue([]);
    const result = resolveTaxRules('unknown', 2026);
    expect(result).toEqual([]);
  });
});

// ─── checkEligibility ─────────────────────────────────────────────

describe('checkEligibility', () => {
  it('returns eligible when no criteria row exists', () => {
    mockQueryOne.mockReturnValue(undefined);
    const result = checkEligibility('kiva', 10_000_000);
    expect(result).toEqual({ eligible: true, reasons: [] });
  });

  it('disqualifies when revenue exceeds max', () => {
    mockQueryOne.mockReturnValue({
      id: '1',
      business_type: 'kata',
      year: 2026,
      max_revenue_huf: 18_000_000,
      max_employees: null,
      conditions_json: '{}',
    });

    const result = checkEligibility('kata', 20_000_000, undefined, 2026);
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain('Bevétel meghaladja a maximumot: 18M Ft');
  });

  it('stays eligible when revenue is within limit', () => {
    mockQueryOne.mockReturnValue({
      id: '1',
      business_type: 'kata',
      year: 2026,
      max_revenue_huf: 18_000_000,
      max_employees: null,
      conditions_json: '{}',
    });

    const result = checkEligibility('kata', 15_000_000, undefined, 2026);
    expect(result.eligible).toBe(true);
  });

  it('disqualifies when employee count exceeds max', () => {
    mockQueryOne.mockReturnValue({
      id: '1',
      business_type: 'kiva',
      year: 2026,
      max_revenue_huf: null,
      max_employees: 50,
      conditions_json: '{}',
    });

    const result = checkEligibility('kiva', 5_000_000, 55, 2026);
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain('Alkalmazottak száma meghaladja a maximumot: 50 fő');
  });

  it('stays eligible when employee count is within limit', () => {
    mockQueryOne.mockReturnValue({
      id: '1',
      business_type: 'kiva',
      year: 2026,
      max_revenue_huf: null,
      max_employees: 50,
      conditions_json: '{}',
    });

    const result = checkEligibility('kiva', 5_000_000, 30, 2026);
    expect(result.eligible).toBe(true);
  });

  it('does not disqualify when employeeCount is undefined', () => {
    mockQueryOne.mockReturnValue({
      id: '1',
      business_type: 'kiva',
      year: 2026,
      max_revenue_huf: null,
      max_employees: 50,
      conditions_json: '{}',
    });

    const result = checkEligibility('kiva', 5_000_000, undefined, 2026);
    expect(result.eligible).toBe(true);
  });

  it('adds entity type note but does not disqualify', () => {
    mockQueryOne.mockReturnValue({
      id: '1',
      business_type: 'kata',
      year: 2026,
      max_revenue_huf: null,
      max_employees: null,
      conditions_json: '{"entity_type": "egyeni_vallalkozo"}',
    });

    const result = checkEligibility('kata', 5_000_000, undefined, 2026);
    expect(result.eligible).toBe(true);
    expect(result.reasons).toContain('Csak egyéni vállalkozóknak elérhető');
  });

  it('uses current year as default', () => {
    mockQueryOne.mockReturnValue(undefined);
    checkEligibility('kiva', 5_000_000);
    const currentYear = new Date().getFullYear();
    expect(mockQueryOne).toHaveBeenCalledWith(
      expect.any(String),
      ['kiva', currentYear]
    );
  });

  it('handles both revenue and employee disqualifiers', () => {
    mockQueryOne.mockReturnValue({
      id: '1',
      business_type: 'kiva',
      year: 2026,
      max_revenue_huf: 10_000_000,
      max_employees: 5,
      conditions_json: '{}',
    });

    const result = checkEligibility('kiva', 20_000_000, 10, 2026);
    expect(result.eligible).toBe(false);
    expect(result.reasons).toHaveLength(2);
  });

  it('handles null conditions_json gracefully', () => {
    mockQueryOne.mockReturnValue({
      id: '1',
      business_type: 'kata',
      year: 2026,
      max_revenue_huf: null,
      max_employees: null,
      conditions_json: null,
    });

    const result = checkEligibility('kata', 5_000_000, undefined, 2026);
    expect(result.eligible).toBe(true);
  });
});

// ─── calculateTax ─────────────────────────────────────────────────

describe('calculateTax', () => {
  // Helper to set up mocks for a basic calculation
  function setupCalculation(
    businessType: string,
    rules: Array<{ rate_percent: number; rate_label: string }>,
    eligibilityRow?: Record<string, unknown>
  ) {
    mockQueryAll.mockReturnValue(
      rules.map((r, i) => ({
        id: String(i),
        business_type: businessType,
        year: 2026,
        ...r,
        notes: null,
      }))
    );
    mockQueryOne.mockReturnValue(eligibilityRow);
    mockGetCurrentUserId.mockReturnValue(null);
  }

  // ── Input validation ──

  describe('input validation', () => {
    it('throws on empty businessType', () => {
      expect(() => calculateTax({ businessType: '', year: 2026, revenue: 100 })).toThrow('Érvénytelen adótípus');
    });

    it('throws on non-string businessType', () => {
      expect(() => calculateTax({ businessType: 123 as any, year: 2026, revenue: 100 })).toThrow('Érvénytelen adótípus');
    });

    it('throws on negative revenue', () => {
      expect(() => calculateTax({ businessType: 'kiva', year: 2026, revenue: -1 })).toThrow('A bevétel nem lehet negatív');
    });

    it('throws on non-number revenue', () => {
      expect(() => calculateTax({ businessType: 'kiva', year: 2026, revenue: '100' as any })).toThrow('A bevétel nem lehet negatív');
    });

    it('throws on negative expenses', () => {
      expect(() => calculateTax({ businessType: 'kiva', year: 2026, revenue: 100, expenses: -1 })).toThrow('A kiadások nem lehetnek negatívak');
    });

    it('throws on non-number expenses', () => {
      expect(() => calculateTax({ businessType: 'kiva', year: 2026, revenue: 100, expenses: '50' as any })).toThrow('A kiadások nem lehetnek negatívak');
    });

    it('throws on year below 2020', () => {
      expect(() => calculateTax({ businessType: 'kiva', year: 2019, revenue: 100 })).toThrow('Érvénytelen év');
    });

    it('throws on year above 2100', () => {
      expect(() => calculateTax({ businessType: 'kiva', year: 2101, revenue: 100 })).toThrow('Érvénytelen év');
    });

    it('throws on non-number year', () => {
      expect(() => calculateTax({ businessType: 'kiva', year: '2026' as any, revenue: 100 })).toThrow('Érvénytelen év');
    });

    it('throws on negative employee count', () => {
      expect(() => calculateTax({ businessType: 'kiva', year: 2026, revenue: 100, employeeCount: -1 })).toThrow('Az alkalmazottak száma');
    });

    it('throws on non-integer employee count', () => {
      expect(() => calculateTax({ businessType: 'kiva', year: 2026, revenue: 100, employeeCount: 2.5 })).toThrow('Az alkalmazottak száma');
    });

    it('throws on non-number employee count', () => {
      expect(() => calculateTax({ businessType: 'kiva', year: 2026, revenue: 100, employeeCount: '3' as any })).toThrow('Az alkalmazottak száma');
    });

    it('accepts undefined employeeCount', () => {
      setupCalculation('kiva', [{ rate_percent: 11, rate_label: 'base' }]);
      expect(() => calculateTax({ businessType: 'kiva', year: 2026, revenue: 100 })).not.toThrow();
    });
  });

  // ── KIVA ──

  describe('kiva', () => {
    it('calculates KIVA tax at 11% on revenue - expenses', () => {
      setupCalculation('kiva', [{ rate_percent: 11, rate_label: 'base' }]);
      const result = calculateTax({ businessType: 'kiva', year: 2026, revenue: 10_000_000, expenses: 3_000_000 });

      expect(result.taxAmount).toBe(770_000); // (10M - 3M) * 0.11
      expect(result.breakdown.appliedRate).toBe(11);
      expect(result.breakdown.taxableBase).toBe(7_000_000);
      expect(result.breakdown.appliedRateLabel).toBe('base');
    });

    it('uses fallback rate 11% when no rule found', () => {
      setupCalculation('kiva', []);
      const result = calculateTax({ businessType: 'kiva', year: 2026, revenue: 10_000_000 });
      expect(result.breakdown.appliedRate).toBe(11);
    });

    it('floors taxable base to 0 when expenses exceed revenue', () => {
      setupCalculation('kiva', [{ rate_percent: 11, rate_label: 'base' }]);
      const result = calculateTax({ businessType: 'kiva', year: 2026, revenue: 1_000_000, expenses: 5_000_000 });
      expect(result.taxAmount).toBe(0);
      expect(result.breakdown.taxableBase).toBe(0);
    });

    it('defaults expenses to 0', () => {
      setupCalculation('kiva', [{ rate_percent: 11, rate_label: 'base' }]);
      const result = calculateTax({ businessType: 'kiva', year: 2026, revenue: 10_000_000 });
      expect(result.taxAmount).toBe(1_100_000);
    });
  });

  // ── AFA ──

  describe('afa', () => {
    it('calculates AFA at 27% on revenue', () => {
      setupCalculation('afa', [{ rate_percent: 27, rate_label: 'standard' }]);
      const result = calculateTax({ businessType: 'afa', year: 2026, revenue: 10_000_000 });

      expect(result.taxAmount).toBe(2_700_000);
      expect(result.breakdown.appliedRate).toBe(27);
      expect(result.breakdown.taxableBase).toBe(10_000_000);
      expect(result.breakdown.appliedRateLabel).toBe('standard');
    });

    it('uses fallback rate 27% when no rule found', () => {
      setupCalculation('afa', []);
      const result = calculateTax({ businessType: 'afa', year: 2026, revenue: 10_000_000 });
      expect(result.breakdown.appliedRate).toBe(27);
    });
  });

  // ── AAM ──

  describe('aam', () => {
    it('returns zero tax for AAM (exempt)', () => {
      setupCalculation('aam', []);
      const result = calculateTax({ businessType: 'aam', year: 2026, revenue: 10_000_000 });

      expect(result.taxAmount).toBe(0);
      expect(result.breakdown.appliedRate).toBe(0);
      expect(result.breakdown.appliedRateLabel).toBe('exempt');
      expect(result.effectiveRate).toBe(0);
    });
  });

  // ── Átalányadózás ──

  describe('atalanyadozas', () => {
    it('calculates with deemed cost deduction and SZJA rate', () => {
      setupCalculation('atalanyadozas', [
        { rate_percent: 40, rate_label: 'deemed_cost_general' },
        { rate_percent: 15, rate_label: 'szja_rate' },
      ]);
      const result = calculateTax({ businessType: 'atalanyadozas', year: 2026, revenue: 10_000_000 });

      // Deemed cost: 10M * 40% = 4M, taxable: 6M, tax: 6M * 15% = 900K
      expect(result.taxAmount).toBe(900_000);
      expect(result.breakdown.taxableBase).toBe(6_000_000);
      expect(result.breakdown.appliedRate).toBe(15);
      expect(result.breakdown.appliedRateLabel).toBe('deemed_cost_general');
    });

    it('uses fallback rates when no rules found', () => {
      setupCalculation('atalanyadozas', []);
      const result = calculateTax({ businessType: 'atalanyadozas', year: 2026, revenue: 10_000_000 });

      // Fallback: 40% deemed cost, 15% SZJA => (10M - 4M) * 15% = 900K
      expect(result.taxAmount).toBe(900_000);
    });
  });

  // ── KFT TAO ──

  describe('kft_tao', () => {
    it('calculates corporate tax at 9% on profit', () => {
      setupCalculation('kft_tao', [{ rate_percent: 9, rate_label: 'base' }]);
      const result = calculateTax({ businessType: 'kft_tao', year: 2026, revenue: 20_000_000, expenses: 12_000_000 });

      expect(result.taxAmount).toBe(720_000); // (20M - 12M) * 9%
      expect(result.breakdown.appliedRate).toBe(9);
      expect(result.breakdown.taxableBase).toBe(8_000_000);
    });

    it('uses fallback rate 9% when no rule found', () => {
      setupCalculation('kft_tao', []);
      const result = calculateTax({ businessType: 'kft_tao', year: 2026, revenue: 10_000_000 });
      expect(result.breakdown.appliedRate).toBe(9);
    });

    it('floors taxable base to 0 when expenses exceed revenue', () => {
      setupCalculation('kft_tao', [{ rate_percent: 9, rate_label: 'base' }]);
      const result = calculateTax({ businessType: 'kft_tao', year: 2026, revenue: 5_000_000, expenses: 8_000_000 });
      expect(result.taxAmount).toBe(0);
      expect(result.breakdown.taxableBase).toBe(0);
    });
  });

  // ── KATA ──

  describe('kata', () => {
    it('calculates KATA as fixed monthly flat * 12', () => {
      setupCalculation('kata', [{ rate_percent: 50000, rate_label: 'monthly_flat' }]);
      const result = calculateTax({ businessType: 'kata', year: 2026, revenue: 15_000_000 });

      expect(result.taxAmount).toBe(600_000); // 50K * 12
      expect(result.breakdown.appliedRate).toBe(50000);
      expect(result.breakdown.taxableBase).toBe(0);
      expect(result.breakdown.appliedRateLabel).toBe('monthly_flat');
    });

    it('uses fallback 50000 monthly when no rule found', () => {
      setupCalculation('kata', []);
      const result = calculateTax({ businessType: 'kata', year: 2026, revenue: 15_000_000 });
      expect(result.taxAmount).toBe(600_000);
    });
  });

  // ── Unknown type ──

  describe('unknown business type', () => {
    it('adds warning for unknown type and returns zero tax', () => {
      setupCalculation('unknown_type', []);
      const result = calculateTax({ businessType: 'unknown_type', year: 2026, revenue: 10_000_000 });

      expect(result.taxAmount).toBe(0);
      expect(result.warnings).toContain('Ismeretlen adótípus: unknown_type');
    });
  });

  // ── Zero revenue ──

  describe('zero revenue', () => {
    it('returns zero tax and zero effective rate for zero revenue', () => {
      setupCalculation('kiva', [{ rate_percent: 11, rate_label: 'base' }]);
      const result = calculateTax({ businessType: 'kiva', year: 2026, revenue: 0 });

      expect(result.taxAmount).toBe(0);
      expect(result.effectiveRate).toBe(0);
    });
  });

  // ── Effective rate ──

  describe('effective rate calculation', () => {
    it('calculates effective rate as (taxAmount / revenue) * 100', () => {
      setupCalculation('afa', [{ rate_percent: 27, rate_label: 'standard' }]);
      const result = calculateTax({ businessType: 'afa', year: 2026, revenue: 10_000_000 });

      expect(result.effectiveRate).toBe(27);
    });

    it('rounds effective rate to 2 decimal places', () => {
      setupCalculation('kiva', [{ rate_percent: 11, rate_label: 'base' }]);
      const result = calculateTax({ businessType: 'kiva', year: 2026, revenue: 10_000_000, expenses: 3_000_000 });

      // effectiveRate = (770000 / 10000000) * 100 = 7.7
      expect(result.effectiveRate).toBe(7.7);
    });
  });

  // ── Eligibility warnings ──

  describe('eligibility warnings', () => {
    it('includes eligibility reasons in warnings when not eligible', () => {
      mockQueryAll.mockReturnValue([{ id: '1', business_type: 'kata', year: 2026, rate_percent: 50000, rate_label: 'monthly_flat', notes: null }]);
      mockQueryOne.mockReturnValue({
        id: '1',
        business_type: 'kata',
        year: 2026,
        max_revenue_huf: 18_000_000,
        max_employees: null,
        conditions_json: '{}',
      });
      mockGetCurrentUserId.mockReturnValue(null);

      const result = calculateTax({ businessType: 'kata', year: 2026, revenue: 20_000_000 });
      expect(result.eligible).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('has no warnings when eligible', () => {
      setupCalculation('kiva', [{ rate_percent: 11, rate_label: 'base' }]);
      const result = calculateTax({ businessType: 'kiva', year: 2026, revenue: 5_000_000 });
      expect(result.eligible).toBe(true);
      expect(result.warnings).toEqual([]);
    });
  });

  // ── Audit logging ──

  describe('audit logging', () => {
    it('logs calculation to audit table when user is logged in', () => {
      setupCalculation('kiva', [{ rate_percent: 11, rate_label: 'base' }]);
      mockGetCurrentUserId.mockReturnValue('user-123');

      const result = calculateTax({ businessType: 'kiva', year: 2026, revenue: 10_000_000 });

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tax_calculations'),
        expect.arrayContaining(['test-uuid-1234', 'user-123', 'kiva', 2026, 10_000_000, 0, expect.any(Number), expect.any(String)])
      );
      expect(result.taxAmount).toBe(1_100_000);
    });

    it('does not log when no user is logged in', () => {
      setupCalculation('kiva', [{ rate_percent: 11, rate_label: 'base' }]);
      mockGetCurrentUserId.mockReturnValue(null);

      calculateTax({ businessType: 'kiva', year: 2026, revenue: 10_000_000 });
      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  // ── Result shape ──

  describe('result structure', () => {
    it('returns all expected fields', () => {
      setupCalculation('kiva', [{ rate_percent: 11, rate_label: 'base' }]);
      const result = calculateTax({ businessType: 'kiva', year: 2026, revenue: 10_000_000, expenses: 2_000_000 });

      expect(result).toEqual({
        businessType: 'kiva',
        year: 2026,
        taxAmount: expect.any(Number),
        effectiveRate: expect.any(Number),
        eligible: true,
        warnings: [],
        breakdown: {
          revenue: 10_000_000,
          deductibleExpenses: 2_000_000,
          taxableBase: expect.any(Number),
          appliedRate: 11,
          appliedRateLabel: 'base',
        },
      });
    });

    it('rounds taxAmount to integer', () => {
      setupCalculation('kiva', [{ rate_percent: 11, rate_label: 'base' }]);
      const result = calculateTax({ businessType: 'kiva', year: 2026, revenue: 1_000_001 });
      expect(Number.isInteger(result.taxAmount)).toBe(true);
      expect(Number.isInteger(result.breakdown.taxableBase)).toBe(true);
    });
  });
});

// ─── getAvailableTaxTypes ─────────────────────────────────────────

describe('getAvailableTaxTypes', () => {
  it('returns only eligible business types', () => {
    mockQueryAll.mockReturnValueOnce([
      { id: 'kiva' },
      { id: 'kata' },
      { id: 'afa' },
    ]);

    // checkEligibility is called for each type — mock queryOne sequentially
    mockQueryOne
      .mockReturnValueOnce(undefined) // kiva: eligible
      .mockReturnValueOnce({          // kata: not eligible (revenue too high)
        id: '1', business_type: 'kata', year: 2026,
        max_revenue_huf: 18_000_000, max_employees: null, conditions_json: '{}',
      })
      .mockReturnValueOnce(undefined); // afa: eligible

    const result = getAvailableTaxTypes(20_000_000, undefined, 2026);
    expect(result).toEqual(['kiva', 'afa']);
  });

  it('returns empty array when no types exist', () => {
    mockQueryAll.mockReturnValueOnce([]);
    const result = getAvailableTaxTypes(10_000_000);
    expect(result).toEqual([]);
  });

  it('uses current year as default', () => {
    mockQueryAll.mockReturnValueOnce([]);
    getAvailableTaxTypes(10_000_000);
    expect(mockQueryAll).toHaveBeenCalledWith('SELECT id FROM tax_business_types ORDER BY sort_order');
  });
});

// ─── getAllBusinessTypes ──────────────────────────────────────────

describe('getAllBusinessTypes', () => {
  it('queries all business types ordered by sort_order', () => {
    const mockTypes = [
      { id: 'kiva', name: 'KIVA', sort_order: 1 },
      { id: 'kata', name: 'KATA', sort_order: 2 },
    ];
    mockQueryAll.mockReturnValue(mockTypes);

    const result = getAllBusinessTypes();
    expect(mockQueryAll).toHaveBeenCalledWith('SELECT * FROM tax_business_types ORDER BY sort_order');
    expect(result).toEqual(mockTypes);
  });
});

// ─── getUserTaxSettings ──────────────────────────────────────────

describe('getUserTaxSettings', () => {
  it('returns null when no user is logged in', () => {
    mockGetCurrentUserId.mockReturnValue(null);
    const result = getUserTaxSettings(2026);
    expect(result).toBeNull();
  });

  it('returns settings for logged-in user', () => {
    mockGetCurrentUserId.mockReturnValue('user-123');
    const mockSettings = { id: '1', user_id: 'user-123', business_type: 'kiva', year: 2026 };
    mockQueryOne.mockReturnValue(mockSettings);

    const result = getUserTaxSettings(2026);
    expect(mockQueryOne).toHaveBeenCalledWith(
      'SELECT * FROM user_tax_settings WHERE user_id = ? AND year = ?',
      ['user-123', 2026]
    );
    expect(result).toEqual(mockSettings);
  });

  it('uses current year as default', () => {
    mockGetCurrentUserId.mockReturnValue('user-123');
    mockQueryOne.mockReturnValue(undefined);
    getUserTaxSettings();
    const currentYear = new Date().getFullYear();
    expect(mockQueryOne).toHaveBeenCalledWith(expect.any(String), ['user-123', currentYear]);
  });
});

// ─── setUserTaxSettings ──────────────────────────────────────────

describe('setUserTaxSettings', () => {
  it('throws when no user is logged in', () => {
    mockGetCurrentUserId.mockReturnValue(null);
    expect(() => setUserTaxSettings('kiva', 2026)).toThrow('No user logged in');
  });

  it('updates existing settings', () => {
    mockGetCurrentUserId.mockReturnValue('user-123');
    mockQueryOne.mockReturnValue({ id: 'existing-1' });

    setUserTaxSettings('kata', 2026);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE user_tax_settings'),
      ['kata', 'user-123', 2026]
    );
  });

  it('inserts new settings when none exist', () => {
    mockGetCurrentUserId.mockReturnValue('user-123');
    mockQueryOne.mockReturnValue(undefined);

    setUserTaxSettings('kiva', 2026);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO user_tax_settings'),
      ['test-uuid-1234', 'user-123', 'kiva', 2026]
    );
  });

  it('uses current year as default', () => {
    mockGetCurrentUserId.mockReturnValue('user-123');
    mockQueryOne.mockReturnValue(undefined);
    setUserTaxSettings('kiva');
    const currentYear = new Date().getFullYear();
    expect(mockExecute).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([currentYear])
    );
  });
});

// ─── getTaxCalculationHistory ────────────────────────────────────

describe('getTaxCalculationHistory', () => {
  it('returns empty array when no user is logged in', () => {
    mockGetCurrentUserId.mockReturnValue(null);
    const result = getTaxCalculationHistory();
    expect(result).toEqual([]);
  });

  it('returns calculation history for logged-in user', () => {
    mockGetCurrentUserId.mockReturnValue('user-123');
    const mockHistory = [
      { id: '1', user_id: 'user-123', business_type: 'kiva', tax_amount: 770000 },
    ];
    mockQueryAll.mockReturnValue(mockHistory);

    const result = getTaxCalculationHistory();
    expect(mockQueryAll).toHaveBeenCalledWith(
      'SELECT * FROM tax_calculations WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      ['user-123', 50]
    );
    expect(result).toEqual(mockHistory);
  });

  it('respects custom limit', () => {
    mockGetCurrentUserId.mockReturnValue('user-123');
    mockQueryAll.mockReturnValue([]);

    getTaxCalculationHistory(10);
    expect(mockQueryAll).toHaveBeenCalledWith(expect.any(String), ['user-123', 10]);
  });
});
