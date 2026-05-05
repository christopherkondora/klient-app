/**
 * Dashboard view-model — a renderer-szintű adat-orchestráció a Dashboard
 * komponens JSX-én kívül. A komponens a `loadDashboardSnapshot()` és
 * `loadCalendarSnapshot()` függvényeket hívja, és csak megjeleníti az
 * eredményt; ezáltal az 1000+ soros komponens "betöltési" felelőssége
 * tesztelhetővé válik anélkül, hogy a teljes oldalt renderelni kellene.
 *
 * A függvények egy `api`-shimet várnak, ami a renderer `window.electronAPI`-ből
 * érkező kompatibilis aláírású függvényhalmaz. A teszt egyszerű mock-objektumot
 * adhat be helyette.
 */

import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns';

// ── API shim ──

/**
 * A Dashboard adatbetöltéséhez szükséges függvények. A renderer-ben ez
 * lényegében a `window.electronAPI` vonatkozó részhalmaza, de a típus
 * tesztben kicserélhető mock-ra.
 */
export interface DashboardApi {
  getDashboardStats: () => Promise<DashboardStats>;
  getNotes: (projectId?: string) => Promise<Note[]>;
  getUpcomingDeadlines: () => Promise<Project[]>;
  getClients: () => Promise<Client[]>;
  getProjects: (clientId?: string) => Promise<Project[]>;
  getTeamMembers: () => Promise<TeamMember[]>;
  getBillingConfig: () => Promise<{ platform: string; hasApiKey: boolean; url?: string }>;
  getEnhancedFinanceStats: () => Promise<EnhancedFinanceStats>;
}

export interface CalendarApi {
  getCalendarEvents: (start: string, end: string) => Promise<CalendarEvent[]>;
}

// ── Snapshot ──

/**
 * Az összes betöltött adat **egyetlen, konzisztens** állapotban — pontosan az,
 * amit a Dashboard komponens megjelenít. A neve "snapshot", mert egy adott
 * időpontbeli "kép": ha közben az adatok változnak, új snapshotot kell kérni.
 */
export interface DashboardSnapshot {
  stats: DashboardStats;
  /** Csak az első 2 friss jegyzet — a Dashboard widget ennyit mutat. */
  recentNotes: Note[];
  deadlines: Project[];
  clients: Client[];
  /** Csak az aktív projektek — a többi nem jelenik meg a Dashboardon. */
  activeProjects: Project[];
  teamMembers: TeamMember[];
  /** A billing platform azonosító (`'billingo' | 'szamlazz' | 'none'`). */
  billingPlatform: string;
  enhanced: EnhancedFinanceStats;
}

export type CalendarRangeView = 'month' | 'week' | 'day';

// ── Naptár dátum-tartomány ──

/**
 * Egy naptár-nézet kezdő- és záró dátuma ISO `YYYY-MM-DD` formátumban.
 * A hét hétfővel kezdődik (magyar konvenció).
 */
export function calendarRange(view: CalendarRangeView, anchor: Date): { start: string; end: string } {
  if (view === 'month') {
    const start = format(startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const end = format(endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    return { start, end };
  }
  if (view === 'week') {
    const start = format(startOfWeek(anchor, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const end = format(endOfWeek(anchor, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    return { start, end };
  }
  const day = format(anchor, 'yyyy-MM-dd');
  return { start: day, end: day };
}

// ── Betöltő függvények ──

export async function loadDashboardSnapshot(api: DashboardApi): Promise<DashboardSnapshot> {
  const [
    stats,
    notes,
    deadlines,
    clients,
    projects,
    teamMembers,
    billingCfg,
    enhanced,
  ] = await Promise.all([
    api.getDashboardStats(),
    api.getNotes(),
    api.getUpcomingDeadlines(),
    api.getClients(),
    api.getProjects(),
    api.getTeamMembers(),
    api.getBillingConfig(),
    api.getEnhancedFinanceStats(),
  ]);

  return {
    stats,
    recentNotes: notes.slice(0, 2),
    deadlines,
    clients,
    activeProjects: projects.filter(p => p.status === 'active'),
    teamMembers,
    billingPlatform: billingCfg.platform || 'none',
    enhanced,
  };
}

export async function loadCalendarSnapshot(
  api: CalendarApi,
  view: CalendarRangeView,
  anchor: Date,
): Promise<CalendarEvent[]> {
  const { start, end } = calendarRange(view, anchor);
  return api.getCalendarEvents(start, end);
}
