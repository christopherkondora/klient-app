import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing
vi.mock('./db-helpers', () => ({
  queryAll: vi.fn(() => []),
  queryOne: vi.fn(() => null),
  execute: vi.fn(),
}));

vi.mock('./database', () => ({
  saveDb: vi.fn(),
}));

vi.mock('./supabase', () => ({
  getSupabase: vi.fn(() => ({
    functions: {
      invoke: vi.fn(async () => ({ data: { content: 'AI result', tokens_used: 100 }, error: null })),
    },
  })),
}));

import { prepareAnalysisContext, type AnalysisType } from './ads-ai';
import { queryAll, queryOne } from './db-helpers';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('prepareAnalysisContext', () => {
  it('includes account info when account exists', () => {
    vi.mocked(queryOne).mockReturnValueOnce({ name: 'Test Account', currency: 'HUF' } as any);
    const ctx = prepareAnalysisContext('acc-1', 'performance');
    expect(ctx).toContain('## Fiók: Test Account (HUF)');
  });

  it('returns empty string when no account and no data', () => {
    vi.mocked(queryOne).mockReturnValue(undefined as any);
    vi.mocked(queryAll).mockReturnValue([]);
    const ctx = prepareAnalysisContext('acc-nonexistent', 'performance');
    expect(ctx).toBe('');
  });

  it('builds campaign table for performance analysis', () => {
    vi.mocked(queryOne).mockReturnValueOnce({ name: 'My Account', currency: 'HUF' } as any);
    vi.mocked(queryAll)
      .mockReturnValueOnce([ // campaigns
        { name: 'Campaign A', type: 'SEARCH', status: 'ENABLED', imp: 10000, cl: 500, cost: 50_000_000, conv: 25, conv_val: 150 },
      ])
      .mockReturnValueOnce([ // weekly trend
        { period: 'this_week', imp: 5000, cl: 250, cost: 25_000_000, conv: 12, conv_val: 75 },
      ])
      .mockReturnValueOnce([]); // knowledge base

    const ctx = prepareAnalysisContext('acc-1', 'performance');
    expect(ctx).toContain('## Kampányok (utolsó 30 nap)');
    expect(ctx).toContain('Campaign A');
    expect(ctx).toContain('SEARCH');
    expect(ctx).toContain('## Heti trend');
  });

  it('builds budget table for budget analysis', () => {
    vi.mocked(queryOne).mockReturnValueOnce({ name: 'Acme', currency: 'HUF' } as any);
    vi.mocked(queryAll)
      .mockReturnValueOnce([ // budget data
        { name: 'Brand', budget_amount_micros: 10_000_000, budget_type: 'DAILY', cost: 300_000_000, conv_val: 900, avg_is: 0.85, avg_budget_lost: 0.05, avg_rank_lost: 0.10 },
      ])
      .mockReturnValueOnce([]); // knowledge base

    const ctx = prepareAnalysisContext('acc-1', 'budget');
    expect(ctx).toContain('## Budget & Impression Share');
    expect(ctx).toContain('Brand');
  });

  it('builds keywords table for keywords analysis', () => {
    vi.mocked(queryOne).mockReturnValueOnce({ name: 'Acme', currency: 'HUF' } as any);
    vi.mocked(queryAll)
      .mockReturnValueOnce([ // kw data
        { keyword_text: 'google ads', match_type: 'BROAD', quality_score: 7, expected_ctr: 'ABOVE_AVERAGE', ad_relevance: 'AVERAGE', landing_page_experience: 'ABOVE_AVERAGE', imp: 5000, cl: 300, cost: 15_000_000, conv: 10, conv_val: 50 },
      ])
      .mockReturnValueOnce([]); // knowledge base

    const ctx = prepareAnalysisContext('acc-1', 'keywords');
    expect(ctx).toContain('## Kulcsszavak');
    expect(ctx).toContain('google ads');
    expect(ctx).toContain('BROAD');
  });

  it('builds anomaly comparison table', () => {
    vi.mocked(queryOne).mockReturnValueOnce({ name: 'Acme', currency: 'HUF' } as any);
    vi.mocked(queryAll)
      .mockReturnValueOnce([ // anomaly data
        { name: 'Search', imp_now: 10000, imp_prev: 8000, cl_now: 500, cl_prev: 400, cost_now: 50_000_000, cost_prev: 40_000_000, conv_now: 20, conv_prev: 15 },
      ])
      .mockReturnValueOnce([]); // knowledge base

    const ctx = prepareAnalysisContext('acc-1', 'anomaly');
    expect(ctx).toContain('## Anomália detekció');
    expect(ctx).toContain('Search');
  });

  it('appends knowledge base entries', () => {
    vi.mocked(queryOne).mockReturnValueOnce({ name: 'Acme', currency: 'HUF' } as any);
    // For performance: campaigns query + weekly trend query + kb query
    vi.mocked(queryAll)
      .mockReturnValueOnce([]) // campaigns
      .mockReturnValueOnce([]) // weekly trend
      .mockReturnValueOnce([ // knowledge base
        { title: 'Max CPA', content: 'Ne lépjük túl a 3000 Ft-os CPA-t' },
        { title: 'Brand ROAS', content: 'Minimum 5x ROAS cél brand kampányoknál' },
      ]);

    const ctx = prepareAnalysisContext('acc-1', 'performance');
    expect(ctx).toContain('## Felhasználó saját tudásbázisa');
    expect(ctx).toContain('### Max CPA');
    expect(ctx).toContain('Ne lépjük túl a 3000 Ft-os CPA-t');
    expect(ctx).toContain('### Brand ROAS');
  });

  it('context output is markdown table format', () => {
    vi.mocked(queryOne).mockReturnValueOnce({ name: 'Acme', currency: 'HUF' } as any);
    vi.mocked(queryAll)
      .mockReturnValueOnce([ // campaigns
        { name: 'Test', type: 'SEARCH', status: 'ENABLED', imp: 1000, cl: 50, cost: 10_000_000, conv: 5, conv_val: 30 },
      ])
      .mockReturnValueOnce([]) // weekly trend
      .mockReturnValueOnce([]); // kb

    const ctx = prepareAnalysisContext('acc-1', 'performance');
    // Check markdown table structure
    expect(ctx).toContain('| Kampány | Típus |');
    expect(ctx).toContain('|---------|');
  });

  it('limits data to not exceed reasonable context size', () => {
    vi.mocked(queryOne).mockReturnValueOnce({ name: 'Acme', currency: 'HUF' } as any);
    // Simulate 15 campaigns (the LIMIT in query)
    const campaigns = Array.from({ length: 15 }, (_, i) => ({
      name: `Campaign ${i}`, type: 'SEARCH', status: 'ENABLED', imp: 1000, cl: 50, cost: 1_000_000, conv: 1, conv_val: 5,
    }));
    vi.mocked(queryAll)
      .mockReturnValueOnce(campaigns)
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);

    const ctx = prepareAnalysisContext('acc-1', 'report');
    // Should not be excessively large — each campaign adds ~1 line
    const lines = ctx.split('\n');
    expect(lines.length).toBeLessThan(100);
  });
});
