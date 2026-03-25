import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, Building2, MapPin, Briefcase, StickyNote,
  Mic, Receipt, Plus, Play, Pause, Square, Trash2, Clock, FileText, X, ExternalLink,
  ChevronDown, ChevronUp, Loader2, Sparkles, ScrollText, FolderOpen,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { hu } from 'date-fns/locale';
import DatePicker from '../components/DatePicker';
import { ProjectForm, TimeSlot } from './Projects';
import { useAuth } from '../contexts/AuthContext';
import InvoicePdfViewer from '../components/InvoicePdfViewer';
import ConfirmDialog from '../components/ConfirmDialog';
import { useThemedColor } from '../utils/colors';

const PLATFORM_URLS: Record<string, { label: string; url: string }> = {
  szamlazz: { label: 'Számlázz.hu', url: 'https://www.szamlazz.hu' },
  billingo: { label: 'Billingo', url: 'https://app.billingo.hu' },
  nav: { label: 'NAV Online', url: 'https://onlineszamla.nav.gov.hu' },
  kulcs: { label: 'Kulcs-Soft', url: 'https://kulcs-soft.hu' },
};

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tc = useThemedColor();
  const [searchParams] = useSearchParams();
  const initialTab = (['projects', 'notes', 'recordings', 'invoices'] as const).includes(searchParams.get('tab') as any)
    ? (searchParams.get('tab') as 'projects' | 'notes' | 'recordings' | 'invoices')
    : 'projects';
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeTab, setActiveTab] = useState<'projects' | 'notes' | 'recordings' | 'invoices'>(initialTab);
  const [loading, setLoading] = useState(true);
  const [showGmail, setShowGmail] = useState(false);
  const [showInvoicePlatform, setShowInvoicePlatform] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [deleteRecordingId, setDeleteRecordingId] = useState<string | null>(null);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [allClients, setAllClients] = useState<Client[]>([]);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const timerRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordedBlob = useRef<Blob | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadData();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id]);

  async function loadData() {
    try {
      const [clientData, projectsData, notesData, recordingsData, invoicesData, clientsData] = await Promise.all([
        window.electronAPI.getClient(id!),
        window.electronAPI.getProjects(id!),
        window.electronAPI.getNotes(),
        window.electronAPI.getRecordings(id!),
        window.electronAPI.getClientInvoices(id!),
        window.electronAPI.getClients(),
      ]);
      setClient(clientData);
      setProjects(projectsData);
      setAllProjects(projectsData);
      setNotes(notesData.filter(n => n.client_id === id));
      setRecordings(recordingsData);
      setInvoices(invoicesData);
      setAllClients(clientsData);
    } catch (err) {
      console.error('Failed to load client data:', err);
    } finally {
      setLoading(false);
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
          color: data.project.color || allClients.find(c => c.id === data.project.client_id)?.color,
        });
      }
      await window.electronAPI.updateProject(created.id, { is_hours_distributed: 1 });
      setShowProjectForm(false);
      loadData();
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  }

  // Recording functions
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = () => {
        recordedBlob.current = new Blob(audioChunks.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        setShowSaveForm(true);
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Nem sikerült elindítani a felvételt. Ellenőrizd a mikrofon engedélyeket.');
    }
  }

  function stopRecording() {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = 0;
      }
    }
  }

  async function saveRecording(title: string) {
    if (!recordedBlob.current) return;
    try {
      const arrayBuffer = await recordedBlob.current.arrayBuffer();
      const buffer = Array.from(new Uint8Array(arrayBuffer));
      const filePath = await window.electronAPI.saveFile({
        buffer,
        fileName: `recording-${Date.now()}.webm`,
        type: 'audio/webm',
      });
      const created = await window.electronAPI.createRecording({
        title,
        client_id: id,
        file_path: filePath,
        duration_seconds: recordingTime,
      });
      setShowSaveForm(false);
      recordedBlob.current = null;
      setRecordingTime(0);
      loadData();

      // Auto-transcribe + summarize in background
      processRecording(created.id, filePath);
    } catch (err) {
      console.error('Failed to save recording:', err);
    }
  }

  async function processRecording(recordingId: string, filePath: string) {
    setProcessingId(recordingId);
    try {
      const { text, error: transcribeError } = await window.electronAPI.transcribeRecording(filePath);
      if (transcribeError) {
        console.error('Transcription error:', transcribeError);
        alert(`Lejegyzési hiba: ${transcribeError}`);
        return;
      }
      if (text) {
        await window.electronAPI.updateRecording(recordingId, { transcription: text });
        const { summary, error: summarizeError } = await window.electronAPI.summarizeRecording(text);
        if (summarizeError) {
          console.error('Summarize error:', summarizeError);
        }
        if (summary) {
          await window.electronAPI.updateRecording(recordingId, { ai_summary: summary });
        }
        loadData();
      } else {
        alert('A lejegyzés nem adott vissza szöveget. Ellenőrizd, hogy a felvétel tartalmaz-e beszédet.');
      }
    } catch (err) {
      console.error('Failed to process recording:', err);
      alert(`Feldolgozási hiba: ${err}`);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleDeleteRecording(recordingId: string) {
    try {
      await window.electronAPI.deleteRecording(recordingId);
      setDeleteRecordingId(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete recording:', err);
    }
  }

  async function handleCreateNote(data: Partial<Note>) {
    try {
      await window.electronAPI.createNote({ ...data, client_id: id });
      setShowNoteForm(false);
      loadData();
    } catch (err) {
      console.error('Failed to create note:', err);
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

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  if (loading || !client) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-steel"></div>
      </div>
    );
  }

  const tabs = [
    { key: 'projects' as const, label: 'Projektek', icon: Briefcase, count: projects.length },
    { key: 'notes' as const, label: 'Jegyzetek', icon: StickyNote, count: notes.length },
    { key: 'recordings' as const, label: 'Felvételek', icon: Mic, count: recordings.length },
    { key: 'invoices' as const, label: 'Számlák', icon: Receipt, count: invoices.length },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/clients')}
        className="flex items-center gap-2 text-sm text-steel hover:text-cream transition-colors"
      >
        <ArrowLeft width={16} height={16} />
        Vissza az ügyfelekhez
      </button>

      {/* Client Header */}
      <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6">
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-md flex items-center justify-center text-ink font-bold text-xl shrink-0"
            style={{ backgroundColor: tc(client.color) }}
          >
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="font-pixel text-base text-cream">{client.name}</h1>
            <div className="flex flex-wrap gap-4 mt-3">
              {client.company && (
                <span className="flex items-center gap-1.5 text-sm text-steel">
                  <Building2 width={14} height={14} /> {client.company}
                </span>
              )}
              {client.email && (
                <span className="flex items-center gap-1.5 text-sm text-steel">
                  <Mail width={14} height={14} /> {client.email}
                </span>
              )}
              {client.phone && (
                <span className="flex items-center gap-1.5 text-sm text-steel">
                  <Phone width={14} height={14} /> {client.phone}
                </span>
              )}
              {client.address && (
                <span className="flex items-center gap-1.5 text-sm text-steel">
                  <MapPin width={14} height={14} /> {client.address}
                </span>
              )}
            </div>
          </div>
          {/* Action buttons top-right */}
          <div className="flex gap-2 shrink-0">
            {client.email && (
              <button
                onClick={() => setShowGmail(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-steel/20 text-cream hover:bg-steel/30 rounded-lg transition-colors border border-steel/25"
                title="Email küldése"
              >
                <Mail width={16} height={16} />
                Email
              </button>
            )}
            {user?.invoice_platform && user.invoice_platform !== 'none' && PLATFORM_URLS[user.invoice_platform] && (
              <button
                onClick={() => setShowInvoicePlatform(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-steel/20 text-cream hover:bg-steel/30 rounded-lg transition-colors border border-steel/25"
                title={PLATFORM_URLS[user.invoice_platform].label}
              >
                <ExternalLink width={16} height={16} />
                {PLATFORM_URLS[user.invoice_platform].label}
              </button>
            )}
            <button
              onClick={() => navigate(`/files?path=${encodeURIComponent(client.name)}`)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-steel/20 text-cream hover:bg-steel/30 rounded-lg transition-colors border border-steel/25"
              title="Fájlok"
            >
              <FolderOpen width={16} height={16} />
              Fájlok
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-800/30 p-1 rounded-lg border border-teal/5">
        {tabs.map(tab => (
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
            <span className="text-xs bg-teal/10 text-steel px-1.5 py-0.5 rounded-full">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Tab Content: Projects */}
      {activeTab === 'projects' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setShowProjectForm(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-teal text-cream rounded-lg text-sm hover:bg-teal/80"
            >
              <Plus width={14} height={14} /> Új projekt
            </button>
          </div>
          {showProjectForm && (
            <ProjectForm
              clients={allClients}
              defaultClientId={id}
              onSubmit={handleCreateProject}
              onClose={() => setShowProjectForm(false)}
            />
          )}
          {projects.length === 0 ? (
            <p className="text-sm text-steel/60 italic text-center py-8">Nincsenek projektek</p>
          ) : (
            projects.map(project => (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="bg-surface-800/50 rounded-lg border border-teal/10 p-4 hover:border-teal/25 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-cream">{project.name}</h3>
                    <p className="text-xs text-steel mt-0.5">{project.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
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
                    <span className="text-xs text-steel">
                      {project.deadline ? format(parseISO(project.deadline), 'yyyy. MM. dd.') : <span className="text-steel/40 italic">Nincs határidő</span>}
                    </span>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-teal/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-steel"
                        style={{ width: `${Math.min((project.allocated_hours / project.estimated_hours) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-steel shrink-0">
                      {Number(project.allocated_hours).toFixed(1)}/{project.estimated_hours} óra
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab Content: Notes */}
      {activeTab === 'notes' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNoteForm(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-teal text-cream rounded-lg text-sm hover:bg-teal/80"
            >
              <Plus width={14} height={14} /> Új jegyzet
            </button>
          </div>
          {notes.length === 0 ? (
            <p className="text-sm text-steel/60 italic text-center py-8">Nincsenek jegyzetek</p>
          ) : (
            notes.map(note => (
              <div key={note.id} className="bg-surface-800/50 rounded-lg border border-teal/10 p-4 group">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-cream text-sm">{note.title || 'Jegyzet'}</h3>
                    <p className="text-sm text-steel mt-1">{note.content}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-steel/60 shrink-0">
                      {format(parseISO(note.date), 'yyyy. MM. dd.')}
                    </span>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1.5 rounded hover:bg-red-500/10 text-steel/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 width={14} height={14} />
                    </button>
                  </div>
                </div>
                {note.project_name && (
                  <p className="text-[10px] text-ash/60 mt-2">{note.project_name}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab Content: Recordings */}
      {activeTab === 'recordings' && (
        <div className="space-y-4">
          {/* Recorder */}
          <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-5 text-center">
            <div className="flex flex-col items-center gap-3">
              {isRecording ? (
                <>
                  <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center animate-pulse">
                    <Mic width={24} height={24} className="text-red-400" />
                  </div>
                  <p className="text-xl font-mono font-bold text-cream">{formatTime(recordingTime)}</p>
                  <button
                    onClick={stopRecording}
                    className="flex items-center gap-2 px-5 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600"
                  >
                    <Square width={14} height={14} /> Leállítás
                  </button>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-full bg-teal/15 flex items-center justify-center">
                    <Mic width={24} height={24} className="text-steel" />
                  </div>
                  <button
                    onClick={startRecording}
                    className="flex items-center gap-2 px-5 py-2 bg-teal text-cream rounded-lg text-sm font-medium hover:bg-teal/80"
                  >
                    <Mic width={14} height={14} /> Felvétel indítása
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Recordings List */}
          {recordings.length === 0 ? (
            <p className="text-sm text-steel/60 italic text-center py-6">Nincsenek hangfelvételek</p>
          ) : (
            <div className="space-y-2">
              {recordings.map(recording => (
                <div key={recording.id} className="bg-surface-800/50 rounded-lg border border-teal/10 overflow-hidden group">
                  <div className="p-4 flex items-center gap-4">
                    {/* Play/Pause button + expanding inline player */}
                    <div className="flex items-center gap-0 shrink-0">
                      <button
                        onClick={async () => {
                          if (playingId === recording.id) {
                            audioRef.current?.pause();
                            if (progressInterval.current) clearInterval(progressInterval.current);
                            setPlayingId(null);
                            setAudioProgress(0);
                            setAudioDuration(0);
                          } else {
                            if (audioRef.current) { audioRef.current.pause(); if (progressInterval.current) clearInterval(progressInterval.current); }
                            const buf = await window.electronAPI.readAudioFile(recording.file_path);
                            const blob = new Blob([buf], { type: 'audio/webm' });
                            const url = URL.createObjectURL(blob);
                            const audio = new Audio(url);
                            audio.onloadedmetadata = () => setAudioDuration(audio.duration);
                            audio.ontimeupdate = () => setAudioProgress(audio.currentTime);
                            audio.onended = () => {
                              setPlayingId(null);
                              setAudioProgress(0);
                              setAudioDuration(0);
                              URL.revokeObjectURL(url);
                              if (progressInterval.current) clearInterval(progressInterval.current);
                            };
                            audio.play();
                            audioRef.current = audio;
                            setPlayingId(recording.id);
                          }
                        }}
                        className="w-9 h-9 rounded-md bg-teal/15 flex items-center justify-center text-steel hover:text-cream shrink-0 transition-colors duration-150 ease-out z-10"
                      >
                        {playingId === recording.id ? <Pause width={14} height={14} /> : <Play width={14} height={14} />}
                      </button>

                      {/* Expanding player bar */}
                      <div
                        className="overflow-hidden transition-all duration-200 ease-out flex items-center"
                        style={{ width: playingId === recording.id ? 180 : 0, opacity: playingId === recording.id ? 1 : 0 }}
                      >
                        <div className="flex items-center gap-2 pl-2.5 pr-1 w-[180px]">
                          <span className="text-[10px] text-steel/60 font-mono w-8 text-right shrink-0">{formatTime(audioProgress)}</span>
                          <div
                            className="flex-1 h-1 bg-surface-900/60 rounded-full cursor-pointer relative"
                            onClick={(e) => {
                              if (!audioRef.current || playingId !== recording.id) return;
                              const rect = e.currentTarget.getBoundingClientRect();
                              const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                              audioRef.current.currentTime = pct * audioRef.current.duration;
                            }}
                          >
                            <div
                              className="h-full bg-teal rounded-full transition-[width] duration-100 ease-linear"
                              style={{ width: audioDuration > 0 ? `${(audioProgress / audioDuration) * 100}%` : '0%' }}
                            />
                          </div>
                          <span className="text-[10px] text-steel/40 font-mono w-8 shrink-0">{formatTime(audioDuration)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-cream text-sm truncate">{recording.title}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-steel flex items-center gap-1">
                          <Clock width={10} height={10} /> {formatTime(recording.duration_seconds)}
                        </span>
                        <span className="text-xs text-steel/60">
                          {new Date(recording.created_at).toLocaleDateString('hu-HU')}
                        </span>
                        {processingId === recording.id && (
                          <span className="text-xs text-teal flex items-center gap-1">
                            <Loader2 width={10} height={10} className="animate-spin" /> Feldolgozás...
                          </span>
                        )}
                        {!processingId && recording.ai_summary && (
                          <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <Sparkles width={10} height={10} /> Összefoglalva
                          </span>
                        )}
                        {!processingId && recording.transcription && !recording.ai_summary && (
                          <span className="text-xs text-sky-400 flex items-center gap-1">
                            <ScrollText width={10} height={10} /> Lejegyezve
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {(recording.transcription || recording.ai_summary) && (
                        <button
                          onClick={() => setExpandedId(expandedId === recording.id ? null : recording.id)}
                          className="p-2 rounded-lg hover:bg-teal/10 text-steel/60 hover:text-cream transition-all"
                          title="Részletek"
                        >
                          {expandedId === recording.id ? <ChevronUp width={14} height={14} /> : <ChevronDown width={14} height={14} />}
                        </button>
                      )}
                      {!recording.transcription && !processingId && (
                        <button
                          onClick={() => processRecording(recording.id, recording.file_path)}
                          className="p-2 rounded-lg hover:bg-teal/10 text-steel/40 hover:text-cream opacity-0 group-hover:opacity-100 transition-all"
                          title="Lejegyzés + összefoglalás"
                        >
                          <Sparkles width={14} height={14} />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          window.electronAPI.exportFile({
                            sourcePath: recording.file_path,
                            defaultName: `${recording.title}.webm`,
                          });
                        }}
                        className="p-2 rounded-lg hover:bg-teal/10 text-steel/40 hover:text-cream opacity-0 group-hover:opacity-100 transition-all"
                        title="Exportálás"
                      >
                        <FileText width={14} height={14} />
                      </button>
                      <button
                        onClick={() => setDeleteRecordingId(recording.id)}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-steel/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 width={14} height={14} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded: Transcript + Summary */}
                  {expandedId === recording.id && (recording.transcription || recording.ai_summary) && (
                    <div className="px-4 pb-4 space-y-3 border-t border-teal/10 pt-3">
                      {recording.ai_summary && (
                        <div>
                          <h4 className="text-xs font-semibold text-emerald-400 flex items-center gap-1 mb-1">
                            <Sparkles width={11} height={11} /> AI Összefoglaló
                          </h4>
                          <p className="text-sm text-cream/80 whitespace-pre-wrap leading-relaxed">{recording.ai_summary}</p>
                        </div>
                      )}
                      {recording.transcription && (
                        <div>
                          <h4 className="text-xs font-semibold text-sky-400 flex items-center gap-1 mb-1">
                            <ScrollText width={11} height={11} /> Szöveges átirat
                          </h4>
                          <p className="text-sm text-steel/80 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">{recording.transcription}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Invoices */}
      {activeTab === 'invoices' && (
        <div className="space-y-3">
          {invoices.length === 0 ? (
            <p className="text-sm text-steel/60 italic text-center py-8">Még nincsenek számlák ehhez az ügyfélhez.</p>
          ) : (
            invoices.map(invoice => (
              <div
                key={invoice.id}
                className="bg-surface-800/50 rounded-lg border border-teal/10 p-4 flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-md bg-green-500/10 flex items-center justify-center">
                    <FileText width={14} height={14} className="text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-cream text-sm">{invoice.invoice_number || invoice.project_name || 'Számla'}</h3>
                    <p className="text-xs text-steel">{invoice.project_name} • {format(parseISO(invoice.created_at), 'yyyy. MM. dd.')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    invoice.status === 'paid' ? 'bg-emerald-500/15 text-emerald-400' :
                    invoice.status === 'pending' ? 'bg-amber-500/15 text-amber-400' :
                    'bg-red-500/15 text-red-400'
                  }`}>
                    {invoice.status === 'paid' ? 'Fizetve' : invoice.status === 'pending' ? 'Függő' : 'Lejárt'}
                  </span>
                  <span className="text-sm font-bold text-cream">
                    {new Intl.NumberFormat('hu-HU', { style: 'currency', currency: invoice.currency, maximumFractionDigits: 0 }).format(invoice.amount)}
                  </span>
                  {invoice.file_path && (
                    <button
                      onClick={() => setViewingInvoice(invoice)}
                      className="px-2 py-1 text-xs text-steel hover:text-cream hover:bg-teal/10 rounded opacity-0 group-hover:opacity-100 transition-all"
                    >
                      Megnyitás
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Save Recording Modal */}
      {showSaveForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-800 rounded-xl border border-teal/15 p-6 w-full max-w-md shadow-2xl">
            <h2 className="font-pixel text-[14px] text-cream mb-5">Felvétel mentése</h2>
            <SaveRecordingForm
              duration={recordingTime}
              clientName={client.name}
              onSave={saveRecording}
              onCancel={() => {
                setShowSaveForm(false);
                recordedBlob.current = null;
                setRecordingTime(0);
              }}
            />
          </div>
        </div>
      )}

      {/* Invoice Platform Popup */}
      {showInvoicePlatform && user?.invoice_platform && PLATFORM_URLS[user.invoice_platform] && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onDoubleClick={() => setShowInvoicePlatform(false)}>
          <div className="bg-surface-800 rounded-xl border border-teal/15 shadow-2xl w-[90vw] h-[85vh] flex flex-col overflow-hidden" onDoubleClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-teal/10 shrink-0">
              <div className="flex items-center gap-2">
                <ExternalLink width={14} height={14} className="text-steel" />
                <span className="text-sm text-cream font-medium">{PLATFORM_URLS[user.invoice_platform].label}</span>
              </div>
              <button
                onClick={() => setShowInvoicePlatform(false)}
                className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream transition-colors"
              >
                <X width={16} height={16} />
              </button>
            </div>
            <webview
              src={PLATFORM_URLS[user.invoice_platform].url}
              partition="persist:shortcuts"
              className="flex-1"
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>
      )}

      {/* Gmail Popup */}
      {showGmail && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onDoubleClick={() => setShowGmail(false)}>
          <div className="bg-surface-800 rounded-xl border border-teal/15 shadow-2xl w-[90vw] h-[85vh] flex flex-col overflow-hidden" onDoubleClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-teal/10 shrink-0">
              <div className="flex items-center gap-2">
                <Mail width={14} height={14} className="text-steel" />
                <span className="text-sm text-cream font-medium">Gmail — {client.name}</span>
              </div>
              <button
                onClick={() => setShowGmail(false)}
                className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream transition-colors"
              >
                <X width={16} height={16} />
              </button>
            </div>
            <webview
              src={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(client.email)}`}
              partition="persist:shortcuts"
              className="flex-1"
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>
      )}

      {/* Invoice Popup */}
      {viewingInvoice && viewingInvoice.file_path && (
        <InvoicePdfViewer invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} />
      )}

      {/* Delete Recording Confirm */}
      {deleteRecordingId && (
        <ConfirmDialog
          title="Felvétel törlése"
          message="Biztosan törölni szeretnéd ezt a felvételt?"
          confirmLabel="Törlés"
          variant="danger"
          onConfirm={() => handleDeleteRecording(deleteRecordingId)}
          onCancel={() => setDeleteRecordingId(null)}
        />
      )}

      {/* Client Note Form */}
      {showNoteForm && (
        <ClientNoteForm
          projects={allProjects}
          clientId={id!}
          onSubmit={handleCreateNote}
          onClose={() => setShowNoteForm(false)}
        />
      )}
    </div>
  );
}

function ClientNoteForm({ projects, clientId, onSubmit, onClose }: {
  projects: Project[];
  clientId: string;
  onSubmit: (data: Partial<Note>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [projectId, setProjectId] = useState('');
  const [isNotification, setIsNotification] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const clientProjects = projects.filter(p => p.client_id === clientId);
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
          <div>
            <label className="block text-xs font-medium text-steel mb-1">Projekt</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} className={inputClass}>
              <option value="">Nincs</option>
              {clientProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
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

function SaveRecordingForm({ duration, clientName, onSave, onCancel }: {
  duration: number;
  clientName: string;
  onSave: (title: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const inputClass = "w-full px-3 py-2 bg-surface-900 border border-teal/10 rounded-lg text-sm text-cream focus:outline-none focus:ring-2 focus:ring-teal/30";

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        if (!title.trim()) return;
        onSave(title.trim());
      }}
      className="space-y-4"
    >
      <p className="text-sm text-steel">
        Időtartam: {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')} • Ügyfél: {clientName}
      </p>
      <div>
        <label className="block text-xs font-medium text-steel mb-1">Cím *</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputClass} placeholder="pl. Hívás - Projekt egyeztetés" required />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-steel hover:bg-teal/10 rounded-lg">Elvetés</button>
        <button type="submit" className="px-4 py-2 text-sm bg-teal text-cream rounded-lg hover:bg-teal/80">Mentés</button>
      </div>
    </form>
  );
}
