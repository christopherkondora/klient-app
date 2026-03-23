import { useEffect, useState, useRef } from 'react';
import { Mic, Square, Play, Pause, Trash2, Clock } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Recordings() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const timerRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordedBlob = useRef<Blob | null>(null);

  useEffect(() => {
    loadData();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function loadData() {
    try {
      const [recordingsData, clientsData] = await Promise.all([
        window.electronAPI.getRecordings(),
        window.electronAPI.getClients(),
      ]);
      setRecordings(recordingsData);
      setClients(clientsData);
    } catch (err) {
      console.error('Failed to load recordings:', err);
    } finally {
      setLoading(false);
    }
  }

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

  async function saveRecording(data: { title: string; clientId: string }) {
    if (!recordedBlob.current) return;
    try {
      const arrayBuffer = await recordedBlob.current.arrayBuffer();
      const buffer = Array.from(new Uint8Array(arrayBuffer));
      const filePath = await window.electronAPI.saveFile({
        buffer,
        fileName: `recording-${Date.now()}.webm`,
        type: 'audio/webm',
      });

      await window.electronAPI.createRecording({
        title: data.title,
        client_id: data.clientId || undefined,
        file_path: filePath,
        duration_seconds: recordingTime,
      });

      setShowSaveForm(false);
      recordedBlob.current = null;
      setRecordingTime(0);
      loadData();
    } catch (err) {
      console.error('Failed to save recording:', err);
    }
  }

  async function handleDelete(id: string) {
    try {
      await window.electronAPI.deleteRecording(id);
      setDeleteId(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete recording:', err);
    }
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Hangfelvételek</h1>
        <p className="text-surface-500 text-sm mt-1">Rögzítsd a hívásokat, hogy semmi ne menjen feledésbe</p>
      </div>

      {/* Recorder */}
      <div className="bg-white rounded-xl border border-surface-200 p-6 text-center">
        <div className="flex flex-col items-center gap-4">
          {isRecording ? (
            <>
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center animate-pulse">
                  <Mic size={28} className="text-red-500" />
                </div>
              </div>
              <p className="text-2xl font-mono font-bold text-surface-900">{formatTime(recordingTime)}</p>
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600"
              >
                <Square size={16} /> Leállítás
              </button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center">
                <Mic size={28} className="text-primary-500" />
              </div>
              <p className="text-sm text-surface-500">Kattints a gombra a felvétel indításához</p>
              <button
                onClick={startRecording}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700"
              >
                <Mic size={16} /> Felvétel indítása
              </button>
            </>
          )}
        </div>
      </div>

      {/* Recordings List */}
      {recordings.length === 0 ? (
        <p className="text-sm text-surface-400 italic text-center py-8">Nincsenek hangfelvételek</p>
      ) : (
        <div className="space-y-3">
          {recordings.map(recording => (
            <div key={recording.id} className="bg-white rounded-xl border border-surface-200 p-4 flex items-center gap-4 group">
              <button
                onClick={async () => {
                  if (playingId === recording.id) {
                    audioRef.current?.pause();
                    setPlayingId(null);
                  } else {
                    if (audioRef.current) audioRef.current.pause();
                    const buf = await window.electronAPI.readAudioFile(recording.file_path);
                    const blob = new Blob([buf], { type: 'audio/webm' });
                    const url = URL.createObjectURL(blob);
                    const audio = new Audio(url);
                    audio.onended = () => { setPlayingId(null); URL.revokeObjectURL(url); };
                    audio.play();
                    audioRef.current = audio;
                    setPlayingId(recording.id);
                  }
                }}
                className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 hover:bg-primary-100 shrink-0"
              >
                {playingId === recording.id ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-surface-900 text-sm truncate">{recording.title}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-surface-500 flex items-center gap-1">
                    <Clock size={10} /> {formatTime(recording.duration_seconds)}
                  </span>
                  <span className="text-xs text-surface-400">
                    {new Date(recording.created_at).toLocaleDateString('hu-HU')}
                  </span>
                </div>
                {recording.ai_summary && (
                  <p className="text-xs text-surface-500 mt-1 truncate">{recording.ai_summary}</p>
                )}
              </div>
              <button
                onClick={() => setDeleteId(recording.id)}
                className="p-2 rounded-lg hover:bg-red-50 text-surface-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Save Recording Modal */}
      {showSaveForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-surface-900 mb-4">Felvétel mentése</h2>
            <SaveRecordingForm
              clients={clients}
              duration={recordingTime}
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

      {/* Delete Confirm */}
      {deleteId && (
        <ConfirmDialog
          title="Felvétel törlése"
          message="Biztosan törölni szeretnéd ezt a felvételt?"
          confirmLabel="Törlés"
          variant="danger"
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

function SaveRecordingForm({ clients, duration, onSave, onCancel }: {
  clients: Client[];
  duration: number;
  onSave: (data: { title: string; clientId: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        if (!title.trim()) return;
        onSave({ title: title.trim(), clientId });
      }}
      className="space-y-4"
    >
      <p className="text-sm text-steel">Időtartam: {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}</p>
      <div>
        <label className="block text-xs font-medium text-steel mb-1">Cím *</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full px-3 py-2 bg-surface-900 border border-teal/10 rounded-lg text-sm text-cream focus:outline-none focus:ring-2 focus:ring-teal/30"
          placeholder="pl. Hívás - Ügyfél neve"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-steel mb-1">Ügyfél</label>
        <select
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          className="w-full px-3 py-2 bg-surface-900 border border-teal/10 rounded-lg text-sm text-cream focus:outline-none focus:ring-2 focus:ring-teal/30"
        >
          <option value="">Nincs ügyfél</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-steel hover:bg-teal/10 rounded-lg">
          Elvetés
        </button>
        <button type="submit" className="px-4 py-2 text-sm bg-teal text-cream rounded-lg hover:bg-teal/80">
          Mentés
        </button>
      </div>
    </form>
  );
}
