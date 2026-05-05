import { describe, expect, it, vi } from 'vitest';
import {
  loadDashboardSnapshot,
  loadCalendarSnapshot,
  calendarRange,
  type DashboardApi,
  type CalendarApi,
} from './dashboard-view-model';

// ── Fixture-ök ──

const STATS: DashboardStats = {
  totalClients: 3,
  activeClients: 2,
  activeProjects: 4,
  completedProjects: 1,
  totalRevenue: 1_000_000,
  pendingRevenue: 200_000,
  thisMonthRevenue: 100_000,
  thisWeekRevenue: 25_000,
  thisYearRevenue: 1_000_000,
};

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: overrides.id ?? 'p1',
    client_id: null,
    name: 'Project',
    description: '',
    status: 'active',
    deadline: null,
    estimated_hours: 0,
    allocated_hours: 0,
    is_hours_distributed: 0,
    priority: 'medium',
    color: null,
    project_price: null,
    project_price_currency: null,
    project_price_huf: null,
    created_at: '',
    updated_at: '',
    closed_at: null,
    ...overrides,
  };
}

function makeNote(id: string): Note {
  return {
    id,
    project_id: null,
    client_id: null,
    title: `Note ${id}`,
    content: '',
    date: '',
    color: '',
    pinned: 0,
    created_at: '',
    updated_at: '',
  };
}

const ENHANCED: EnhancedFinanceStats = {
  paidLastMonth: 0,
  yearlyRevenue: 0,
  yearlyNetRevenue: 0,
  vatPayable: 0,
  vatDeductible: 0,
  vatBalance: 0,
  yearlyMonthly: [],
  topClients: [],
  avgPaymentDays: 0,
  monthlyExpenses: 0,
  yearlyExpenses: 0,
  monthlyPayroll: 0,
  openContractorFees: 0,
  revenueGoal: 0,
  profitGoal: 0,
  vatStatus: 'standard',
  expensesByCategory: [],
  monthlyExpensesTrend: [],
  teamCostItems: [],
  employeeSalaryItems: [],
};

function makeApi(overrides: Partial<DashboardApi> = {}): DashboardApi {
  return {
    getDashboardStats: vi.fn().mockResolvedValue(STATS),
    getNotes: vi.fn().mockResolvedValue([]),
    getUpcomingDeadlines: vi.fn().mockResolvedValue([]),
    getClients: vi.fn().mockResolvedValue([]),
    getProjects: vi.fn().mockResolvedValue([]),
    getTeamMembers: vi.fn().mockResolvedValue([]),
    getBillingConfig: vi.fn().mockResolvedValue({ platform: 'billingo', hasApiKey: true }),
    getEnhancedFinanceStats: vi.fn().mockResolvedValue(ENHANCED),
    ...overrides,
  };
}

// ── loadDashboardSnapshot ──

describe('loadDashboardSnapshot', () => {
  it('mind a 8 IPC hívást párhuzamosan végzi és összerakja a snapshotot', async () => {
    const api = makeApi();
    const snap = await loadDashboardSnapshot(api);

    expect(api.getDashboardStats).toHaveBeenCalledTimes(1);
    expect(api.getNotes).toHaveBeenCalledTimes(1);
    expect(api.getUpcomingDeadlines).toHaveBeenCalledTimes(1);
    expect(api.getClients).toHaveBeenCalledTimes(1);
    expect(api.getProjects).toHaveBeenCalledTimes(1);
    expect(api.getTeamMembers).toHaveBeenCalledTimes(1);
    expect(api.getBillingConfig).toHaveBeenCalledTimes(1);
    expect(api.getEnhancedFinanceStats).toHaveBeenCalledTimes(1);
    expect(snap.stats).toEqual(STATS);
    expect(snap.enhanced).toEqual(ENHANCED);
  });

  it('csak az első 2 jegyzetet tartja meg (Dashboard widget korlát)', async () => {
    const notes = [makeNote('a'), makeNote('b'), makeNote('c'), makeNote('d')];
    const api = makeApi({ getNotes: vi.fn().mockResolvedValue(notes) });
    const snap = await loadDashboardSnapshot(api);
    expect(snap.recentNotes.map(n => n.id)).toEqual(['a', 'b']);
  });

  it('csak az aktív projekteket adja vissza, a többit kiszűri', async () => {
    const projects = [
      makeProject({ id: 'a', status: 'active' }),
      makeProject({ id: 'b', status: 'completed' }),
      makeProject({ id: 'c', status: 'on_hold' }),
      makeProject({ id: 'd', status: 'active' }),
      makeProject({ id: 'e', status: 'cancelled' }),
    ];
    const api = makeApi({ getProjects: vi.fn().mockResolvedValue(projects) });
    const snap = await loadDashboardSnapshot(api);
    expect(snap.activeProjects.map(p => p.id)).toEqual(['a', 'd']);
  });

  it('üres / hiányzó billing platform "none"-ra normalizálódik', async () => {
    const api = makeApi({
      getBillingConfig: vi.fn().mockResolvedValue({ platform: '', hasApiKey: false }),
    });
    const snap = await loadDashboardSnapshot(api);
    expect(snap.billingPlatform).toBe('none');
  });

  it('billing platform megőrződik (pl. szamlazz)', async () => {
    const api = makeApi({
      getBillingConfig: vi.fn().mockResolvedValue({ platform: 'szamlazz', hasApiKey: true }),
    });
    const snap = await loadDashboardSnapshot(api);
    expect(snap.billingPlatform).toBe('szamlazz');
  });

  it('üres jegyzetlista esetén üres recentNotes-t ad vissza', async () => {
    const snap = await loadDashboardSnapshot(makeApi());
    expect(snap.recentNotes).toEqual([]);
  });

  it('ha bármelyik IPC hívás elhasal, a Promise.all rejection-be visz', async () => {
    const api = makeApi({
      getEnhancedFinanceStats: vi.fn().mockRejectedValue(new Error('IPC down')),
    });
    await expect(loadDashboardSnapshot(api)).rejects.toThrow('IPC down');
  });
});

// ── calendarRange ──

describe('calendarRange', () => {
  it('hónap nézet — az egész hónapot ölelő hetekre nyúlik (hétfői hét)', () => {
    // 2026 március: márc 1. (vasárnap) → előző hétfő febr 23. ; márc 31. (kedd) → záró vasárnap ápr 5.
    const range = calendarRange('month', new Date(2026, 2, 15));
    expect(range.start).toBe('2026-02-23');
    expect(range.end).toBe('2026-04-05');
  });

  it('hét nézet — a megadott naphoz tartozó hét hétfő-vasárnap', () => {
    // 2026-05-07 (csütörtök) → hétfő máj 4., vasárnap máj 10.
    const range = calendarRange('week', new Date(2026, 4, 7));
    expect(range.start).toBe('2026-05-04');
    expect(range.end).toBe('2026-05-10');
  });

  it('nap nézet — start és end ugyanaz a nap', () => {
    const range = calendarRange('day', new Date(2026, 4, 7));
    expect(range.start).toBe('2026-05-07');
    expect(range.end).toBe('2026-05-07');
  });
});

// ── loadCalendarSnapshot ──

describe('loadCalendarSnapshot', () => {
  it('a kiszámolt range-et adja át a getCalendarEvents-nek', async () => {
    const api: CalendarApi = {
      getCalendarEvents: vi.fn().mockResolvedValue([]),
    };
    await loadCalendarSnapshot(api, 'week', new Date(2026, 4, 7));
    expect(api.getCalendarEvents).toHaveBeenCalledWith('2026-05-04', '2026-05-10');
  });

  it('visszaadja az eseményeket', async () => {
    const events = [{ id: 'e1' } as CalendarEvent];
    const api: CalendarApi = {
      getCalendarEvents: vi.fn().mockResolvedValue(events),
    };
    const result = await loadCalendarSnapshot(api, 'day', new Date(2026, 4, 7));
    expect(result).toBe(events);
  });
});
