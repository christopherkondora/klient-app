import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Users, Briefcase, Calendar, StickyNote, Mic, Plus, ChevronLeft, ChevronRight, X, MoreHorizontal } from 'lucide-react';
import {
  format,
  parseISO,
  differenceInDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
} from 'date-fns';
import { hu } from 'date-fns/locale';
import TimePicker from '../components/TimePicker';
import { ProjectForm, TimeSlot } from './Projects';
import { ClientForm } from './Clients';
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
  const [showRecPicker, setShowRecPicker] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventFormDate, setEventFormDate] = useState(new Date());
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [revenuePeriod, setRevenuePeriod] = useState<'week' | 'month' | 'year'>('month');
  const [clockTime, setClockTime] = useState(new Date());
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setClockTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadCalendarEvents();
  }, [calendarMonth]);

  async function loadData() {
    try {
      const [statsData, notesData, deadlinesData, clientsData, projectsData] = await Promise.all([
        window.electronAPI.getDashboardStats(),
        window.electronAPI.getNotes(),
        window.electronAPI.getUpcomingDeadlines(),
        window.electronAPI.getClients(),
        window.electronAPI.getProjects(),
      ]);
      setStats(statsData);
      setRecentNotes(notesData.slice(0, 2));
      setDeadlines(deadlinesData);
      setClients(clientsData);
      setProjects(projectsData.filter(p => p.status === 'active'));
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadCalendarEvents() {
    try {
      const start = format(startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const end = format(endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const events = await window.electronAPI.getCalendarEvents(start, end);
      setCalendarEvents(events);
    } catch (err) {
      console.error('Failed to load calendar events:', err);
    }
  }

  async function handleCreateProject(data: { project: Partial<Project>; timeSlots: TimeSlot[] }) {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-xl text-cream">Dashboard</h1>
          <p className="text-steel text-sm mt-2">
            {format(new Date(), "yyyy. MMMM d., EEEE", { locale: hu })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Clock */}
          <span className="font-pixel text-lg text-cream tabular-nums tracking-wide">
            {clockTime.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
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
        {/* Hero: Revenue */}
        <div className="bg-surface-800/50 rounded-lg border-l-[3px] border-teal p-6 flex flex-col justify-center">
          <div className="flex items-center gap-3">
            <p className="text-[10px] text-steel tracking-[0.12em] font-medium">Bevétel</p>
            <div className="flex items-center gap-1 bg-surface-900/60 rounded-md p-0.5">
              {(['week', 'month', 'year'] as const).map(period => (
                <button
                  key={period}
                  onClick={() => setRevenuePeriod(period)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                    revenuePeriod === period
                      ? 'bg-teal/20 text-cream'
                      : 'text-steel hover:text-cream'
                  }`}
                >
                  {period === 'week' ? '7 nap' : period === 'month' ? '30 nap' : '365 nap'}
                </button>
              ))}
            </div>
          </div>
          <p className="font-pixel text-[60px] leading-tight font-bold text-cream mt-2 tracking-tight">
            {formatCurrency(
              revenuePeriod === 'week' ? (stats?.thisWeekRevenue ?? 0) :
              revenuePeriod === 'year' ? (stats?.thisYearRevenue ?? 0) :
              (stats?.thisMonthRevenue ?? 0)
            )}
          </p>
          <p className="text-xs text-steel mt-2">
            {revenuePeriod === 'week' ? 'Utolsó 7 nap' : revenuePeriod === 'year' ? 'Utolsó 365 nap' : 'Utolsó 30 nap'}
          </p>
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
        {/* Mini Calendar */}
        <div className="lg:col-span-2 bg-surface-800/50 rounded-lg border border-teal/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))} className="p-1.5 hover:bg-teal/10 rounded-lg text-steel hover:text-cream transition-colors">
              <ChevronLeft width={16} height={16} />
            </button>
            <h2 className="font-pixel text-[14px] text-cream">
              {format(calendarMonth, 'yyyy. MMMM', { locale: hu })}
            </h2>
            <button onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))} className="p-1.5 hover:bg-teal/10 rounded-lg text-steel hover:text-cream transition-colors">
              <ChevronRight width={16} height={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 mb-2">
            {dayNames.map(name => (
              <div key={name} className="text-center text-[10px] font-medium text-steel/60 py-1">{name}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, idx) => {
              const dayEvents = calendarEvents.filter(e => isSameDay(parseISO(e.date), day));
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = isSameMonth(day, calendarMonth);
              return (
                <button
                  key={idx}
                  onClick={() => { setEventFormDate(day); setShowEventForm(true); }}
                  className={`relative min-h-[56px] p-1 rounded-lg text-left transition-colors hover:bg-teal/10 ${
                    isToday ? 'bg-teal/15 ring-2 ring-ash/40' : ''
                  } ${!isCurrentMonth ? 'opacity-30' : ''}`}
                >
                  <span className={`text-[11px] font-medium ${isToday ? 'text-ash' : 'text-steel'}`}>
                    {format(day, 'd')}
                  </span>
                  <div className="space-y-0.5 mt-0.5">
                    {dayEvents.slice(0, 2).map(event => (
                      <div
                        key={event.id}
                        className="text-[8px] px-1 py-0.5 rounded truncate font-medium"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${event.color ? tc(event.color) : 'var(--color-teal)'} 25%, transparent)`,
                          color: 'var(--color-cream)',
                        }}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <p className="text-[8px] text-steel/60 text-center">+{dayEvents.length - 2}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
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
                  const daysLeft = differenceInDays(parseISO(project.deadline), new Date());
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

      {/* Floating Notes Button moved to Layout */}
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

  const inputClass = "w-full px-3 py-2 bg-surface-900 border border-teal/10 rounded-lg text-sm text-cream focus:outline-none focus:ring-2 focus:ring-teal/30";

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
      <div className="bg-surface-800 rounded-xl border border-teal/15 p-6 w-full max-w-sm shadow-2xl" onDoubleClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-pixel text-[14px] text-cream">
            {format(date, 'yyyy. MMMM d.', { locale: hu })}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-teal/10 text-steel hover:text-cream">
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
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className={inputClass}
            placeholder="Esemény neve..."
            required
            autoFocus
          />
          <select value={projectId} onChange={e => setProjectId(e.target.value)} className={inputClass}>
            <option value="">Nincs projekt</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.client_name ? `${p.client_name} – ` : ''}{p.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-steel mb-1">Kezdés</label>
              <TimePicker value={startTime} onChange={handleStartTimeChange} />
            </div>
            <div>
              <label className="block text-[10px] text-steel mb-1">Befejezés</label>
              <TimePicker value={endTime} onChange={handleEndTimeChange} />
            </div>
          </div>
          <select value={type} onChange={e => setType(e.target.value as typeof type)} className={inputClass}>
            <option value="work">Munka</option>
            <option value="meeting">Megbeszélés</option>
            <option value="deadline">Határidő</option>
            <option value="reminder">Emlékeztető</option>
            <option value="other">Egyéb</option>
          </select>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-steel hover:bg-teal/10 rounded-lg">Mégse</button>
            <button type="submit" className="px-3 py-1.5 text-sm bg-teal text-cream rounded-lg hover:bg-teal/80">Hozzáadás</button>
          </div>
        </form>
      </div>
    </div>
  );
}
