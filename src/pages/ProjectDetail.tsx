import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Clock, Calendar, StickyNote, Receipt, FileText,
  Plus, Check, AlertTriangle, Trash2, Pencil, User, ArrowRight, FolderOpen, Settings2, X,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay } from 'date-fns';
import { hu } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { ProjectForm, TimeSlot } from './Projects';
import InvoiceUploadModal from '../components/InvoiceUploadModal';
import InvoicePdfViewer from '../components/InvoicePdfViewer';
import TimePicker from '../components/TimePicker';
import { useThemedColor } from '../utils/colors';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tc = useThemedColor();
  const hasInvoicing = user?.invoice_platform && user.invoice_platform !== 'none';
  const [project, setProject] = useState<Project | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'invoices'>('overview');
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showManageHours, setShowManageHours] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  async function loadData() {
    try {
      const [projectData, notesData, eventsData, invoicesData, clientsData] = await Promise.all([
        window.electronAPI.getProject(id!),
        window.electronAPI.getNotes(id!),
        window.electronAPI.getCalendarEvents('2000-01-01', '2099-12-31'),
        window.electronAPI.getInvoices(id!),
        window.electronAPI.getClients(),
      ]);
      setProject(projectData);
      setNotes(notesData);
      setCalendarEvents(eventsData.filter(e => e.project_id === id));
      setInvoices(invoicesData);
      setAllClients(clientsData);
    } catch (err) {
      console.error('Failed to load project data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddNote(data: { title: string; content: string; is_notification: boolean }) {
    try {
      await window.electronAPI.createNote({
        project_id: id,
        client_id: project?.client_id,
        title: data.title,
        content: data.content,
        is_notification: data.is_notification ? 1 : 0,
      });
      setShowNoteForm(false);
      loadData();
    } catch (err) {
      console.error('Failed to add note:', err);
    }
  }

  async function handleCloseProject() {
    try {
      await window.electronAPI.closeProject(id!);
      setShowCloseConfirm(false);
      loadData();
    } catch (err) {
      console.error('Failed to close project:', err);
    }
  }

  async function handleEditProject(data: { project: Partial<Project>; timeSlots: TimeSlot[] }) {
    try {
      await window.electronAPI.updateProject(id!, data.project);
      setShowEditForm(false);
      loadData();
    } catch (err) {
      console.error('Failed to update project:', err);
    }
  }

  async function handleDeleteNote(noteId: string) {
    try {
      await window.electronAPI.deleteNote(noteId);
      loadData();
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  }

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-steel"></div>
      </div>
    );
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const nowTime = now.toTimeString().slice(0, 5);
  const completedHours = calendarEvents.filter(e =>
    e.date < todayStr || (e.date === todayStr && e.end_time <= nowTime)
  ).reduce((sum, e) => sum + (e.duration_hours || 0), 0);
  const allocatedHours = project.allocated_hours || 0;
  const hoursPercent = allocatedHours > 0 ? (completedHours / allocatedHours) * 100 : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <button
        onClick={() => navigate('/projects')}
        className="flex items-center gap-2 text-sm text-steel hover:text-cream transition-colors"
      >
        <ArrowLeft width={16} height={16} /> Vissza a projektekhez
      </button>

      {/* Project Header */}
      <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              {project.client_name ? (
                <>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tc(project.client_color) }}
                  />
                  <span className="text-sm text-steel">{project.client_name}</span>
                </>
              ) : (
                <span className="text-sm text-steel/60 italic">Személyes projekt</span>
              )}
            </div>
            <h1 className="font-pixel text-base text-cream mt-2">{project.name}</h1>
            {project.description && (
              <p className="text-steel mt-2">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${
              project.status === 'active' ? 'bg-blue-500/10 text-blue-400' :
              project.status === 'completed' ? 'bg-green-500/10 text-green-400' :
              project.status === 'on_hold' ? 'bg-amber-500/10 text-amber-400' :
              'bg-red-500/10 text-red-400'
            }`}>
              {project.status === 'active' ? 'Aktív' :
               project.status === 'completed' ? 'Befejezett' :
               project.status === 'on_hold' ? 'Szünetelő' : 'Törölve'}
            </span>
            <button
              onClick={() => {
                const path = project.client_name
                  ? `${project.client_name}/${project.name}`
                  : project.name;
                navigate(`/files?path=${encodeURIComponent(path)}`);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-steel/20 text-cream rounded-lg text-xs font-medium hover:bg-steel/30"
            >
              <FolderOpen width={13} height={13} /> Fájlok
            </button>
            {project.status === 'active' && (
              <>
                <button
                  onClick={() => setShowEditForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-steel/20 text-cream rounded-lg text-xs font-medium hover:bg-steel/30"
                >
                  <Pencil width={13} height={13} /> Szerkesztés
                </button>
                {hasInvoicing && (
                  invoices.length > 0 ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-teal/15 text-teal rounded-lg text-xs font-medium">
                      <Check width={13} height={13} /> Számlázva
                    </span>
                  ) : (
                    <button
                      onClick={() => setShowInvoiceForm(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-steel/20 text-cream rounded-lg text-xs font-medium hover:bg-steel/30"
                    >
                      <Receipt width={13} height={13} /> Számlázás
                    </button>
                  )
                )}
                <button
                  onClick={() => setShowCloseConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700"
                >
                  <Check width={13} height={13} /> Lezárás
                </button>
              </>
            )}
            {project.status === 'completed' && hasInvoicing && (
              invoices.length > 0 ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-teal/15 text-teal rounded-lg text-xs font-medium">
                  <Check width={13} height={13} /> Számlázva
                </span>
              ) : (
                <button
                  onClick={() => setShowInvoiceForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-steel/20 text-cream rounded-lg text-xs font-medium hover:bg-steel/30"
                >
                  <Receipt width={13} height={13} /> Számlázás
                </button>
              )
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-teal/5 rounded-lg p-4">
            <div className="flex items-center justify-between text-steel text-xs mb-2">
              <div className="flex items-center gap-2">
                <Clock width={13} height={13} /> Teljesített munkaórák
              </div>
              {project.status === 'active' && (
                <button
                  onClick={() => setShowManageHours(true)}
                  className="flex items-center gap-1 text-[10px] text-steel hover:text-cream transition-colors"
                >
                  <Settings2 width={10} height={10} /> Kezelés
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-teal/15 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(hoursPercent, 100)}%`,
                    backgroundColor: hoursPercent >= 100 ? '#4ade80' : '#598392',
                  }}
                />
              </div>
              <span className="text-sm font-bold text-cream">
                {completedHours.toFixed(1)}/{allocatedHours.toFixed(1)}h
              </span>
            </div>
            {!project.is_hours_distributed && project.status === 'active' && (
              <p className="text-[10px] text-amber-400 mt-2 flex items-center gap-1">
                <AlertTriangle width={10} height={10} />
                Az órákat el kell osztanod a naptárban
              </p>
            )}
          </div>
          <div className="bg-teal/5 rounded-lg p-4">
            <div className="flex items-center gap-2 text-steel text-xs mb-2">
              <Calendar width={13} height={13} /> Határidő
            </div>
            <p className="text-sm font-bold text-cream">
              {project.deadline ? format(parseISO(project.deadline), 'yyyy. MM. dd.') : <span className="text-steel/40 font-normal italic">Nincs határidő</span>}
            </p>
          </div>
          <div className="bg-teal/5 rounded-lg p-4">
            <div className="flex items-center gap-2 text-steel text-xs mb-2">
              <Calendar width={13} height={13} /> Naptárbejegyzések
            </div>
            <p className="text-sm font-bold text-cream">{calendarEvents.length} bejegyzés</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-800/30 p-1 rounded-lg border border-teal/5">
        {[
          { key: 'overview' as const, label: 'Naptárbejegyzések', icon: Calendar },
          { key: 'notes' as const, label: 'Jegyzetek', icon: StickyNote, count: notes.length },
          ...(hasInvoicing ? [{ key: 'invoices' as const, label: 'Számlák', icon: Receipt, count: invoices.length }] : []),
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-teal/20 text-cream'
                : 'text-steel hover:text-ash'
            }`}
          >
            <tab.icon width={15} height={15} />
            {tab.label}
            {tab.count !== undefined && (
              <span className="text-xs bg-teal/10 text-steel px-1.5 py-0.5 rounded-full">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          {calendarEvents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-steel/60 text-sm">Nincs naptárbejegyzés ehhez a projekthez</p>
              <button
                onClick={() => navigate('/calendar')}
                className="mt-2 text-sm text-ash hover:text-cream"
              >
                Menj a naptárba és oszd el az órákat <ArrowRight width={14} height={14} className="inline" />
              </button>
            </div>
          ) : (
            calendarEvents.map(event => (
              <div key={event.id} className="bg-surface-800/50 rounded-lg border border-teal/10 p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-cream text-sm">{event.title}</h3>
                  <p className="text-xs text-steel mt-0.5">
                    {format(parseISO(event.date), 'yyyy. MM. dd.')}
                    {event.start_time && ` • ${event.start_time} - ${event.end_time}`}
                  </p>
                </div>
                <span className="text-sm font-medium text-ash">{event.duration_hours}h</span>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNoteForm(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-teal text-cream rounded-lg text-sm hover:bg-teal/80"
            >
              <Plus width={14} height={14} /> Jegyzet hozzáadása
            </button>
          </div>
          {notes.length === 0 ? (
            <p className="text-sm text-steel/60 italic text-center py-8">Nincsenek jegyzetek</p>
          ) : (
            notes.map(note => (
              <div key={note.id} className="bg-surface-800/50 rounded-lg border border-teal/10 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-cream text-sm">{note.title || 'Jegyzet'}</h3>
                      {note.is_notification === 1 && (
                        <span className="text-[10px] bg-amber-400/10 text-amber-400 px-1.5 py-0.5 rounded">Értesítés</span>
                      )}
                    </div>
                    <p className="text-sm text-steel mt-1">{note.content}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-steel/60">{format(parseISO(note.date), 'yyyy. MM. dd.')}</span>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1 rounded hover:bg-red-500/10 text-steel hover:text-red-400"
                    >
                      <Trash2 width={13} height={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="space-y-3">
          {invoices.length === 0 ? (
            <p className="text-sm text-steel/60 italic text-center py-8">Még nincsenek számlák ehhez a projekthez.</p>
          ) : (
            invoices.map(invoice => (
              <div key={invoice.id} className="bg-surface-800/50 rounded-lg border border-teal/10 p-4 flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-green-500/10 flex items-center justify-center">
                    <FileText width={14} height={14} className="text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-cream text-sm">{invoice.invoice_number || 'Számla'}</h3>
                    <p className="text-xs text-steel">{format(parseISO(invoice.created_at), 'yyyy. MM. dd.')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-green-400">
                    {new Intl.NumberFormat('hu-HU', { style: 'currency', currency: invoice.currency, maximumFractionDigits: 0 }).format(invoice.amount)}
                  </span>
                  {invoice.file_path && (
                    <button
                      onClick={() => setViewingInvoice(invoice)}
                      className="px-2 py-1 text-xs text-steel hover:text-cream hover:bg-teal/10 rounded opacity-0 group-hover:opacity-100 transition-all"
                    >
                      PDF megnyitása
                    </button>
                  )}
                  <button
                    onClick={async (e) => { e.stopPropagation(); await window.electronAPI.deleteInvoice(invoice.id); loadData(); }}
                    className="p-1.5 rounded hover:bg-red-500/10 text-steel/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    title="Számla törlése"
                  >
                    <Trash2 width={13} height={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Note Form Modal */}
      {showNoteForm && (
        <NoteFormModal
          onSubmit={handleAddNote}
          onClose={() => setShowNoteForm(false)}
        />
      )}

      {/* Close Project Confirm */}
      {showCloseConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCloseConfirm(false)}>
          <div className="bg-surface-800 rounded-xl border border-teal/15 p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="font-pixel text-[14px] text-cream mb-2">Projekt lezárása</h2>
            <p className="text-sm text-steel mb-6">
              Biztosan le szeretnéd zárni a projektet? A lezárt projekt a naptárban szürkén jelenik meg.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCloseConfirm(false)} className="px-4 py-2 text-sm text-steel hover:bg-teal/10 rounded-lg">Mégse</button>
              <button onClick={handleCloseProject} className="px-4 py-2 text-sm rounded-lg font-medium bg-green-600 text-white hover:bg-green-700">Lezárás</button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoiceForm && project && (
        <InvoiceUploadModal
          clients={allClients}
          projectId={id}
          defaultClientId={project.client_id || undefined}
          onClose={() => setShowInvoiceForm(false)}
          onSaved={() => { setShowInvoiceForm(false); loadData(); }}
        />
      )}

      {/* Edit Project Modal */}
      {showEditForm && project && (
        <ProjectForm
          clients={allClients}
          editProject={project}
          onSubmit={handleEditProject}
          onClose={() => setShowEditForm(false)}
        />
      )}

      {/* Invoice PDF Viewer */}
      {viewingInvoice && viewingInvoice.file_path && (
        <InvoicePdfViewer invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} />
      )}

      {/* Manage Hours Modal */}
      {showManageHours && project && (
        <ManageHoursModal
          project={project}
          calendarEvents={calendarEvents}
          onClose={() => setShowManageHours(false)}
          onRefresh={loadData}
        />
      )}
    </div>
  );
}

function ManageHoursModal({ project, calendarEvents: projectEvents, onClose, onRefresh }: {
  project: Project;
  calendarEvents: CalendarEvent[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const tc = useThemedColor();
  const [estimatedHours, setEstimatedHours] = useState(String(project.estimated_hours));
  const [saving, setSaving] = useState(false);

  // Track existing project events (can be deleted) and newly added slots
  const [existingProjectEvents, setExistingProjectEvents] = useState<CalendarEvent[]>(() =>
    [...projectEvents].sort((a, b) => a.date.localeCompare(b.date) || (a.start_time || '').localeCompare(b.start_time || ''))
  );
  const [newSlots, setNewSlots] = useState<TimeSlot[]>([]);

  // Calendar state
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [slotStart, setSlotStart] = useState('09:00');
  const [slotEnd, setSlotEnd] = useState('10:00');
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);

  const parsedEst = parseFloat(estimatedHours) || 0;
  const existingHours = existingProjectEvents.reduce((sum, e) => sum + (e.duration_hours || 0), 0);
  const newHours = newSlots.reduce((sum, s) => sum + s.duration, 0);
  const allocatedHours = existingHours + newHours;
  const remaining = parsedEst - allocatedHours;
  const isFullyAllocated = remaining <= 0 && parsedEst > 0;

  // Fetch all calendar events for context (other projects' events)
  useEffect(() => {
    const monthStart = startOfMonth(calMonth);
    const monthEnd = endOfMonth(calMonth);
    const sd = startOfWeek(monthStart, { weekStartsOn: 1 });
    const ed = endOfWeek(monthEnd, { weekStartsOn: 1 });
    window.electronAPI.getCalendarEvents(
      format(sd, 'yyyy-MM-dd'),
      format(ed, 'yyyy-MM-dd')
    ).then(setAllEvents).catch(console.error);
  }, [calMonth, existingProjectEvents]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calMonth);
    const monthEnd = endOfMonth(monthStart);
    const sd = startOfWeek(monthStart, { weekStartsOn: 1 });
    const ed = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days: Date[] = [];
    let day = sd;
    while (day <= ed) { days.push(day); day = addDays(day, 1); }
    return days;
  }, [calMonth]);

  const dayNames = ['Hé', 'Ke', 'Sze', 'Csü', 'Pé', 'Szo', 'Va'];

  function addSlotForDay() {
    if (!selectedDay) return;
    const [sh, sm] = slotStart.split(':').map(Number);
    const [eh, em] = slotEnd.split(':').map(Number);
    const duration = (eh * 60 + em - sh * 60 - sm) / 60;
    if (duration <= 0) return;
    setNewSlots(prev => [...prev, {
      id: crypto.randomUUID(),
      date: format(selectedDay, 'yyyy-MM-dd'),
      start_time: slotStart,
      end_time: slotEnd,
      duration: Math.round(duration * 100) / 100,
    }]);
    setSlotStart(slotEnd);
    const nextEnd = eh * 60 + em + duration * 60;
    const newH = Math.min(Math.floor(nextEnd / 60), 23);
    const newM = Math.round(nextEnd % 60);
    setSlotEnd(`${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
  }

  async function handleDeleteExistingEvent(eventId: string) {
    try {
      await window.electronAPI.deleteCalendarEvent(eventId);
      setExistingProjectEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  }

  async function handleDone() {
    setSaving(true);
    try {
      // Create calendar events for new slots
      for (const slot of newSlots) {
        await window.electronAPI.createCalendarEvent({
          project_id: project.id,
          title: project.name,
          date: slot.date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          duration_hours: slot.duration,
          type: 'work',
          color: project.color || project.client_color,
        });
      }
      // Update estimated hours if changed
      if (parsedEst !== project.estimated_hours) {
        await window.electronAPI.updateProject(project.id, { estimated_hours: parsedEst });
      }
      // Mark hours as distributed if they weren't
      if (!project.is_hours_distributed && (existingProjectEvents.length > 0 || newSlots.length > 0)) {
        await window.electronAPI.updateProject(project.id, { is_hours_distributed: 1 });
      }
      onRefresh();
      onClose();
    } catch (err) {
      console.error('Failed to save:', err);
      setSaving(false);
    }
  }

  // Set of existing project event IDs for filtering in calendar
  const projectEventIds = new Set(existingProjectEvents.map(e => e.id));

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onDoubleClick={handleDone}>
      <div className="bg-surface-800 rounded-2xl border border-teal/15 w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col overflow-hidden" onDoubleClick={e => e.stopPropagation()}>
        <div className="h-1 bg-gradient-to-r from-teal via-steel to-teal/30" />
        <div className="p-5 flex flex-col flex-1 min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="font-pixel text-[14px] text-cream">Munkaórák kezelése</span>
            <button type="button" onClick={handleDone} className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream cursor-pointer transition-colors">
              <X width={14} height={14} />
            </button>
          </div>

          <div className="space-y-4 overflow-auto flex-1 pr-1 -mr-1">
            {/* Estimated hours + progress */}
            <div className="bg-surface-900/40 rounded-lg p-4 border border-teal/8">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1">
                  <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Becsült órák</span>
                  <input
                    type="number"
                    value={estimatedHours}
                    onChange={e => setEstimatedHours(e.target.value)}
                    className="w-full px-2.5 py-2 bg-surface-900/40 border border-teal/8 rounded-lg text-sm text-cream focus:outline-none focus:border-teal/25 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    min="0.5"
                    step="0.5"
                  />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Elosztott munkaórák</span>
                  <div className={`text-sm font-bold px-2.5 py-2 ${isFullyAllocated ? 'text-green-400' : 'text-cream'}`}>
                    {allocatedHours.toFixed(1)} / {parsedEst.toFixed(1)} óra
                  </div>
                </div>
              </div>
              <div className="h-2 bg-teal/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${parsedEst > 0 ? Math.min((allocatedHours / parsedEst) * 100, 100) : 0}%`,
                    backgroundColor: isFullyAllocated ? '#4ade80' : '#598392',
                  }}
                />
              </div>
              {!isFullyAllocated && remaining > 0 && (
                <p className="text-[10px] text-amber-400 mt-2 flex items-center gap-1">
                  <AlertTriangle width={10} height={10} />
                  Még {remaining.toFixed(1)} órát kell elosztanod
                </p>
              )}
            </div>

            {/* Calendar */}
            <div className="relative">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={() => setCalMonth(subMonths(calMonth, 1))} className="p-1 hover:bg-teal/10 rounded text-steel hover:text-cream cursor-pointer">
                  <ChevronLeft width={14} height={14} />
                </button>
                <span className="text-xs font-medium text-cream">
                  {format(calMonth, 'yyyy. MMMM', { locale: hu })}
                </span>
                <button type="button" onClick={() => setCalMonth(addMonths(calMonth, 1))} className="p-1 hover:bg-teal/10 rounded text-steel hover:text-cream cursor-pointer">
                  <ChevronRight width={14} height={14} />
                </button>
              </div>

              {/* Day names */}
              <div className="grid grid-cols-7 mb-1">
                {dayNames.map(n => (
                  <div key={n} className="text-center text-[9px] text-steel/60 py-1">{n}</div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {calendarDays.map((day, idx) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const dayProjectEvents = existingProjectEvents.filter(e => e.date === dateStr);
                  const dayNewSlots = newSlots.filter(s => s.date === dateStr);
                  const dayOtherEvents = allEvents.filter(e => e.date === dateStr && !projectEventIds.has(e.id));
                  const isCurrentMonth = isSameMonth(day, calMonth);
                  const isToday = isSameDay(day, new Date());
                  const isSelected = selectedDay && isSameDay(day, selectedDay);
                  const totalProjectHours = dayProjectEvents.reduce((sum, e) => sum + (e.duration_hours || 0), 0)
                    + dayNewSlots.reduce((sum, s) => sum + s.duration, 0);
                  const todayStr = format(new Date(), 'yyyy-MM-dd');
                  const isOutOfRange = dateStr < todayStr || (project.deadline ? dateStr > project.deadline : false);

                  return (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => !isOutOfRange && setSelectedDay(isSelected ? null : day)}
                      className={`relative min-h-[44px] p-1 rounded text-left transition-colors ${
                        isOutOfRange ? 'opacity-30 cursor-not-allowed' :
                        isSelected ? 'bg-teal/25 ring-1 ring-teal/50' :
                        isToday ? 'bg-teal/10' :
                        (dayProjectEvents.length > 0 || dayNewSlots.length > 0) ? 'bg-teal/8' :
                        dayOtherEvents.length > 0 ? 'bg-steel/8' :
                        'hover:bg-teal/5'
                      } ${!isCurrentMonth && !isOutOfRange ? 'opacity-25' : ''}`}
                    >
                      <span className={`text-[10px] font-medium ${isToday ? 'text-ash' : 'text-steel'}`}>
                        {format(day, 'd')}
                      </span>
                      {totalProjectHours > 0 && (
                        <div className="text-[8px] font-bold text-teal mt-0.5">{totalProjectHours}h</div>
                      )}
                      {dayOtherEvents.length > 0 && (
                        <div className="flex gap-0.5 mt-0.5 flex-wrap">
                          {dayOtherEvents.slice(0, 3).map(ev => (
                            <div key={ev.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ev.color ? tc(ev.color) : '#598392' }} />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Time slot popover for selected day */}
              {selectedDay && (
                <div className="mt-3 bg-surface-900 rounded-lg border border-teal/10 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-cream">
                      {format(selectedDay, 'yyyy. MMMM d.', { locale: hu })}
                    </span>
                    <button type="button" onClick={() => setSelectedDay(null)} className="text-[10px] text-steel hover:text-cream cursor-pointer">✕</button>
                  </div>

                  {/* Other projects' events (read-only context) */}
                  {allEvents
                    .filter(e => e.date === format(selectedDay, 'yyyy-MM-dd') && !projectEventIds.has(e.id))
                    .map(ev => (
                      <div key={ev.id} className="flex items-center justify-between py-1.5 border-b border-steel/10 last:border-0">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ev.color ? tc(ev.color) : '#598392' }} />
                          <span className="text-[10px] text-steel/70 truncate max-w-[120px]">{ev.project_name || ev.title}</span>
                        </div>
                        <span className="text-[10px] text-steel/50">{ev.start_time} – {ev.end_time}</span>
                      </div>
                    ))}

                  {/* Existing project events for this day (deletable) */}
                  {existingProjectEvents
                    .filter(e => e.date === format(selectedDay, 'yyyy-MM-dd'))
                    .map(event => (
                      <div key={event.id} className="flex items-center justify-between py-1.5 border-b border-teal/5 last:border-0">
                        <span className="text-xs text-cream">{event.start_time} – {event.end_time}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-ash">{event.duration_hours}h</span>
                          <button type="button" onClick={() => handleDeleteExistingEvent(event.id)} className="p-0.5 rounded hover:bg-red-500/10 text-steel/40 hover:text-red-400 cursor-pointer">
                            <Trash2 width={10} height={10} />
                          </button>
                        </div>
                      </div>
                    ))}

                  {/* New slots for this day (removable) */}
                  {newSlots
                    .filter(s => s.date === format(selectedDay, 'yyyy-MM-dd'))
                    .map(slot => (
                      <div key={slot.id} className="flex items-center justify-between py-1.5 border-b border-teal/5 last:border-0">
                        <span className="text-xs text-steel">{slot.start_time} – {slot.end_time}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-ash">{slot.duration}h</span>
                          <button type="button" onClick={() => setNewSlots(prev => prev.filter(s => s.id !== slot.id))} className="p-0.5 rounded hover:bg-red-500/10 text-steel/40 hover:text-red-400 cursor-pointer">
                            <Trash2 width={10} height={10} />
                          </button>
                        </div>
                      </div>
                    ))}

                  {/* Add new slot */}
                  <div className="flex items-end gap-2 mt-2">
                    <div className="flex-1">
                      <label className="block text-[9px] text-steel mb-0.5">Kezdés</label>
                      <TimePicker value={slotStart} onChange={setSlotStart} />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[9px] text-steel mb-0.5">Vége</label>
                      <TimePicker value={slotEnd} onChange={setSlotEnd} />
                    </div>
                    <button type="button" onClick={addSlotForDay}
                      className="px-2.5 py-1.5 bg-teal text-cream rounded text-xs hover:bg-teal/80 shrink-0 cursor-pointer">
                      <Plus width={12} height={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs text-steel hover:text-cream transition-colors cursor-pointer"
            >
              Mégse
            </button>
            <button
              onClick={handleDone}
              disabled={saving}
              className="px-5 py-2 text-xs font-medium bg-teal text-cream rounded-lg hover:bg-teal/80 transition-colors cursor-pointer"
            >
              Mentés
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NoteFormModal({ onSubmit, onClose }: {
  onSubmit: (data: { title: string; content: string; is_notification: boolean }) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isNotification, setIsNotification] = useState(false);

  const inputClass = "w-full px-3 py-2 bg-surface-900 border border-teal/10 rounded-lg text-sm text-cream focus:outline-none focus:ring-2 focus:ring-teal/30";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface-800 rounded-xl border border-teal/15 p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="font-pixel text-[14px] text-cream mb-5">Új jegyzet</h2>
        <form
          onSubmit={e => {
            e.preventDefault();
            if (!content.trim()) return;
            onSubmit({ title, content, is_notification: isNotification });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-steel mb-1">Cím</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputClass} placeholder="Jegyzet címe" />
          </div>
          <div>
            <label className="block text-xs font-medium text-steel mb-1">Tartalom *</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} className={`${inputClass} resize-none h-24`} placeholder="Jegyzet tartalma..." required />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isNotification} onChange={e => setIsNotification(e.target.checked)} className="rounded border-teal/20" />
            <span className="text-sm text-steel">Megjelölés értesítésként</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-steel hover:bg-teal/10 rounded-lg">Mégse</button>
            <button type="submit" className="px-4 py-2 text-sm bg-teal text-cream rounded-lg hover:bg-teal/80">Hozzáadás</button>
          </div>
        </form>
      </div>
    </div>
  );
}


