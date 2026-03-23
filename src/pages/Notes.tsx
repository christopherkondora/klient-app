import { useEffect, useState } from 'react';
import {
  Plus, Search, Trash2, X, AlertTriangle, StickyNote as NoteIcon,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import DatePicker from '../components/DatePicker';

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [notesData, projectsData, clientsData] = await Promise.all([
        window.electronAPI.getNotes(),
        window.electronAPI.getProjects(),
        window.electronAPI.getClients(),
      ]);
      setNotes(notesData);
      setProjects(projectsData);
      setClients(clientsData);
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(data: Partial<Note>) {
    try {
      await window.electronAPI.createNote(data);
      setShowForm(false);
      loadData();
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  }

  async function handleDelete(id: string) {
    try {
      await window.electronAPI.deleteNote(id);
      loadData();
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  }

  function stripHtml(html: string): string {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  const filtered = notes.filter(n =>
    (n.title || '').toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase()) ||
    (n.project_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (n.client_name || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-steel"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-xl text-cream">Jegyzetek</h1>
          <p className="text-steel text-sm mt-2">{notes.length} jegyzet</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal text-cream rounded-lg text-sm font-medium hover:bg-teal/80"
        >
          <Plus width={16} height={16} /> Új jegyzet
        </button>
      </div>

      <div className="relative">
        <Search width={16} height={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel" />
        <input
          type="text"
          placeholder="Keresés..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-surface-800/50 border border-teal/10 rounded-lg text-sm text-cream placeholder:text-steel/50 focus:outline-none focus:ring-2 focus:ring-teal/30"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-steel/60 italic text-center py-12">Nincsenek jegyzetek</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(note => (
            <div key={note.id} className="bg-surface-800/50 rounded-lg border border-teal/10 p-4 group">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {note.is_notification ? (
                    <AlertTriangle width={16} height={16} className="text-amber-400 mt-0.5 shrink-0" />
                  ) : (
                    <NoteIcon width={16} height={16} className="text-steel mt-0.5 shrink-0" />
                  )}
                  <div>
                    <h3 className="font-semibold text-cream text-sm">{note.title || 'Jegyzet'}</h3>
                    <p className="text-sm text-steel mt-1">{stripHtml(note.content)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-steel/60">{format(parseISO(note.date), 'yyyy. MM. dd.')}</span>
                      {note.client_name && (
                        <span className="text-xs text-ash">{note.client_name}</span>
                      )}
                      {note.project_name && (
                        <span className="text-xs text-steel/60">• {note.project_name}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(note.id)}
                  className="p-1.5 rounded hover:bg-red-500/10 text-steel/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 width={14} height={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <NoteForm
          projects={projects}
          clients={clients}
          onSubmit={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function NoteForm({ projects, clients, onSubmit, onClose }: {
  projects: Project[];
  clients: Client[];
  onSubmit: (data: Partial<Note>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [isNotification, setIsNotification] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const clientProjects = clientId ? projects.filter(p => p.client_id === clientId) : projects;
  const inputClass = "w-full px-3 py-2 bg-surface-900 border border-teal/10 rounded-lg text-sm text-cream focus:outline-none focus:ring-2 focus:ring-teal/30";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onDoubleClick={onClose}>
      <div className="bg-surface-800 rounded-xl border border-teal/15 p-6 w-full max-w-md shadow-2xl" onDoubleClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-pixel text-[14px] text-cream">Új jegyzet</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-teal/10 text-steel hover:text-cream">
            <X width={14} height={14} />
          </button>
        </div>
        <form
          onSubmit={e => {
            e.preventDefault();
            if (!content.trim()) return;
            onSubmit({
              title,
              content,
              client_id: clientId || undefined,
              project_id: projectId || undefined,
              is_notification: isNotification ? 1 : 0,
              date,
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-steel mb-1">Dátum</label>
            <DatePicker value={date} onChange={setDate} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-steel mb-1">Ügyfél</label>
              <select value={clientId} onChange={e => { setClientId(e.target.value); setProjectId(''); }} className={inputClass}>
                <option value="">Nincs</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-steel mb-1">Projekt</label>
              <select value={projectId} onChange={e => setProjectId(e.target.value)} className={inputClass}>
                <option value="">Nincs</option>
                {clientProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
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
            <button type="submit" className="px-4 py-2 text-sm bg-teal text-cream rounded-lg hover:bg-teal/80">Létrehozás</button>
          </div>
        </form>
      </div>
    </div>
  );
}
