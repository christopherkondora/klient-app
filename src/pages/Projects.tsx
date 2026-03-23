import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Clock, Calendar, AlertTriangle, Trash2, X,
  ChevronLeft, ChevronRight, Receipt, User, ArrowRight, ArrowLeft, Briefcase,
} from 'lucide-react';
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
import DatePicker from '../components/DatePicker';
import TimePicker from '../components/TimePicker';
import HexColorPicker from '../components/HexColorPicker';
import { generateProjectColor, getProjectColorOptions, useThemedColor } from '../utils/colors';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Projects() {
  const navigate = useNavigate();
  const tc = useThemedColor();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [invoicedProjectIds, setInvoicedProjectIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [projectsData, clientsData, invoicesData] = await Promise.all([
        window.electronAPI.getProjects(),
        window.electronAPI.getClients(),
        window.electronAPI.getInvoices(),
      ]);
      setProjects(projectsData);
      setClients(clientsData);
      setInvoicedProjectIds(new Set(invoicesData.filter(i => i.project_id).map(i => i.project_id!)));
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(data: { project: Partial<Project>; timeSlots: TimeSlot[] }) {
    try {
      const created = await window.electronAPI.createProject(data.project);
      // Create calendar events for each time slot
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
      // Mark hours as distributed
      await window.electronAPI.updateProject(created.id, { is_hours_distributed: 1 });
      setShowForm(false);
      loadData();
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  }

  async function handleDeleteProject() {
    if (!deleteProjectId) return;
    try {
      await window.electronAPI.deleteProject(deleteProjectId);
      setDeleteProjectId(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  }

  const filtered = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.client_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
          <h1 className="font-pixel text-xl text-cream">Projektek</h1>
          <p className="text-steel text-sm mt-2">{projects.length} projekt</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal text-cream rounded-lg text-sm font-medium hover:bg-teal/80 transition-colors"
        >
          <Plus width={16} height={16} />
          Új projekt
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search width={16} height={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel" />
          <input
            type="text"
            placeholder="Keresés..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-800/50 border border-teal/10 rounded-lg text-sm text-cream placeholder:text-steel/50 focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-surface-800/50 border border-teal/10 rounded-lg text-sm text-cream focus:outline-none focus:ring-2 focus:ring-teal/30"
        >
          <option value="all">Összes státusz</option>
          <option value="active">Aktív</option>
          <option value="completed">Befejezett</option>
          <option value="on_hold">Szünetelő</option>
          <option value="cancelled">Törölve</option>
        </select>
      </div>

      {/* Project List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-steel/60 text-sm">
            {search || statusFilter !== 'all' ? 'Nincs találat' : 'Még nincsenek projektek'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(project => {
            const daysLeft = project.deadline ? differenceInDays(parseISO(project.deadline), new Date()) : Infinity;
            const hoursPercent = project.estimated_hours > 0 ? (project.allocated_hours / project.estimated_hours) * 100 : 0;
            const isOverdue = daysLeft < 0 && project.status === 'active';

            return (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="bg-surface-800/50 rounded-lg border border-teal/10 p-5 hover:border-teal/25 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                      style={{ backgroundColor: tc(project.color || project.client_color) }}
                    />
                    <div>
                      <h3 className="font-semibold text-cream">{project.name}</h3>
                      <p className="text-xs text-steel mt-0.5">{project.client_name || 'Személyes'}</p>
                      {project.description && (
                        <p className="text-sm text-steel/80 mt-1 line-clamp-1">{project.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isOverdue && (
                      <span className="flex items-center gap-1 text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded-full">
                        <AlertTriangle width={11} height={11} /> Lejárt
                      </span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      project.status === 'active' ? 'bg-blue-500/10 text-blue-400' :
                      project.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                      project.status === 'on_hold' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-red-500/10 text-red-400'
                    }`}>
                      {project.status === 'active' ? 'Aktív' :
                       project.status === 'completed' ? 'Befejezett' :
                       project.status === 'on_hold' ? 'Szünetelő' : 'Törölve'}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      project.priority === 'urgent' ? 'bg-red-500/10 text-red-400' :
                      project.priority === 'high' ? 'bg-orange-500/10 text-orange-400' :
                      project.priority === 'medium' ? 'bg-blue-500/10 text-blue-400' :
                      'bg-teal/10 text-steel'
                    }`}>
                      {project.priority === 'urgent' ? 'Sürgős' :
                       project.priority === 'high' ? 'Magas' :
                       project.priority === 'medium' ? 'Közepes' : 'Alacsony'}
                    </span>
                    {invoicedProjectIds.has(project.id) && (
                      <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium bg-teal/15 text-teal">
                        <Receipt width={11} height={11} /> Számlázva
                      </span>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteProjectId(project.id); }}
                      className="p-1.5 rounded-lg text-steel/40 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      title="Projekt törlése"
                    >
                      <Trash2 width={14} height={14} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2 flex-1">
                    <Clock width={13} height={13} className="text-steel" />
                    <div className="flex-1 h-1.5 bg-teal/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(hoursPercent, 100)}%`,
                          backgroundColor: hoursPercent >= 100 ? '#AEC3B0' : hoursPercent >= 75 ? '#f59e0b' : '#598392',
                        }}
                      />
                    </div>
                    <span className="text-xs text-steel shrink-0">
                      {Number(project.allocated_hours).toFixed(1)}/{project.estimated_hours} óra ({Math.round(hoursPercent)}%)
                    </span>
                  </div>
                  {project.deadline ? (
                    <div className="flex items-center gap-1.5 text-xs text-steel shrink-0">
                      <Calendar width={13} height={13} />
                      <span>{format(parseISO(project.deadline), 'yyyy. MM. dd.')}</span>
                      {project.status === 'active' && (
                        <span className={`ml-1 ${daysLeft <= 3 ? 'text-red-400 font-medium' : ''}`}>
                          ({daysLeft <= 0 ? 'Lejárt' : `${daysLeft} nap`})
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-steel/40 italic">Nincs határidő</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Project Confirm */}
      {deleteProjectId && (
        <ConfirmDialog
          title="Projekt törlése"
          message="Biztosan törölni szeretnéd ezt a projektet? Ez a művelet nem vonható vissza, és az összes kapcsolódó naptárbejegyzés és számla is törlődik."
          confirmLabel="Törlés"
          cancelLabel="Mégse"
          variant="danger"
          onConfirm={handleDeleteProject}
          onCancel={() => setDeleteProjectId(null)}
        />
      )}

      {/* Create Project Modal */}
      {showForm && (
        <ProjectForm
          clients={clients}
          onSubmit={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

export interface TimeSlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  duration: number;
}

export function ProjectForm({ clients, onSubmit, onClose, defaultClientId, editProject }: {
  clients: Client[];
  onSubmit: (data: { project: Partial<Project>; timeSlots: TimeSlot[] }) => void;
  onClose: () => void;
  defaultClientId?: string;
  editProject?: Project;
}) {
  const isEdit = !!editProject;
  const [step, setStep] = useState(1);

  // Step 1 fields
  const [name, setName] = useState(editProject?.name || '');
  const [projectType, setProjectType] = useState<'client' | 'personal'>(
    editProject ? (editProject.client_id ? 'client' : 'personal') : (defaultClientId ? 'client' : 'client')
  );
  const [clientId, setClientId] = useState(editProject?.client_id || defaultClientId || '');
  const [description, setDescription] = useState(editProject?.description || '');
  const [deadline, setDeadline] = useState(editProject?.deadline || '');
  const [estimatedHours, setEstimatedHours] = useState(editProject ? String(editProject.estimated_hours) : '');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>(editProject?.priority || 'medium');
  const [projectColor, setProjectColor] = useState(editProject?.color || '');

  // Auto-generate color when client changes
  const selectedClient = clients.find(c => c.id === clientId);
  const defaultPersonalColor = '#598392'; // steel
  const colorOptions = selectedClient
    ? getProjectColorOptions(selectedClient.color, 6)
    : getProjectColorOptions(defaultPersonalColor, 6);
  if (!projectColor && colorOptions.length > 0) {
    // Default to first shade
    setProjectColor(colorOptions[0]);
  }

  // Step 2 fields
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

  const parsedEstHours = parseFloat(estimatedHours) || 0;
  const allocatedHours = timeSlots.reduce((sum, s) => sum + s.duration, 0);
  const remaining = parsedEstHours - allocatedHours;
  const isFullyAllocated = remaining <= 0 && parsedEstHours > 0;

  function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !estimatedHours) return;
    if (projectType === 'client' && !clientId) return;
    const resolvedClientId = projectType === 'personal' ? null : clientId || null;
    if (isEdit) {
      onSubmit({
        project: {
          name: name.trim(),
          client_id: resolvedClientId,
          description,
          deadline,
          estimated_hours: parsedEstHours,
          priority,
          color: projectColor || null,
        },
        timeSlots: [],
      });
    } else {
      setStep(2);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onDoubleClick={onClose}>
      <div className="bg-surface-800 rounded-2xl border border-teal/15 w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col overflow-hidden" onDoubleClick={e => e.stopPropagation()}>

        {/* Header accent */}
        <div className="h-1 bg-gradient-to-r from-teal via-steel to-teal/30" />

        <div className="p-5 flex flex-col flex-1 min-h-0">
          {/* Header with close button */}
          <div className="flex items-center justify-between mb-3">
            <span className="font-pixel text-[14px] text-cream">{isEdit ? 'Projekt szerkesztése' : 'Új projekt'}</span>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream cursor-pointer transition-colors duration-150 ease-out">
              <X width={14} height={14} />
            </button>
          </div>

          {/* Step Indicator */}
          {!isEdit && (
            <div className="flex items-center gap-3 mb-5">
              <div className={`flex items-center gap-2 text-xs font-medium ${step === 1 ? 'text-cream' : 'text-steel/50'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-teal text-cream' : 'bg-teal/20 text-steel/50'}`}>1</span>
                Alapadatok
              </div>
              <div className="h-px flex-1 bg-teal/10" />
              <div className={`flex items-center gap-2 text-xs font-medium ${step === 2 ? 'text-cream' : 'text-steel/50'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-teal text-cream' : 'bg-teal/20 text-steel/50'}`}>2</span>
                Időbeosztás
              </div>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleStep1Submit} className="space-y-4 overflow-auto px-1 -mx-1">
              {/* Project type selector */}
              <div>
                <span className="text-[10px] text-steel tracking-wider uppercase mb-1.5 block">Típus</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setProjectType('client'); if (!clientId && clients.length) setClientId(clients[0].id); }}
                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-150 ease-out cursor-pointer ${
                      projectType === 'client'
                        ? 'bg-teal/15 text-cream'
                        : 'text-steel/50 hover:text-steel bg-surface-900/30 hover:bg-surface-900/60'
                    }`}
                  >
                    <Briefcase width={13} height={13} />
                    Ügyfél projekt
                  </button>
                  <button
                    type="button"
                    onClick={() => { setProjectType('personal'); setClientId(''); }}
                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-150 ease-out cursor-pointer ${
                      projectType === 'personal'
                        ? 'bg-steel/15 text-cream'
                        : 'text-steel/50 hover:text-steel bg-surface-900/30 hover:bg-surface-900/60'
                    }`}
                  >
                    <User width={13} height={13} />
                    Személyes projekt
                  </button>
                </div>
              </div>

              {/* Client selector — only shown for client projects */}
              {projectType === 'client' && (
                <div>
                  <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Ügyfél *</span>
                  <select value={clientId} onChange={e => setClientId(e.target.value)} className="w-full px-2.5 py-2 bg-surface-900/40 border border-teal/8 rounded-lg text-sm text-cream focus:outline-none focus:border-teal/25 transition-colors" required>
                    <option value="">Válassz ügyfelet...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              {/* Project name — hero input */}
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-0 py-2 bg-transparent border-b border-teal/15 text-cream text-lg font-medium focus:outline-none focus:border-teal/40 placeholder:text-steel/50 transition-colors"
                placeholder="Projekt neve..."
                required
              />

              {/* Description */}
              <div>
                <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Leírás</span>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-2.5 py-2 bg-surface-900/40 border border-teal/8 rounded-lg text-sm text-cream focus:outline-none focus:border-teal/25 placeholder:text-steel/40 transition-colors resize-none h-16"
                  placeholder="Projekt leírása..."
                />
              </div>

              {/* Deadline + Estimated hours */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Határidő</span>
                  <DatePicker value={deadline} onChange={setDeadline} placeholder="Nincs határidő" />
                </div>
                <div>
                  <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Becsült órák *</span>
                  <input
                    type="number"
                    value={estimatedHours}
                    onChange={e => setEstimatedHours(e.target.value)}
                    className="w-full px-2.5 py-2 bg-surface-900/40 border border-teal/8 rounded-lg text-sm text-cream focus:outline-none focus:border-teal/25 placeholder:text-steel/40 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="pl. 20"
                    min="0.5"
                    step="0.5"
                    required
                  />
                </div>
              </div>

              {/* Priority pills */}
              <div>
                <span className="text-[10px] text-steel tracking-wider uppercase mb-1.5 block">Prioritás</span>
                <div className="flex gap-1.5">
                  {(['low', 'medium', 'high', 'urgent'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-all duration-150 ease-out cursor-pointer ${
                        priority === p
                          ? p === 'urgent' ? 'bg-red-500/10 text-red-400' :
                            p === 'high' ? 'bg-orange-500/10 text-orange-400' :
                            p === 'medium' ? 'bg-blue-500/10 text-blue-400' :
                            'bg-teal/10 text-steel'
                          : 'text-steel/40 hover:text-steel bg-surface-900/30 hover:bg-surface-900/60'
                      }`}
                    >
                      {p === 'urgent' ? 'Sürgős' : p === 'high' ? 'Magas' : p === 'medium' ? 'Közepes' : 'Alacsony'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color picker */}
              {colorOptions.length > 0 && (
                <div>
                  <span className="text-[10px] text-steel tracking-wider uppercase mb-2 block">Szín</span>
                  <div className="flex gap-2 items-center">
                    {colorOptions.map((color, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setProjectColor(color)}
                        className={`w-6 h-6 rounded-full transition-all duration-150 ease-out cursor-pointer ${
                          projectColor === color ? 'ring-2 ring-offset-2 ring-offset-surface-800 ring-teal scale-110' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <HexColorPicker value={projectColor || '#598392'} onChange={setProjectColor} presetColors={colorOptions} />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-steel hover:text-cream transition-colors duration-150 ease-out cursor-pointer">Mégse</button>
                <button type="submit" className="flex items-center gap-1.5 px-5 py-2 text-xs font-medium bg-teal text-cream rounded-lg hover:bg-teal/80 transition-colors duration-150 ease-out cursor-pointer">{isEdit ? 'Mentés' : <>Tovább <ArrowRight width={14} height={14} /></>}</button>
              </div>
            </form>
        ) : (
          <div className="space-y-4 overflow-auto flex-1 px-1 -mx-1">
            {/* Hours progress */}
            <div className="bg-surface-900/40 rounded-lg p-4 border border-teal/8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-steel">Elosztott munkaórák</span>
                <span className={`text-sm font-bold ${isFullyAllocated ? 'text-green-400' : 'text-cream'}`}>
                  {allocatedHours} / {parsedEstHours} óra
                </span>
              </div>
              <div className="h-2 bg-teal/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min((allocatedHours / parsedEstHours) * 100, 100)}%`,
                    backgroundColor: isFullyAllocated ? '#4ade80' : '#598392',
                  }}
                />
              </div>
              {!isFullyAllocated && (
                <p className="text-[10px] text-amber-400 mt-2 flex items-center gap-1">
                  <AlertTriangle width={10} height={10} />
                  Még {remaining.toFixed(1)} órát kell elosztanod
                </p>
              )}
            </div>

            {/* Calendar-based time slot picker */}
            <TimeSlotCalendar
              timeSlots={timeSlots}
              onAddSlot={(slot) => setTimeSlots(prev => [...prev, slot])}
              onRemoveSlot={(slotId) => setTimeSlots(prev => prev.filter(s => s.id !== slotId))}
              clientColor={projectColor || selectedClient?.color}
              deadline={deadline}
            />

            <div className="flex justify-between mt-4">
              <button type="button" onClick={() => setStep(1)} className="flex items-center gap-1.5 px-4 py-2 text-xs text-steel hover:text-cream transition-colors duration-150 ease-out cursor-pointer"><ArrowLeft width={14} height={14} /> Vissza</button>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-steel hover:text-cream transition-colors duration-150 ease-out cursor-pointer">Mégse</button>
                <button
                  type="button"
                  disabled={!isFullyAllocated}
                  onClick={() => {
                    onSubmit({
                      project: {
                        name: name.trim(),
                        client_id: clientId,
                        description,
                        deadline,
                        estimated_hours: parsedEstHours,
                        priority,
                        color: projectColor || null,
                      },
                      timeSlots,
                    });
                  }}
                  className={`px-5 py-2 text-xs rounded-lg font-medium transition-colors duration-150 ease-out ${
                    isFullyAllocated
                      ? 'bg-teal text-cream hover:bg-teal/80 cursor-pointer'
                      : 'bg-teal/20 text-steel/40 cursor-not-allowed'
                  }`}
                >
                  {isEdit ? 'Módosítások mentése' : 'Projekt létrehozása'}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

function TimeSlotCalendar({ timeSlots, onAddSlot, onRemoveSlot, clientColor, deadline }: {
  timeSlots: TimeSlot[];
  onAddSlot: (slot: TimeSlot) => void;
  onRemoveSlot: (id: string) => void;
  clientColor?: string;
  deadline?: string;
}) {
  const [calMonth, setCalMonth] = useState(new Date());
  const tc = useThemedColor();
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [slotStart, setSlotStart] = useState('09:00');
  const [slotEnd, setSlotEnd] = useState('10:00');
  const [existingEvents, setExistingEvents] = useState<CalendarEvent[]>([]);

  // Fetch existing events when month changes
  useEffect(() => {
    const monthStart = startOfMonth(calMonth);
    const monthEnd = endOfMonth(calMonth);
    const sd = startOfWeek(monthStart, { weekStartsOn: 1 });
    const ed = endOfWeek(monthEnd, { weekStartsOn: 1 });
    window.electronAPI.getCalendarEvents(
      format(sd, 'yyyy-MM-dd'),
      format(ed, 'yyyy-MM-dd')
    ).then(setExistingEvents).catch(console.error);
  }, [calMonth]);

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
    onAddSlot({
      id: crypto.randomUUID(),
      date: format(selectedDay, 'yyyy-MM-dd'),
      start_time: slotStart,
      end_time: slotEnd,
      duration: Math.round(duration * 100) / 100,
    });
    // Bump the start/end by the slot duration so user can quickly add consecutive slots
    setSlotStart(slotEnd);
    const nextEnd = eh * 60 + em + duration * 60;
    const newH = Math.min(Math.floor(nextEnd / 60), 23);
    const newM = Math.round(nextEnd % 60);
    setSlotEnd(`${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
  }

  return (
    <div className="relative">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => setCalMonth(subMonths(calMonth, 1))} className="p-1 hover:bg-teal/10 rounded text-steel hover:text-cream">
          <ChevronLeft width={14} height={14} />
        </button>
        <span className="text-xs font-medium text-cream">
          {format(calMonth, 'yyyy. MMMM', { locale: hu })}
        </span>
        <button type="button" onClick={() => setCalMonth(addMonths(calMonth, 1))} className="p-1 hover:bg-teal/10 rounded text-steel hover:text-cream">
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
          const daySlots = timeSlots.filter(s => s.date === dateStr);
          const dayEvents = existingEvents.filter(e => e.date === dateStr);
          const isCurrentMonth = isSameMonth(day, calMonth);
          const isToday = isSameDay(day, new Date());
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          const totalHours = daySlots.reduce((sum, s) => sum + s.duration, 0);
          const todayStr = format(new Date(), 'yyyy-MM-dd');
          const isOutOfRange = dateStr < todayStr || (deadline ? dateStr > deadline : false);

          return (
            <button
              type="button"
              key={idx}
              onClick={() => !isOutOfRange && setSelectedDay(isSelected ? null : day)}
              className={`relative min-h-[44px] p-1 rounded text-left transition-colors ${
                isOutOfRange ? 'opacity-30 cursor-not-allowed' :
                isSelected ? 'bg-teal/25 ring-1 ring-teal/50' :
                isToday ? 'bg-teal/10' :
                daySlots.length > 0 ? 'bg-teal/8' :
                dayEvents.length > 0 ? 'bg-steel/8' :
                'hover:bg-teal/5'
              } ${!isCurrentMonth && !isOutOfRange ? 'opacity-25' : ''}`}
            >
              <span className={`text-[10px] font-medium ${isToday ? 'text-ash' : 'text-steel'}`}>
                {format(day, 'd')}
              </span>
              {totalHours > 0 && (
                <div className="text-[8px] font-bold text-teal mt-0.5">{totalHours}h</div>
              )}
              {dayEvents.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap">
                  {dayEvents.slice(0, 3).map(ev => (
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
            <button type="button" onClick={() => setSelectedDay(null)} className="text-[10px] text-steel hover:text-cream">✕</button>
          </div>

          {/* Existing calendar events */}
          {existingEvents
            .filter(e => e.date === format(selectedDay, 'yyyy-MM-dd'))
            .map(ev => (
              <div key={ev.id} className="flex items-center justify-between py-1.5 border-b border-steel/10 last:border-0">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ev.color ? tc(ev.color) : '#598392' }} />
                  <span className="text-[10px] text-steel/70 truncate max-w-[120px]">{ev.project_name || ev.title}</span>
                </div>
                <span className="text-[10px] text-steel/50">{ev.start_time} – {ev.end_time}</span>
              </div>
            ))}

          {/* New slots for this day */}
          {timeSlots
            .filter(s => s.date === format(selectedDay, 'yyyy-MM-dd'))
            .map(slot => (
              <div key={slot.id} className="flex items-center justify-between py-1.5 border-b border-teal/5 last:border-0">
                <span className="text-xs text-steel">{slot.start_time} – {slot.end_time}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-ash">{slot.duration}h</span>
                  <button type="button" onClick={() => onRemoveSlot(slot.id)} className="p-0.5 rounded hover:bg-red-500/10 text-steel/40 hover:text-red-400">
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
              className="px-2.5 py-1.5 bg-teal text-cream rounded text-xs hover:bg-teal/80 shrink-0">
              <Plus width={12} height={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
