import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Plus, Clock, Trash2, X,
  SquarePen, ArrowUpDown, ArrowLeft, ArrowRight,
} from 'lucide-react';
import {
  format,
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
  parseISO,
} from 'date-fns';
import { hu } from 'date-fns/locale';
import DatePicker from '../components/DatePicker';
import TimePicker from '../components/TimePicker';
import { useThemedColor } from '../utils/colors';

type ViewMode = 'month' | 'week' | 'day';

function calcDurationFromTimes(startTime: string, endTime: string) {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return Math.max((eh * 60 + em - sh * 60 - sm) / 60, 0);
}

function timesOverlap(s1: string, e1: string, s2: string, e2: string) {
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const start1 = toMin(s1), end1 = toMin(e1), start2 = toMin(s2), end2 = toMin(e2);
  return start1 < end2 && start2 < end1;
}

function eventAccentColor(type?: string): string {
  switch (type) {
    case 'deadline': return 'var(--color-orange-400, #ea580c)';
    case 'meeting': return 'var(--color-amber-400, #d97706)';
    case 'reminder': return 'var(--color-amber-400, #d97706)';
    case 'other': return 'var(--color-ash)';
    default: return 'var(--color-teal)'; // work + fallback
  }
}

export default function Calendar() {
  const navigate = useNavigate();
  const tc = useThemedColor();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [completedHoursMap, setCompletedHoursMap] = useState<Record<string, number>>({});
  const [hoursPage, setHoursPage] = useState(0);

  const activeProjects = allProjects.filter(p => p.status === 'active');

  useEffect(() => {
    loadData();
  }, [currentMonth, viewMode]);

  async function loadData() {
    try {
      let start: string, end: string;
      if (viewMode === 'month') {
        start = format(startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        end = format(endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      } else if (viewMode === 'week') {
        start = format(startOfWeek(currentMonth, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        end = format(endOfWeek(currentMonth, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      } else {
        start = format(currentMonth, 'yyyy-MM-dd');
        end = format(currentMonth, 'yyyy-MM-dd');
      }
      const [eventsData, projectsData, clientsData, completedData] = await Promise.all([
        window.electronAPI.getCalendarEvents(start, end),
        window.electronAPI.getProjects(),
        window.electronAPI.getClients(),
        window.electronAPI.getCompletedHours(),
      ]);
      setEvents(eventsData);
      setAllProjects(projectsData);
      setClients(clientsData);
      const map: Record<string, number> = {};
      for (const row of completedData) map[row.project_id] = row.completed_hours;
      setCompletedHoursMap(map);
    } catch (err) {
      console.error('Failed to load calendar data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateEvent(data: Partial<CalendarEvent>) {
    try {
      await window.electronAPI.createCalendarEvent(data);
      setShowForm(false);
      setEditingEvent(null);
      loadData();
    } catch (err) {
      console.error('Failed to create event:', err);
    }
  }

  async function handleUpdateEvent(id: string, data: Partial<CalendarEvent>) {
    try {
      await window.electronAPI.updateCalendarEvent(id, data);
      setShowForm(false);
      setEditingEvent(null);
      loadData();
    } catch (err) {
      console.error('Failed to update event:', err);
    }
  }

  async function handleDeleteEvent(id: string) {
    try {
      await window.electronAPI.deleteCalendarEvent(id);
      loadData();
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  }

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (clientFilter !== 'all' && e.client_id !== clientFilter) return false;
      if (!showCompleted) {
        const project = allProjects.find(p => p.id === e.project_id);
        if (project && project.status === 'completed') return false;
      }
      return true;
    });
  }, [events, clientFilter, showCompleted, allProjects]);

  // Check for overlapping events on a given date
  function getOverlaps(date: string, startTime: string, endTime: string, excludeId?: string) {
    return filteredEvents.filter(e =>
      e.date === date &&
      e.start_time && e.end_time &&
      e.id !== excludeId &&
      e.type === 'work' &&
      timesOverlap(startTime, endTime, e.start_time, e.end_time)
    );
  }

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: Date[] = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  const weekDays = useMemo(() => {
    const ws = startOfWeek(currentMonth, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  }, [currentMonth]);

  const selectedDateEvents = filteredEvents.filter(e => isSameDay(parseISO(e.date), selectedDate));
  const dayNames = ['Hé', 'Ke', 'Sze', 'Csü', 'Pé', 'Szo', 'Va'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  function navigatePrev() {
    if (viewMode === 'month') setCurrentMonth(subMonths(currentMonth, 1));
    else if (viewMode === 'week') setCurrentMonth(subWeeks(currentMonth, 1));
    else setCurrentMonth(subDays(currentMonth, 1));
  }
  function navigateNext() {
    if (viewMode === 'month') setCurrentMonth(addMonths(currentMonth, 1));
    else if (viewMode === 'week') setCurrentMonth(addWeeks(currentMonth, 1));
    else setCurrentMonth(addDays(currentMonth, 1));
  }
  function getHeaderLabel() {
    if (viewMode === 'month') return format(currentMonth, 'yyyy. MMMM', { locale: hu });
    if (viewMode === 'week') {
      const ws = startOfWeek(currentMonth, { weekStartsOn: 1 });
      const we = endOfWeek(currentMonth, { weekStartsOn: 1 });
      return `${format(ws, 'MMM d.', { locale: hu })} – ${format(we, 'MMM d.', { locale: hu })}`;
    }
    return format(currentMonth, 'yyyy. MMMM d., EEEE', { locale: hu });
  }

  function openEditEvent(event: CalendarEvent) {
    setEditingEvent(event);
    setShowForm(true);
  }

  function handleEventClickInGrid(event: CalendarEvent) {
    setSelectedDate(parseISO(event.date));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-steel"></div>
      </div>
    );
  }

  return (
    <div className={`mx-auto space-y-6 ${viewMode === 'week' ? 'max-w-full' : 'max-w-7xl'}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-xl text-cream">Naptár</h1>
          <p className="text-steel text-sm mt-2">Munkaórák elosztása és időbeosztás</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filter Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                showFilters || clientFilter !== 'all' || showCompleted
                  ? 'bg-teal/20 text-cream'
                  : 'bg-surface-800/50 border border-teal/10 text-steel hover:text-cream hover:bg-teal/10'
              }`}
              title="Szűrők"
            >
              <ArrowUpDown width={18} height={18} />
            </button>
            {showFilters && (
              <div className="absolute right-0 top-11 z-30 bg-surface-800 border border-teal/15 rounded-xl shadow-2xl p-4 space-y-3 min-w-[200px]">
                <div>
                  <label className="block text-[10px] font-medium text-steel/60 tracking-wide mb-1.5">Ügyfél</label>
                  <select
                    value={clientFilter}
                    onChange={e => setClientFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-900 border border-teal/10 rounded-lg text-xs text-cream focus:outline-none focus:ring-1 focus:ring-teal/30 appearance-none cursor-pointer"
                  >
                    <option value="all">Összes ügyfél</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    showCompleted
                      ? 'bg-teal border-teal'
                      : 'border-steel/30 group-hover:border-steel/50'
                  }`}>
                    {showCompleted && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5L4.5 7.5L8 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cream" />
                      </svg>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={showCompleted}
                    onChange={e => setShowCompleted(e.target.checked)}
                    className="sr-only"
                  />
                  <span className="text-xs text-steel group-hover:text-cream transition-colors">Lezárt projektek</span>
                </label>
              </div>
            )}
          </div>
          {/* View Mode */}
          <div className="flex bg-surface-800/50 rounded-lg border border-teal/10 p-0.5">
            {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => { setViewMode(mode); if (mode !== 'month') setCurrentMonth(selectedDate); }}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                  viewMode === mode ? 'bg-teal/20 text-cream' : 'text-steel hover:text-ash'
                }`}
              >
                {mode === 'month' ? 'Hónap' : mode === 'week' ? 'Hét' : 'Nap'}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setEditingEvent(null); setShowForm(true); }}
            className="flex items-center justify-center w-9 h-9 bg-teal text-cream rounded-lg hover:bg-teal/80 transition-colors"
            title="Új bejegyzés"
          >
            <Plus width={18} height={18} />
          </button>
        </div>
      </div>

      <div className={`grid gap-6 ${viewMode === 'week' ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'}`}>
        {/* Calendar Grid */}
        <div className={`bg-surface-800/50 rounded-lg border border-teal/10 p-5 ${viewMode === 'week' ? '' : 'lg:col-span-2'}`}>
          {/* Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={navigatePrev} className="p-1.5 hover:bg-teal/10 rounded-lg text-steel hover:text-cream">
              <ChevronLeft width={18} height={18} />
            </button>
            <h2 className="font-pixel text-[14px] text-cream">{getHeaderLabel()}</h2>
            <button onClick={navigateNext} className="p-1.5 hover:bg-teal/10 rounded-lg text-steel hover:text-cream">
              <ChevronRight width={18} height={18} />
            </button>
          </div>

          {/* Month View */}
          {viewMode === 'month' && (
            <>
              <div className="grid grid-cols-7 border-b border-teal/15">
                {dayNames.map(name => (
                  <div key={name} className="text-center text-xs font-medium text-steel/60 py-2">{name}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 border-l border-teal/10">
                {calendarDays.map((day, idx) => {
                  const dayStr = format(day, 'yyyy-MM-dd');
                  const dayEvents = filteredEvents.filter(e => e.date === dayStr);
                  const isToday = isSameDay(day, new Date());
                  const isSelected = isSameDay(day, selectedDate);
                  const isCurrentMonth = isSameMonth(day, currentMonth);

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(day)}
                      className={`relative min-h-[72px] p-1.5 rounded-lg text-left transition-colors ${
                        isSelected ? 'bg-teal/25 ring-2 ring-teal/50' :
                        isToday ? 'bg-teal/15 ring-1 ring-ash/40' :
                        'hover:bg-teal/5'
                    } ${!isCurrentMonth ? 'opacity-30' : ''} border-r border-b border-teal/10`}
                    >
                      <span className={`text-xs font-medium ${isToday ? 'text-ash' : 'text-steel'}`}>
                        {format(day, 'd')}
                      </span>
                      <div className="space-y-0.5 mt-1">
                        {dayEvents.slice(0, 3).map(event => {
                          const project = allProjects.find(p => p.id === event.project_id);
                          const isCompleted = project?.status === 'completed';
                          return (
                            <div
                              key={event.id}
                              onClick={(e) => { e.stopPropagation(); handleEventClickInGrid(event); }}
                              className={`text-[9px] pl-1.5 pr-1 py-0.5 rounded truncate font-medium cursor-pointer hover:opacity-80 ${isCompleted ? 'opacity-40' : ''}`}
                              style={{
                                backgroundColor: `color-mix(in srgb, ${isCompleted ? 'var(--color-steel)' : (event.color ? tc(event.color) : 'var(--color-teal)')} 25%, transparent)`,
                                color: isCompleted ? 'var(--color-steel)' : 'var(--color-cream)',
                                borderLeft: `2px solid ${isCompleted ? 'var(--color-steel)' : eventAccentColor(event.type)}`,
                              }}
                            >
                              {event.start_time && <span className="mr-0.5">{event.start_time.slice(0, 5)}</span>}
                              {event.title}
                            </div>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <p className="text-[9px] text-steel/60 text-center">+{dayEvents.length - 3}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Week View */}
          {viewMode === 'week' && (() => {
            const HOUR_H = 48;
            const weekStart = weekDays[0];
            const weekEnd = weekDays[6];

            // Build columns of events per day with overlap handling
            const dayColumns = weekDays.map(day => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const dayEvts = filteredEvents
                .filter(e => e.date === dayStr && e.start_time)
                .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

              // Assign overlap columns
              type Placed = { event: CalendarEvent; col: number; totalCols: number; top: number; height: number };
              const placed: Placed[] = [];
              const groups: Placed[][] = [];

              dayEvts.forEach(event => {
                const [sh, sm] = (event.start_time || '0:0').split(':').map(Number);
                const [eh, em] = (event.end_time || event.start_time || '0:0').split(':').map(Number);
                const startMin = sh * 60 + sm;
                const endMin = Math.max(eh * 60 + em, startMin + 30);
                const top = (startMin / 60) * HOUR_H;
                const height = Math.max(((endMin - startMin) / 60) * HOUR_H, 20);

                // Find which group this overlaps with
                let assignedGroup: Placed[] | null = null;
                for (const group of groups) {
                  const overlaps = group.some(g => {
                    const gStart = g.top;
                    const gEnd = g.top + g.height;
                    return top < gEnd && (top + height) > gStart;
                  });
                  if (overlaps) {
                    assignedGroup = group;
                    break;
                  }
                }

                const item: Placed = { event, col: 0, totalCols: 1, top, height };

                if (assignedGroup) {
                  // Find first free column
                  const usedCols = new Set(assignedGroup.filter(g => {
                    const gEnd = g.top + g.height;
                    return top < gEnd && (top + height) > g.top;
                  }).map(g => g.col));
                  let col = 0;
                  while (usedCols.has(col)) col++;
                  item.col = col;
                  assignedGroup.push(item);
                  // Update totalCols for entire group
                  const maxCol = Math.max(...assignedGroup.map(g => g.col)) + 1;
                  assignedGroup.forEach(g => g.totalCols = maxCol);
                } else {
                  const newGroup = [item];
                  groups.push(newGroup);
                }

                placed.push(item);
              });

              return placed;
            });

            return (
              <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
                {/* Day headers */}
                <div className="grid grid-cols-[50px_repeat(7,1fr)] sticky top-0 bg-surface-800/50 z-10 border-b border-teal/20">
                  <div />
                  {weekDays.map((day, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(day)}
                      className={`text-center py-2 text-xs font-medium transition-colors ${
                        isSameDay(day, selectedDate) ? 'text-cream bg-teal/15' :
                        isSameDay(day, new Date()) ? 'text-ash' : 'text-steel'
                      }`}
                    >
                      <div>{dayNames[i]}</div>
                      <div className="text-sm font-bold">{format(day, 'd')}</div>
                    </button>
                  ))}
                </div>
                {/* Time grid */}
                <div className="grid grid-cols-[50px_repeat(7,1fr)] relative" style={{ height: 24 * HOUR_H }}>
                  {/* Hour labels + lines */}
                  {hours.map(hour => (
                    <div key={hour} className="contents">
                      <div
                        className="text-[10px] text-steel/50 text-right pr-2 pt-0.5"
                        style={{ position: 'absolute', left: 0, top: hour * HOUR_H, width: 50 }}
                      >
                        {String(hour).padStart(2, '0')}:00
                      </div>
                      <div
                        className="border-b border-teal/15"
                        style={{ position: 'absolute', left: 50, right: 0, top: hour * HOUR_H, height: HOUR_H }}
                      />
                    </div>
                  ))}
                  {/* Day columns with events */}
                  {weekDays.map((day, di) => (
                    <div
                      key={di}
                      className="relative border-l border-teal/15"
                      style={{ gridColumn: di + 2, gridRow: 1, height: 24 * HOUR_H }}
                      onClick={() => setSelectedDate(day)}
                    >
                      {dayColumns[di].map(({ event, col, totalCols, top, height }) => {
                        const project = allProjects.find(p => p.id === event.project_id);
                        const isCompleted = project?.status === 'completed';
                        return (
                          <div
                            key={event.id}
                            onClick={(e) => { e.stopPropagation(); handleEventClickInGrid(event); }}
                            onDoubleClick={(e) => { e.stopPropagation(); openEditEvent(event); }}
                            className={`absolute text-[8px] pl-1.5 pr-1 py-0.5 rounded font-medium cursor-pointer hover:opacity-80 overflow-hidden ${isCompleted ? 'opacity-40' : ''}`}
                            style={{
                              top,
                              height,
                              left: `${(col / totalCols) * 100}%`,
                              width: `${(1 / totalCols) * 100 - 1}%`,
                              backgroundColor: `color-mix(in srgb, ${isCompleted ? 'var(--color-steel)' : (event.color ? tc(event.color) : 'var(--color-teal)')} 25%, transparent)`,
                              color: isCompleted ? 'var(--color-steel)' : 'var(--color-cream)',
                              borderLeft: `2px solid ${isCompleted ? 'var(--color-steel)' : eventAccentColor(event.type)}`,
                              zIndex: 5,
                            }}
                          >
                            {event.start_time?.slice(0, 5)} {event.title}
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
          {viewMode === 'day' && (() => {
            const DAY_HOUR_H = 56;
            const dayStr = format(currentMonth, 'yyyy-MM-dd');
            const dayEvts = filteredEvents
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
              const top = (startMin / 60) * DAY_HOUR_H;
              const height = Math.max(((endMin - startMin) / 60) * DAY_HOUR_H, 28);

              let assignedGroup: DPlaced[] | null = null;
              for (const group of groups) {
                if (group.some(g => top < g.top + g.height && (top + height) > g.top)) {
                  assignedGroup = group;
                  break;
                }
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

            return (
              <div className="overflow-auto max-h-[600px]">
                <div className="grid grid-cols-[60px_1fr] relative" style={{ height: 24 * DAY_HOUR_H }}>
                  {hours.map(hour => (
                    <div key={hour} className="contents">
                      <div
                        className="text-xs text-steel/50 text-right pr-3 pt-1"
                        style={{ position: 'absolute', left: 0, top: hour * DAY_HOUR_H, width: 60 }}
                      >
                        {String(hour).padStart(2, '0')}:00
                      </div>
                      <div
                        className="border-b border-teal/15"
                        style={{ position: 'absolute', left: 60, right: 0, top: hour * DAY_HOUR_H, height: DAY_HOUR_H }}
                      />
                    </div>
                  ))}
                  <div className="relative" style={{ gridColumn: 2, gridRow: 1, height: 24 * DAY_HOUR_H }}>
                    {placed.map(({ event, col, totalCols, top, height }) => {
                      const project = allProjects.find(p => p.id === event.project_id);
                      const isCompleted = project?.status === 'completed';
                      const dur = event.start_time && event.end_time ? calcDurationFromTimes(event.start_time, event.end_time) : 1;
                      return (
                        <div
                          key={event.id}
                          onClick={() => handleEventClickInGrid(event)}
                          onDoubleClick={() => openEditEvent(event)}
                          className={`absolute p-2 rounded-lg cursor-pointer hover:opacity-80 overflow-hidden ${isCompleted ? 'opacity-40' : ''}`}
                          style={{
                            top,
                            height,
                            left: `${(col / totalCols) * 100}%`,
                            width: `${(1 / totalCols) * 100 - 1}%`,
                            backgroundColor: `color-mix(in srgb, ${isCompleted ? 'var(--color-steel)' : (event.color ? tc(event.color) : 'var(--color-teal)')} 20%, transparent)`,
                            borderLeft: `3px solid ${isCompleted ? 'var(--color-steel)' : eventAccentColor(event.type)}`,
                            zIndex: 5,
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium" style={{ color: isCompleted ? 'var(--color-steel)' : 'var(--color-cream)' }}>
                              {event.start_time?.slice(0, 5)} – {event.end_time?.slice(0, 5)} • {event.title}
                            </span>
                            <span className="text-[10px] text-steel">{dur.toFixed(1)}h</span>
                          </div>
                          {event.client_name && (
                            <p className="text-[10px] text-steel mt-0.5">{event.client_name}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Selected Day Events - hidden in week view */}
        {viewMode !== 'week' && <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-5">
          <h3 className="font-semibold text-cream mb-1">
            {format(selectedDate, 'yyyy. MMMM d.', { locale: hu })}
          </h3>
          <p className="text-xs text-steel/60 mb-4">
            {format(selectedDate, 'EEEE', { locale: hu })}
          </p>

          {selectedDateEvents.length === 0 ? (
            <p className="text-sm text-steel/60 italic text-center py-8">Nincsenek bejegyzések</p>
          ) : (
            <div className="space-y-2">
              {selectedDateEvents.map(event => {
                const project = allProjects.find(p => p.id === event.project_id);
                const isCompleted = project?.status === 'completed';
                return (
                  <div
                    key={event.id}
                    className={`p-3 rounded-lg border border-teal/10 group ${isCompleted ? 'opacity-50' : ''} ${event.project_id ? 'cursor-pointer hover:border-teal/25' : ''}`}
                    onDoubleClick={() => openEditEvent(event)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2" onClick={() => event.project_id && navigate(`/projects/${event.project_id}`)}>
                        <div
                          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                          style={{ backgroundColor: isCompleted ? 'var(--color-steel)' : (event.color ? tc(event.color) : 'var(--color-teal)') }}
                        />
                        <div>
                          <h4 className="text-sm font-medium text-cream">{event.title}</h4>
                          {event.client_name && (
                            <p className="text-[10px] text-steel">{event.client_name} • {event.project_name}</p>
                          )}
                          {event.start_time && (
                            <p className="text-xs text-steel mt-0.5">
                              {event.start_time} - {event.end_time}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {event.start_time && event.end_time && (
                          <span className="flex items-center gap-0.5 text-xs text-ash">
                            <Clock width={10} height={10} /> {calcDurationFromTimes(event.start_time, event.end_time).toFixed(1)}h
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditEvent(event); }}
                          className="p-1 rounded hover:bg-teal/10 text-steel/40 hover:text-cream opacity-0 group-hover:opacity-100 transition-all"
                          title="Szerkesztés"
                        >
                          <SquarePen width={12} height={12} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }}
                          className="p-1 rounded hover:bg-red-500/10 text-steel/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 width={12} height={12} />
                        </button>
                      </div>
                    </div>
                    {event.description && (
                      <p className="text-xs text-steel mt-1 ml-4">{event.description}</p>
                    )}
                  </div>
                );
              })}
              <div className="pt-2 border-t border-teal/10">
                <p className="text-xs text-steel flex items-center gap-1">
                  <Clock width={11} height={11} />
                  Összesen: {selectedDateEvents.reduce((sum, e) => {
                    if (e.start_time && e.end_time) return sum + calcDurationFromTimes(e.start_time, e.end_time);
                    return sum + (e.duration_hours || 0);
                  }, 0).toFixed(1)} óra
                </p>
              </div>
            </div>
          )}
        </div>}
      </div>

      {/* Active Projects Hours Overview */}
      {activeProjects.length > 0 && (() => {
        const ITEMS_PER_PAGE = 10;
        const sorted = [...activeProjects].sort((a, b) => {
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return a.deadline.localeCompare(b.deadline);
        });
        const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
        const page = Math.min(hoursPage, totalPages - 1);
        const paged = sorted.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
        return (
          <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-pixel text-[13px] text-ash">Projektek haladása</h2>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setHoursPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="text-xs text-steel hover:text-cream disabled:opacity-30 disabled:cursor-not-allowed px-1.5 py-0.5"
                  ><ArrowLeft width={12} height={12} /></button>
                  <span className="text-xs text-steel">{page + 1}/{totalPages}</span>
                  <button
                    onClick={() => setHoursPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="text-xs text-steel hover:text-cream disabled:opacity-30 disabled:cursor-not-allowed px-1.5 py-0.5"
                  ><ArrowRight width={12} height={12} /></button>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {paged.map(project => {
                const completed = completedHoursMap[project.id] || 0;
                const total = project.allocated_hours || 0;
                const percent = total > 0 ? (completed / total) * 100 : 0;
                return (
                  <div key={project.id} className="flex items-center gap-3">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: tc(project.color || project.client_color) }}
                    />
                    <span className="text-sm text-cream w-40 truncate" title={project.name}>{project.name}</span>
                    <div className="flex-1 h-1.5 bg-teal/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(percent, 100)}%`,
                          backgroundColor: percent >= 100 ? '#4ade80' : 'var(--color-steel)',
                        }}
                      />
                    </div>
                    <span className="text-xs text-steel w-28 text-right">
                      {completed.toFixed(1)}/{total.toFixed(1)}h ({Math.round(percent)}%)
                    </span>
                    {percent >= 100 ? (
                      <span className="text-[10px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded w-16 text-center">Kész</span>
                    ) : (
                      <span className="text-[10px] text-steel/60 w-16 text-center">
                        {project.deadline ? project.deadline.replace(/-/g, '. ') + '.' : '—'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Create/Edit Event Modal */}
      {showForm && (
        <EventFormModal
          projects={activeProjects}
          allEvents={events}
          selectedDate={selectedDate}
          editingEvent={editingEvent}
          onSubmit={editingEvent
            ? (data) => handleUpdateEvent(editingEvent.id, data)
            : handleCreateEvent
          }
          onClose={() => { setShowForm(false); setEditingEvent(null); }}
          getOverlaps={getOverlaps}
        />
      )}
    </div>
  );
}

function EventFormModal({ projects, allEvents, selectedDate, editingEvent, onSubmit, onClose, getOverlaps }: {
  projects: Project[];
  allEvents: CalendarEvent[];
  selectedDate: Date;
  editingEvent: CalendarEvent | null;
  onSubmit: (data: Partial<CalendarEvent>) => void;
  onClose: () => void;
  getOverlaps: (date: string, start: string, end: string, excludeId?: string) => CalendarEvent[];
}) {
  const [title, setTitle] = useState(editingEvent?.title || '');
  const tc = useThemedColor();
  const [projectId, setProjectId] = useState(editingEvent?.project_id || '');
  const [date, setDate] = useState(editingEvent?.date || format(selectedDate, 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState(editingEvent?.start_time || '09:00');
  const [endTime, setEndTime] = useState(editingEvent?.end_time || '10:00');
  const [type, setType] = useState<'work' | 'meeting' | 'deadline' | 'reminder' | 'other'>(editingEvent?.type || 'work');
  const [description, setDescription] = useState(editingEvent?.description || '');

  useEffect(() => {
    if (projectId && !title && !editingEvent) {
      const project = projects.find(p => p.id === projectId);
      if (project) setTitle(project.name);
    }
  }, [projectId]);

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

  const overlaps = getOverlaps(date, startTime, endTime, editingEvent?.id);
  const dayEvents = allEvents.filter(e => e.date === date).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

  const inputClass = "w-full px-3 py-2 bg-surface-900 border border-teal/10 rounded-lg text-sm text-cream focus:outline-none focus:ring-2 focus:ring-teal/30";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onDoubleClick={onClose}>
      <div className="bg-surface-800 rounded-xl border border-teal/15 p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-auto" onDoubleClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-pixel text-[14px] text-cream">
            {editingEvent ? 'Bejegyzés szerkesztése' : 'Új naptárbejegyzés'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-teal/10 text-steel hover:text-cream">
            <X width={14} height={14} />
          </button>
        </div>

        {/* Day preview - show existing events for selected date */}
        {dayEvents.length > 0 && (
          <div className="mb-4 bg-surface-900 rounded-lg border border-teal/10 p-3">
            <p className="text-[10px] text-steel tracking-wider mb-2">
              {format(parseISO(date), 'MMMM d.', { locale: hu })} – meglévő bejegyzések
            </p>
            <div className="space-y-1 max-h-28 overflow-auto">
              {dayEvents.map(ev => (
                <div key={ev.id} className="flex items-center gap-2 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ev.color ? tc(ev.color) : 'var(--color-teal)' }} />
                  <span className="text-steel/80">{ev.start_time?.slice(0, 5)} – {ev.end_time?.slice(0, 5)}</span>
                  <span className="text-cream truncate">{ev.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Overlap warning */}
        {overlaps.length > 0 && type === 'work' && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-xs text-red-400 font-medium">⚠ Ütközés: a kiválasztott időszak átfedésben van más munkaórákkal!</p>
            <div className="mt-1 space-y-0.5">
              {overlaps.map(o => (
                <p key={o.id} className="text-[10px] text-red-400/80">
                  {o.start_time} – {o.end_time}: {o.title}
                </p>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={e => {
            e.preventDefault();
            if (!title.trim() || !date) return;
            if (overlaps.length > 0 && type === 'work') return;
            onSubmit({
              title: title.trim(),
              project_id: projectId || undefined,
              date,
              start_time: startTime,
              end_time: endTime,
              duration_hours: calcDuration(),
              type,
              description,
              color: projectId ? (projects.find(p => p.id === projectId)?.color || projects.find(p => p.id === projectId)?.client_color) : undefined,
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-steel mb-1">Projekt (opcionális)</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} className={inputClass}>
              <option value="">Nincs projekt</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.client_name ? `${p.client_name} – ` : ''}{p.name} ({Number(p.allocated_hours).toFixed(1)}/{p.estimated_hours}h)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-steel mb-1">Cím *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputClass} placeholder="Bejegyzés címe" required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-steel mb-1">Dátum</label>
              <DatePicker value={date} onChange={setDate} />
            </div>
            <div>
              <label className="block text-xs font-medium text-steel mb-1">Kezdés</label>
              <TimePicker value={startTime} onChange={handleStartTimeChange} />
            </div>
            <div>
              <label className="block text-xs font-medium text-steel mb-1">Befejezés</label>
              <TimePicker value={endTime} onChange={handleEndTimeChange} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-steel mb-1">Típus</label>
            <select value={type} onChange={e => setType(e.target.value as typeof type)} className={inputClass}>
              <option value="work">Munka</option>
              <option value="meeting">Megbeszélés</option>
              <option value="deadline">Határidő</option>
              <option value="reminder">Emlékeztető</option>
              <option value="other">Egyéb</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-steel mb-1">Leírás</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className={`${inputClass} resize-none h-16`} placeholder="Részletek..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-steel hover:bg-teal/10 rounded-lg">Mégse</button>
            <button
              type="submit"
              disabled={overlaps.length > 0 && type === 'work'}
              className={`px-4 py-2 text-sm rounded-lg ${
                overlaps.length > 0 && type === 'work'
                  ? 'bg-teal/20 text-steel/40 cursor-not-allowed'
                  : 'bg-teal text-cream hover:bg-teal/80'
              }`}
            >
              {editingEvent ? 'Mentés' : 'Létrehozás'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
