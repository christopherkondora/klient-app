import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Users, Briefcase, Calendar, StickyNote, Mic, Plus, ChevronLeft, ChevronRight, X, MoreHorizontal, Clock, ExternalLink, Loader2, Target } from 'lucide-react';
import {
  format,
  parseISO,
  differenceInDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  subDays,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
} from 'date-fns';
import { hu } from 'date-fns/locale';
import TimePicker from '../components/TimePicker';
import { ProjectForm, TimeSlot } from './Projects';
import { ClientForm } from './Clients';
import ProfitGoalModal from '../components/ProfitGoalModal';
import { useThemedColor } from '../utils/colors';

export default function Dashboard() {
  const navigate = useNavigate();
  const tc = useThemedColor();
  const { openNotesPanel } = useOutletContext<{ openNotesPanel: () => void }>();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [deadlines, setDeadlines] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>('month');
  const [selectedCalDay, setSelectedCalDay] = useState(new Date());
  const [showRecPicker, setShowRecPicker] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventFormDate, setEventFormDate] = useState(new Date());
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [enhanced, setEnhanced] = useState<EnhancedFinanceStats | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [clockTime, setClockTime] = useState(new Date());
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [billingPlatform, setBillingPlatform] = useState<string>('none');
  const [billingWebviewUrl, setBillingWebviewUrl] = useState<string | null>(null);
  const [billingWebviewLabel, setBillingWebviewLabel] = useState('');
  const [billingWebviewLoading, setBillingWebviewLoading] = useState(true);
  const billingWebviewRef = useRef<HTMLWebViewElement | null>(null);
  const billingListenersAttached = useRef(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setClockTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadCalendarEvents();
  }, [calendarMonth, calendarView]);
  async function loadData() {
    try {
      const [statsData, notesData, deadlinesData, clientsData, projectsData, teamMembersData, billingCfg, enhancedStats] = await Promise.all([
        window.electronAPI.getDashboardStats(),
        window.electronAPI.getNotes(),
        window.electronAPI.getUpcomingDeadlines(),
        window.electronAPI.getClients(),
        window.electronAPI.getProjects(),
        window.electronAPI.getTeamMembers(),
        window.electronAPI.getBillingConfig(),
        window.electronAPI.getEnhancedFinanceStats(),
      ]);
      setStats(statsData);
      setRecentNotes(notesData.slice(0, 2));
      setDeadlines(deadlinesData);
      setClients(clientsData);
      setProjects(projectsData.filter(p => p.status === 'active'));
      setTeamMembers(teamMembersData);
      setBillingPlatform(billingCfg.platform || 'none');
      setEnhanced(enhancedStats);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadCalendarEvents() {
    try {
      let start: string, end: string;
      if (calendarView === 'month') {
        start = format(startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        end = format(endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      } else if (calendarView === 'week') {
        start = format(startOfWeek(calendarMonth, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        end = format(endOfWeek(calendarMonth, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      } else {
        start = format(calendarMonth, 'yyyy-MM-dd');
        end = format(calendarMonth, 'yyyy-MM-dd');
      }
      const events = await window.electronAPI.getCalendarEvents(start, end);
      setCalendarEvents(events);
    } catch (err) {
      console.error('Failed to load calendar events:', err);
    }
  }

  async function handleCreateProject(data: { project: Partial<Project>; timeSlots: TimeSlot[]; teamMemberIds?: string[] }) {
    try {
      const created = await window.electronAPI.createProject(data.project);
      for (const slot of data.timeSlots) {
        await window.electronAPI.createCalendarEvent({
          project_id: created.id,
          title: data.project.name || '',
          date: slot.date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          duration_hours: slot.duration,
          type: 'work',
          color: data.project.color || clients.find(c => c.id === data.project.client_id)?.color,
        });
      }
      // Create team member assignments
      if (data.teamMemberIds && data.teamMemberIds.length > 0) {
        for (const memberId of data.teamMemberIds) {
          await window.electronAPI.assignToProject(created.id, memberId);
        }
      }
      await window.electronAPI.updateProject(created.id, { is_hours_distributed: 1 });
      setShowProjectForm(false);
      loadData();
      loadCalendarEvents();
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  }

  async function handleCreateEvent(data: Partial<CalendarEvent>) {
    try {
      await window.electronAPI.createCalendarEvent(data);
      setShowEventForm(false);
      loadCalendarEvents();
    } catch (err) {
      console.error('Failed to create event:', err);
    }
  }

  function stripHtml(html: string): string {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(monthStart);
    const sd = startOfWeek(monthStart, { weekStartsOn: 1 });
    const ed = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days: Date[] = [];
    let day = sd;
    while (day <= ed) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [calendarMonth]);

  const weekDays = useMemo(() => {
    const ws = startOfWeek(calendarMonth, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  }, [calendarMonth]);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const DEFAULT_SCROLL_HOUR = 6;
  const scrollToDefault = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const hourH = calendarView === 'week' ? 40 : 48;
    node.scrollTop = DEFAULT_SCROLL_HOUR * hourH;
  }, [calendarView]);

  function calNavPrev() {
    if (calendarView === 'month') setCalendarMonth(subMonths(calendarMonth, 1));
    else if (calendarView === 'week') setCalendarMonth(subWeeks(calendarMonth, 1));
    else setCalendarMonth(subDays(calendarMonth, 1));
  }
  function calNavNext() {
    if (calendarView === 'month') setCalendarMonth(addMonths(calendarMonth, 1));
    else if (calendarView === 'week') setCalendarMonth(addWeeks(calendarMonth, 1));
    else setCalendarMonth(addDays(calendarMonth, 1));
  }
  function getCalHeaderLabel() {
    if (calendarView === 'month') return format(calendarMonth, 'yyyy. MMMM', { locale: hu });
    if (calendarView === 'week') {
      const ws = startOfWeek(calendarMonth, { weekStartsOn: 1 });
      const we = endOfWeek(calendarMonth, { weekStartsOn: 1 });
      return `${format(ws, 'MMM d.', { locale: hu })} – ${format(we, 'MMM d.', { locale: hu })}`;
    }
    return format(calendarMonth, 'yyyy. MMMM d., EEEE', { locale: hu });
  }

  const dayNames = ['Hé', 'Ke', 'Sze', 'Csü', 'Pé', 'Szo', 'Va'];

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(amount).replace(/ /g, '\u2009');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-steel"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-teal/10 pb-5">
        <div className="min-w-0">
          <h1 className="font-pixel text-[1.45rem] leading-none text-cream md:text-[1.65rem]">Dashboard</h1>
          <p className="text-muted text-sm mt-2 leading-6">
            {format(new Date(), 'yyyy. MMMM d., EEEE', { locale: hu })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Clock */}
          <span className="font-pixel text-lg text-cream tabular-nums tracking-wide">
            {clockTime.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          {/* Billing platform shortcut */}
          {billingPlatform === 'szamlazz' && (
            <button
              onClick={() => { setBillingWebviewUrl('https://www.szamlazz.hu'); setBillingWebviewLabel('Számlázz.hu'); setBillingWebviewLoading(true); }}
              className="flex items-center justify-center rounded-lg border px-4 py-2.5 transition-colors cursor-pointer bg-[#e8611a]/10 border-[#e8611a]/25 hover:bg-[#e8611a]/20"
            >
              <img src="https://www.szamlazz.hu/wp-content/uploads/2023/09/szamlazzhu_logo-horizontal-2_orange.png" alt="Számlázz.hu" className="h-7 object-contain" />
            </button>
          )}
          {billingPlatform === 'billingo' && (
            <button
              onClick={() => { setBillingWebviewUrl('https://app.billingo.hu'); setBillingWebviewLabel('Billingo'); setBillingWebviewLoading(true); }}
              className="flex items-center justify-center rounded-lg border px-4 py-2.5 transition-colors cursor-pointer bg-[#032bfa]/10 border-[#032bfa]/25 hover:bg-[#032bfa]/20"
            >
              <img src="https://www.billingo.hu/images/logo-blue.svg" alt="Billingo" className="h-6 block object-contain mt-0.5" />
            </button>
          )}
          {/* Quick Recording Shortcut */}
          <div className="relative">
            <button
              onClick={() => setShowRecPicker(!showRecPicker)}
              className="flex items-center gap-3 bg-surface-800/50 rounded-lg border border-teal/10 px-4 py-2.5 hover:border-teal/30 transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-md bg-red-500/15 flex items-center justify-center">
                <Mic width={14} height={14} className="text-red-400" />
              </div>
              <span className="text-sm font-medium text-cream">Gyors felvétel</span>
            </button>
            {showRecPicker && clients.length > 0 && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-surface-800 border border-teal/10 rounded-lg shadow-xl z-20 overflow-hidden">
                <p className="text-[10px] text-steel tracking-wider px-4 pt-3 pb-2">Válassz ügyfelet</p>
                <div className="max-h-48 overflow-auto">
                  {clients.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setShowRecPicker(false); navigate(`/clients/${c.id}?tab=recordings`); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-teal/10 transition-colors text-left cursor-pointer"
                    >
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tc(c.color) }} />
                      <span className="text-sm text-cream truncate">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hero Revenue + Stat Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(440px,auto)] gap-4">
        {/* Hero: Éves nyereség + cél */}
        <div className="bg-surface-800/50 rounded-lg border-l-[3px] border-teal p-6 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-teal/5 rounded-full blur-3xl pointer-events-none" />
          {(() => {
            const net = enhanced?.vatStatus === 'standard'
              ? (enhanced?.yearlyNetRevenue ?? enhanced?.yearlyRevenue ?? 0)
              : (enhanced?.yearlyRevenue ?? 0);
            const expenses = enhanced?.yearlyExpenses ?? 0;
            const profit = net - expenses;
            const goal = enhanced?.profitGoal ?? 0;
            const pct = goal > 0 ? Math.min(Math.round((profit / goal) * 100), 100) : 0;
            const year = new Date().getFullYear();
            return (
              <div className="relative">
                <div className="flex items-center gap-3">
                  <p className="text-[10px] text-steel tracking-[0.12em] font-medium">ÉVES NYERESÉG • {year}</p>
                </div>
                <p className={`font-pixel text-[60px] leading-tight font-bold mt-2 tracking-tight ${profit >= 0 ? 'text-cream' : 'text-red-400'}`}>
                  {formatCurrency(profit)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-steel/70">
                  <span>Árbevétel: <span className="text-steel">{formatCurrency(net)}</span></span>
                  <span>Kiadás: <span className="text-steel">{formatCurrency(expenses)}</span></span>
                </div>

                {goal > 0 ? (
                  <button
                    onClick={() => setShowGoalModal(true)}
                    className="mt-4 w-full max-w-md text-left cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-steel/70 flex items-center gap-1 group-hover:text-cream transition-colors">
                        <Target width={11} height={11} />
                        Éves nyereség cél: {formatCurrency(goal)}
                      </span>
                      <span className="text-xs font-bold text-cream">{pct}%</span>
                    </div>
                    <div className="h-2 bg-surface-900/60 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300 ease-out"
                        style={{
                          width: `${Math.max(0, pct)}%`,
                          background: pct >= 100
                            ? 'linear-gradient(90deg, #10b981, #34d399)'
                            : pct >= 60
                            ? 'linear-gradient(90deg, #124559, #598392)'
                            : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                        }}
                      />
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={() => setShowGoalModal(true)}
                    className="mt-4 inline-flex items-center gap-1.5 text-xs text-steel/50 hover:text-cream transition-colors cursor-pointer"
                  >
                    <Target width={12} height={12} /> Éves nyereség cél beállítása
                  </button>
                )}
              </div>
            );
          })()}
        </div>
        {/* Secondary stats */}
        <div className="grid grid-cols-2 gap-3">
          {/* Aktív kapcsolatok card */}
          <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-teal/15 flex items-center justify-center">
                  <Users width={15} height={15} className="text-steel" />
                </div>
                <p className="text-[10px] text-steel tracking-[0.1em] font-medium">Aktív kapcsolatok</p>
              </div>
              <button
                onClick={() => navigate('/clients')}
                className="p-1.5 rounded-md hover:bg-teal/10 text-steel/40 hover:text-cream transition-colors cursor-pointer"
                title="Összes ügyfél"
              >
                <MoreHorizontal width={14} height={14} />
              </button>
            </div>
            <div className="flex items-end justify-between mt-3">
              <p className="text-4xl font-bold text-cream">{stats?.activeClients ?? 0}</p>
              <button
                onClick={() => setShowClientForm(true)}
                className="p-1.5 rounded-md hover:bg-teal/10 text-steel/40 hover:text-cream transition-colors cursor-pointer"
                title="Új ügyfél"
              >
                <Plus width={14} height={14} />
              </button>
            </div>
          </div>
          {/* Aktív projektek card */}
          <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-teal/15 flex items-center justify-center">
                  <Briefcase width={15} height={15} className="text-steel" />
                </div>
                <p className="text-[10px] text-steel tracking-[0.1em] font-medium">Aktív projektek</p>
              </div>
              <button
                onClick={() => navigate('/projects')}
                className="p-1.5 rounded-md hover:bg-teal/10 text-steel/40 hover:text-cream transition-colors cursor-pointer"
                title="Összes projekt"
              >
                <MoreHorizontal width={14} height={14} />
              </button>
            </div>
            <div className="flex items-end justify-between mt-3">
              <p className="text-4xl font-bold text-cream">{stats?.activeProjects ?? 0}</p>
              <button
                onClick={() => setShowProjectForm(true)}
                className="p-1.5 rounded-md hover:bg-teal/10 text-steel/40 hover:text-cream transition-colors cursor-pointer"
                title="Új projekt"
              >
                <Plus width={14} height={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar + Revenue/Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-surface-800/50 rounded-lg border border-teal/10 p-5 flex flex-col" style={{ height: '520px' }}>
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button onClick={calNavPrev} className="p-1.5 hover:bg-teal/10 rounded-lg text-steel hover:text-cream transition-colors cursor-pointer">
                <ChevronLeft width={16} height={16} />
              </button>
              <h2 className="font-pixel text-[14px] text-cream min-w-0 truncate">
                {getCalHeaderLabel()}
              </h2>
              <button onClick={calNavNext} className="p-1.5 hover:bg-teal/10 rounded-lg text-steel hover:text-cream transition-colors cursor-pointer">
                <ChevronRight width={16} height={16} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-surface-900/60 rounded-md p-0.5">
                {(['month', 'week', 'day'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => { setCalendarView(mode); if (mode !== 'month') setCalendarMonth(selectedCalDay); }}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                      calendarView === mode ? 'bg-teal/20 text-cream' : 'text-steel hover:text-cream'
                    }`}
                  >
                    {mode === 'month' ? 'Hónap' : mode === 'week' ? 'Hét' : 'Nap'}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setEventFormDate(calendarView === 'day' ? calendarMonth : selectedCalDay); setShowEventForm(true); }}
                className="flex items-center justify-center w-7 h-7 bg-teal text-cream rounded-lg hover:bg-teal/80 transition-colors cursor-pointer"
                title="Új esemény"
              >
                <Plus width={14} height={14} />
              </button>
            </div>
          </div>

          {/* Month View */}
          {calendarView === 'month' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="grid grid-cols-7 mb-2 shrink-0">
                {dayNames.map(name => (
                  <div key={name} className="text-center text-[10px] font-medium text-steel/60 py-1">{name}</div>
                ))}
              </div>
              <div
                className="flex-1 grid grid-cols-7 gap-1 pb-0.5"
                style={{ gridTemplateRows: `repeat(${Math.ceil(calendarDays.length / 7)}, minmax(0, 1fr))` }}
              >
                {calendarDays.map((day, idx) => {
                  const dayEvents = calendarEvents.filter(e => isSameDay(parseISO(e.date), day));
                  const isToday = isSameDay(day, new Date());
                  const isCurrentMonth = isSameMonth(day, calendarMonth);
                  return (
                    <button
                      key={idx}
                      onClick={() => { setSelectedCalDay(day); setCalendarMonth(day); setCalendarView('day'); }}
                      className={`relative w-full h-full p-1 rounded-lg text-left transition-colors hover:bg-teal/10 cursor-pointer overflow-hidden ${
                        isToday ? 'bg-teal/15 ring-2 ring-ash/40' : ''
                      } ${!isCurrentMonth ? 'opacity-30' : ''}`}
                    >
                      <span className={`text-[11px] font-medium ${isToday ? 'text-ash' : 'text-steel'}`}>
                        {format(day, 'd')}
                      </span>
                      <div className="space-y-0.5 mt-0.5">
                        {dayEvents.slice(0, 2).map(event => {
                          const isTax = event.title?.startsWith('[TAX]');
                          return (
                            <div
                              key={event.id}
                              className="text-[8px] px-1 py-0.5 rounded truncate font-medium"
                              style={{
                                backgroundColor: `color-mix(in srgb, ${event.color ? tc(event.color) : 'var(--color-teal)'} 25%, transparent)`,
                                color: 'var(--color-cream)',
                                ...(isTax && event.color ? { boxShadow: `inset 0 0 0 1px ${event.color}40` } : {}),
                              }}
                            >
                              {isTax ? event.title.replace('[TAX] ', '📋 ') : event.title}
                            </div>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <p className="text-[8px] text-steel/60 text-center">+{dayEvents.length - 2}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Week View */}
          {calendarView === 'week' && (() => {
            const HOUR_H = 40;
            const dayColumns = weekDays.map(day => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const dayEvts = calendarEvents
                .filter(e => e.date === dayStr && e.start_time)
                .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
              type Placed = { event: CalendarEvent; col: number; totalCols: number; top: number; height: number };
              const placed: Placed[] = [];
              const groups: Placed[][] = [];
              dayEvts.forEach(event => {
                const [sh, sm] = (event.start_time || '0:0').split(':').map(Number);
                const [eh, em] = (event.end_time || event.start_time || '0:0').split(':').map(Number);
                const startMin = sh * 60 + sm;
                const endMin = Math.max(eh * 60 + em, startMin + 30);
                const top = (startMin / 60) * HOUR_H;
                const height = Math.max(((endMin - startMin) / 60) * HOUR_H, 18);
                let assignedGroup: Placed[] | null = null;
                for (const group of groups) {
                  if (group.some(g => top < g.top + g.height && (top + height) > g.top)) { assignedGroup = group; break; }
                }
                const item: Placed = { event, col: 0, totalCols: 1, top, height };
                if (assignedGroup) {
                  const usedCols = new Set(assignedGroup.filter(g => top < g.top + g.height && (top + height) > g.top).map(g => g.col));
                  let col = 0;
                  while (usedCols.has(col)) col++;
                  item.col = col;
                  assignedGroup.push(item);
                  const maxCol = Math.max(...assignedGroup.map(g => g.col)) + 1;
                  assignedGroup.forEach(g => g.totalCols = maxCol);
                } else {
                  groups.push([item]);
                }
                placed.push(item);
              });
              return placed;
            });

            return (
              <div ref={scrollToDefault} className="flex-1 overflow-auto">
                <div className="grid grid-cols-[40px_repeat(7,1fr)] sticky top-0 bg-surface-800/50 z-10 border-b border-teal/20">
                  <div />
                  {weekDays.map((day, i) => (
                    <button
                      key={i}
                      onClick={() => { setSelectedCalDay(day); setCalendarMonth(day); setCalendarView('day'); }}
                      className={`text-center py-1.5 text-[10px] font-medium transition-colors cursor-pointer ${
                        isSameDay(day, new Date()) ? 'text-ash bg-teal/15' : 'text-steel hover:text-cream'
                      }`}
                    >
                      <div>{dayNames[i]}</div>
                      <div className="text-xs font-bold">{format(day, 'd')}</div>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-[40px_repeat(7,1fr)] relative" style={{ height: 24 * HOUR_H }}>
                  {hours.map(hour => (
                    <div key={hour} className="contents">
                      <div className="text-[9px] text-steel/50 text-right pr-1 pt-0.5" style={{ position: 'absolute', left: 0, top: hour * HOUR_H, width: 40 }}>
                        {String(hour).padStart(2, '0')}:00
                      </div>
                      <div className="border-b border-teal/10" style={{ position: 'absolute', left: 40, right: 0, top: hour * HOUR_H, height: HOUR_H }} />
                    </div>
                  ))}
                  {weekDays.map((day, di) => (
                    <div
                      key={di}
                      className="relative border-l border-teal/10"
                      style={{ gridColumn: di + 2, gridRow: 1, height: 24 * HOUR_H }}
                    >
                      {dayColumns[di].map(({ event, col, totalCols, top, height }) => {
                        const isTax = event.title?.startsWith('[TAX]');
                        return (
                          <div
                            key={event.id}
                            onClick={() => { setSelectedCalDay(parseISO(event.date)); setCalendarMonth(parseISO(event.date)); setCalendarView('day'); }}
                            className="absolute text-[7px] pl-1 pr-0.5 py-0.5 rounded font-medium cursor-pointer hover:opacity-80 overflow-hidden"
                            style={{
                              top,
                              height,
                              left: `${(col / totalCols) * 100}%`,
                              width: `${(1 / totalCols) * 100 - 2}%`,
                              backgroundColor: `color-mix(in srgb, ${event.color ? tc(event.color) : 'var(--color-teal)'} 25%, transparent)`,
                              color: 'var(--color-cream)',
                              borderLeft: `2px solid ${isTax ? (event.color || 'var(--color-teal)') : (event.color ? tc(event.color) : 'var(--color-teal)')}`,
                              ...(isTax && event.color ? { boxShadow: `inset 0 0 0 1px ${event.color}40` } : {}),
                              zIndex: 5,
                            }}
                          >
                            {event.start_time?.slice(0, 5)} {isTax ? event.title.replace('[TAX] ', '📋 ') : event.title}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Day View */}
          {calendarView === 'day' && (() => {
            const DAY_H = 48;
            const dayStr = format(calendarMonth, 'yyyy-MM-dd');
            const dayEvts = calendarEvents
              .filter(e => e.date === dayStr && e.start_time)
              .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
            type DPlaced = { event: CalendarEvent; col: number; totalCols: number; top: number; height: number };
            const placed: DPlaced[] = [];
            const groups: DPlaced[][] = [];
            dayEvts.forEach(event => {
              const [sh, sm] = (event.start_time || '0:0').split(':').map(Number);
              const [eh, em] = (event.end_time || event.start_time || '0:0').split(':').map(Number);
              const startMin = sh * 60 + sm;
              const endMin = Math.max(eh * 60 + em, startMin + 30);
              const top = (startMin / 60) * DAY_H;
              const height = Math.max(((endMin - startMin) / 60) * DAY_H, 24);
              let assignedGroup: DPlaced[] | null = null;
              for (const group of groups) {
                if (group.some(g => top < g.top + g.height && (top + height) > g.top)) { assignedGroup = group; break; }
              }
              const item: DPlaced = { event, col: 0, totalCols: 1, top, height };
              if (assignedGroup) {
                const usedCols = new Set(assignedGroup.filter(g => top < g.top + g.height && (top + height) > g.top).map(g => g.col));
                let col = 0;
                while (usedCols.has(col)) col++;
                item.col = col;
                assignedGroup.push(item);
                const maxCol = Math.max(...assignedGroup.map(g => g.col)) + 1;
                assignedGroup.forEach(g => g.totalCols = maxCol);
              } else {
                groups.push([item]);
              }
              placed.push(item);
            });

            const allDayEvts = calendarEvents.filter(e => e.date === dayStr && !e.start_time);

            return (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* All-day events */}
                {allDayEvts.length > 0 && (
                  <div className="mb-3 space-y-1">
                    {allDayEvts.map(event => {
                      const isTax = event.title?.startsWith('[TAX]');
                      const displayTitle = isTax ? event.title.replace('[TAX] ', '') : event.title;
                      return (
                        <div
                          key={event.id}
                          className="text-[10px] px-2 py-1.5 rounded font-medium flex items-center gap-1.5"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${event.color ? tc(event.color) : 'var(--color-teal)'} 20%, transparent)`,
                            color: 'var(--color-cream)',
                            borderLeft: `2px solid ${event.color || 'var(--color-teal)'}`,
                            ...(isTax && event.color ? { boxShadow: `inset 0 0 0 1px ${event.color}40` } : {}),
                          }}
                        >
                          {isTax && <span>📋</span>}
                          <span>{displayTitle}</span>
                          {isTax && (
                            <span className="ml-auto text-[8px] px-1 py-0.5 rounded bg-teal/10 text-teal border border-teal/20">Adó</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Time grid */}
                <div ref={scrollToDefault} className="flex-1 overflow-auto">
                  <div className="grid grid-cols-[50px_1fr] relative" style={{ height: 24 * DAY_H }}>
                    {hours.map(hour => (
                      <div key={hour} className="contents">
                        <div className="text-[10px] text-steel/50 text-right pr-2 pt-0.5" style={{ position: 'absolute', left: 0, top: hour * DAY_H, width: 50 }}>
                          {String(hour).padStart(2, '0')}:00
                        </div>
                        <div className="border-b border-teal/10" style={{ position: 'absolute', left: 50, right: 0, top: hour * DAY_H, height: DAY_H }} />
                      </div>
                    ))}
                    <div className="relative" style={{ gridColumn: 2, gridRow: 1, height: 24 * DAY_H }}>
                      {placed.map(({ event, col, totalCols, top, height }) => (
                        <div
                          key={event.id}
                          className="absolute text-[9px] pl-2 pr-1 py-1 rounded font-medium cursor-pointer hover:opacity-80 overflow-hidden"
                          style={{
                            top,
                            height,
                            left: `${(col / totalCols) * 100}%`,
                            width: `${(1 / totalCols) * 100 - 1}%`,
                            backgroundColor: `color-mix(in srgb, ${event.color ? tc(event.color) : 'var(--color-teal)'} 25%, transparent)`,
                            color: 'var(--color-cream)',
                            borderLeft: `3px solid ${event.color ? tc(event.color) : 'var(--color-teal)'}`,
                            zIndex: 5,
                          }}
                        >
                          <div className="font-semibold">{event.title?.startsWith('[TAX]') ? `📋 ${event.title.replace('[TAX] ', '')}` : event.title}</div>
                          <div className="text-steel/70 flex items-center gap-1 mt-0.5">
                            <Clock width={8} height={8} />
                            {event.start_time?.slice(0, 5)} – {event.end_time?.slice(0, 5)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Recent Notes */}
          <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-pixel text-[15px] text-ash">Legutóbbi jegyzetek</h2>
            </div>
            {recentNotes.length === 0 ? (
              <p className="text-xs text-steel/60 italic">Nincsenek jegyzetek.</p>
            ) : (
              <div className="space-y-2">
                {recentNotes.map((note) => (
                  <div
                    key={note.id}
                    onClick={openNotesPanel}
                    className="flex items-start gap-2 p-2 rounded-md bg-teal/5 cursor-pointer hover:bg-teal/10 transition-colors"
                  >
                    <StickyNote width={12} height={12} className="text-steel mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-cream truncate">{note.title || 'Cím nélkül'}</p>
                      <p className="text-[10px] text-steel truncate">{stripHtml(note.content) || 'Üres jegyzet'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Deadlines */}
          <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-5">
            <h2 className="font-pixel text-[15px] text-ash mb-4">Közelgő határidők</h2>
            {deadlines.length === 0 ? (
              <p className="text-xs text-steel/60 italic">Tiszta a naptárad. Élvezd, amíg tart.</p>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-auto">
                {deadlines.map((project) => {
                  const daysLeft = differenceInDays(parseISO(project.deadline!), new Date());
                  return (
                    <div
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-teal/5 cursor-pointer transition-colors"
                    >
                      <div
                        className="w-1 h-6 rounded-full shrink-0"
                        style={{ backgroundColor: tc(project.color || project.client_color) }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-cream truncate">{project.name}</p>
                        <p className="text-[10px] text-steel">{project.client_name || 'Személyes'}</p>
                      </div>
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                        daysLeft <= 2 ? 'text-red-400 bg-red-400/10' :
                        daysLeft <= 7 ? 'text-amber-400 bg-amber-400/10' :
                        'text-steel bg-teal/10'
                      }`}>
                        <Calendar width={10} height={10} />
                        <span>{daysLeft <= 0 ? 'Ma' : `${daysLeft} nap`}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Add Event Modal from Calendar click */}
      {showEventForm && (
        <DashboardEventModal
          date={eventFormDate}
          projects={projects}
          onSubmit={handleCreateEvent}
          onClose={() => setShowEventForm(false)}
        />
      )}

      {/* Project Creation Modal */}
      {showProjectForm && (
        <ProjectForm
          clients={clients}
          teamMembers={teamMembers}
          onSubmit={handleCreateProject}
          onClose={() => setShowProjectForm(false)}
        />
      )}

      {/* Client Creation Modal */}
      {showClientForm && (
        <ClientForm
          client={null}
          onSubmit={async (data) => {
            await window.electronAPI.createClient(data);
            setShowClientForm(false);
            loadData();
          }}
          onClose={() => setShowClientForm(false)}
        />
      )}

      {/* Profit goal modal */}
      {showGoalModal && (() => {
        const net = enhanced?.vatStatus === 'standard'
          ? (enhanced?.yearlyNetRevenue ?? enhanced?.yearlyRevenue ?? 0)
          : (enhanced?.yearlyRevenue ?? 0);
        const profit = net - (enhanced?.yearlyExpenses ?? 0);
        return (
          <ProfitGoalModal
            currentGoal={enhanced?.profitGoal ?? 0}
            currentProfit={profit}
            onClose={() => setShowGoalModal(false)}
            onSaved={() => loadData()}
          />
        );
      })()}

      {/* Floating Notes Button moved to Layout */}

      {/* Billing platform webview modal */}
      {billingWebviewUrl && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onDoubleClick={() => { setBillingWebviewUrl(null); billingWebviewRef.current = null; billingListenersAttached.current = false; }}>
          <div className="bg-surface-800 rounded-xl border border-teal/15 shadow-2xl w-[90vw] h-[85vh] flex flex-col overflow-hidden" onDoubleClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-teal/10 shrink-0">
              <div className="flex items-center gap-2">
                <ExternalLink width={14} height={14} className="text-steel" />
                <span className="text-sm text-cream font-medium">{billingWebviewLabel}</span>
              </div>
              <button
                onClick={() => { setBillingWebviewUrl(null); billingWebviewRef.current = null; billingListenersAttached.current = false; }}
                className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream transition-colors cursor-pointer"
              >
                <X width={16} height={16} />
              </button>
            </div>
            <div className="flex-1 relative">
              {billingWebviewLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-800 z-10">
                  <Loader2 className="w-8 h-8 text-teal animate-spin mb-3" />
                  <p className="text-steel text-sm">Betöltés...</p>
                </div>
              )}
              <webview
                src={billingWebviewUrl}
                partition="persist:billing"
                className="w-full h-full"
                style={{ width: '100%', height: '100%' }}
                ref={(el: HTMLWebViewElement | null) => {
                  if (el && el !== billingWebviewRef.current) {
                    billingWebviewRef.current = el;
                    billingListenersAttached.current = false;
                  }
                  if (el && !billingListenersAttached.current) {
                    billingListenersAttached.current = true;
                    el.addEventListener('did-finish-load', () => setBillingWebviewLoading(false));
                    el.addEventListener('did-fail-load', () => setBillingWebviewLoading(false));
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardEventModal({ date, projects, onSubmit, onClose }: {
  date: Date;
  projects: Project[];
  onSubmit: (data: Partial<CalendarEvent>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [type, setType] = useState<'work' | 'meeting' | 'deadline' | 'reminder' | 'other'>('work');

  const inputClass = 'w-full px-2.5 py-2 bg-surface-900/40 border border-teal/8 rounded-lg text-sm text-cream focus:outline-none focus:border-teal/25 placeholder:text-steel/40 transition-colors';

  function calcDuration() {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    return Math.max((eh * 60 + em - sh * 60 - sm) / 60, 0);
  }

  function handleStartTimeChange(newStart: string) {
    setStartTime(newStart);
    const [sh, sm] = newStart.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    if (eh * 60 + em <= sh * 60 + sm) {
      const newEndMin = sh * 60 + sm + 30;
      const nh = Math.floor(newEndMin / 60) % 24;
      const nm = newEndMin % 60;
      setEndTime(`${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`);
    }
  }

  function handleEndTimeChange(newEnd: string) {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = newEnd.split(':').map(Number);
    if (eh * 60 + em <= sh * 60 + sm) return;
    setEndTime(newEnd);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onDoubleClick={onClose}>
      <div className="bg-surface-800 rounded-2xl ring-1 ring-inset ring-teal/15 w-full max-w-sm shadow-2xl overflow-hidden" onDoubleClick={e => e.stopPropagation()}>

        {/* Header accent */}
        <div className="h-1 bg-teal" />

        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-pixel text-[14px] text-cream">
              {format(date, 'yyyy. MMMM d.', { locale: hu })}
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream cursor-pointer transition-colors duration-150 ease-out">
              <X width={14} height={14} />
            </button>
          </div>
        <form
          onSubmit={e => {
            e.preventDefault();
            if (!title.trim()) return;
            onSubmit({
              title: title.trim(),
              project_id: projectId || undefined,
              date: format(date, 'yyyy-MM-dd'),
              start_time: startTime,
              end_time: endTime,
              duration_hours: calcDuration(),
              type,
              color: projectId ? (projects.find(p => p.id === projectId)?.color || projects.find(p => p.id === projectId)?.client_color) : undefined,
            });
          }}
          className="space-y-3"
        >
          <div>
            <label className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Esemény neve</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className={inputClass}
              placeholder="pl. Ügyfél meetup..."
              required
              autoFocus
            />
          </div>
          <div>
            <label className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Projekt</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} className={inputClass}>
              <option value="">Nincs projekt</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.client_name ? `${p.client_name} – ` : ''}{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Kezdés</label>
              <TimePicker value={startTime} onChange={handleStartTimeChange} />
            </div>
            <div>
              <label className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Befejezés</label>
              <TimePicker value={endTime} onChange={handleEndTimeChange} />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Típus</label>
            <select value={type} onChange={e => setType(e.target.value as typeof type)} className={inputClass}>
              <option value="work">Munka</option>
              <option value="meeting">Megbeszélés</option>
              <option value="deadline">Határidő</option>
              <option value="reminder">Emlékeztető</option>
              <option value="other">Egyéb</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-steel hover:text-cream transition-colors duration-150 ease-out cursor-pointer">Mégse</button>
            <button type="submit" className="px-5 py-2 text-xs font-medium bg-teal text-cream rounded-lg hover:bg-teal/80 transition-colors duration-150 ease-out cursor-pointer">Hozzáadás</button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
