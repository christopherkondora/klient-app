import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing
vi.mock('./db-helpers', () => ({
  queryAll: vi.fn(() => []),
  queryOne: vi.fn(() => null),
  execute: vi.fn(),
}));

vi.mock('./database', () => ({
  getDb: vi.fn(() => ({ run: vi.fn() })),
  saveDb: vi.fn(),
}));

vi.mock('./ads-api', () => ({
  fetchCampaigns: vi.fn(async () => []),
  fetchAdGroups: vi.fn(async () => []),
  fetchKeywords: vi.fn(async () => []),
  fetchDailyMetrics: vi.fn(async () => []),
}));

import { syncAccount, getSyncLog, getLastSync } from './ads-sync';
import { queryAll, queryOne, execute } from './db-helpers';
import { getDb, saveDb } from './database';
import { fetchCampaigns, fetchAdGroups, fetchKeywords, fetchDailyMetrics } from './ads-api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('syncAccount', () => {
  it('creates a sync log entry with running status', async () => {
    await syncAccount('acc-1', 'full');
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ads_sync_log'),
      expect.arrayContaining(['acc-1', 'full']),
    );
  });

  it('calls all fetch functions', async () => {
    await syncAccount('acc-1', 'full');
    expect(fetchCampaigns).toHaveBeenCalledWith('acc-1');
    expect(fetchAdGroups).toHaveBeenCalledWith('acc-1');
    expect(fetchKeywords).toHaveBeenCalledWith('acc-1');
    expect(fetchDailyMetrics).toHaveBeenCalled();
  });

  it('marks sync as completed on success', async () => {
    await syncAccount('acc-1', 'incremental');
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("status = 'completed'"),
      expect.any(Array),
    );
    expect(saveDb).toHaveBeenCalled();
  });

  it('upserts campaigns via ON CONFLICT', async () => {
    const db = { run: vi.fn() };
    vi.mocked(getDb).mockReturnValue(db as any);
    vi.mocked(fetchCampaigns).mockResolvedValue([
      { campaign_id: 'c1', name: 'Test', type: 'SEARCH', status: 'ENABLED', budget_amount_micros: 10_000_000, budget_type: 'DAILY', bidding_strategy: 'MANUAL_CPC', start_date: '2025-01-01', end_date: null },
    ] as any);

    await syncAccount('acc-1', 'full');
    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT'),
      expect.arrayContaining(['acc-1', 'c1', 'Test']),
    );
  });

  it('marks sync as failed on API error', async () => {
    vi.mocked(fetchCampaigns).mockRejectedValue(new Error('API rate limit'));
    await expect(syncAccount('acc-1', 'full')).rejects.toThrow('API rate limit');
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("status = 'failed'"),
      expect.arrayContaining(['API rate limit']),
    );
  });

  it('returns records synced count', async () => {
    const db = { run: vi.fn() };
    vi.mocked(getDb).mockReturnValue(db as any);
    vi.mocked(fetchCampaigns).mockResolvedValue([
      { campaign_id: 'c1', name: 'A', type: 'SEARCH', status: 'ENABLED', budget_amount_micros: 0, budget_type: 'DAILY', bidding_strategy: '', start_date: '', end_date: null },
      { campaign_id: 'c2', name: 'B', type: 'DISPLAY', status: 'PAUSED', budget_amount_micros: 0, budget_type: 'DAILY', bidding_strategy: '', start_date: '', end_date: null },
    ] as any);
    vi.mocked(fetchAdGroups).mockResolvedValue([
      { campaign_id: 'c1', ad_group_id: 'ag1', name: 'G1', status: 'ENABLED', cpc_bid_micros: 0 },
    ] as any);

    const result = await syncAccount('acc-1', 'full');
    expect(result).toBe(3); // 2 campaigns + 1 ad group
  });
});

describe('getSyncLog', () => {
  it('queries sync log with correct account and limit', () => {
    getSyncLog('acc-1', 10);
    expect(queryAll).toHaveBeenCalledWith(
      expect.stringContaining('ads_sync_log'),
      ['acc-1', 10],
    );
  });

  it('uses default limit of 20', () => {
    getSyncLog('acc-1');
    expect(queryAll).toHaveBeenCalledWith(
      expect.any(String),
      ['acc-1', 20],
    );
  });
});

describe('getLastSync', () => {
  it('returns completed_at when sync exists', () => {
    vi.mocked(queryOne).mockReturnValue({ completed_at: '2025-01-15 10:30:00' } as any);
    expect(getLastSync('acc-1')).toBe('2025-01-15 10:30:00');
  });

  it('returns null when no sync found', () => {
    vi.mocked(queryOne).mockReturnValue(undefined as any);
    expect(getLastSync('acc-1')).toBeNull();
  });
});
