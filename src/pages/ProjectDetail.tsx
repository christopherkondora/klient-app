import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Clock, Calendar, StickyNote, Receipt, FileText,
  Plus, Check, AlertTriangle, Trash2, Pencil, User, ArrowRight, FolderOpen,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { ProjectForm, TimeSlot } from './Projects';
import InvoiceUploadModal from '../components/InvoiceUploadModal';
import InvoicePdfViewer from '../components/InvoicePdfViewer';
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
            <div className="flex items-center gap-2 text-steel text-xs mb-2">
              <Clock width={13} height={13} /> Teljesített munkaórák
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


