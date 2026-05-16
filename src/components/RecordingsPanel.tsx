import { useEffect, useRef, useState } from 'react';
import {
  AudioLines, ChevronDown, ChevronUp, Clock, Loader2, Mic, Minus, Play, Plus, ScrollText,
  Search, Sparkles, Square, UserRound, Users, X,
} from 'lucide-react';
import MarkdownSummary from './MarkdownSummary';
import SttDisclaimerModal, { isSttDisclaimerDismissed } from './SttDisclaimerModal';
import { canCaptureSystemAudio, RecordingSession, startAudioRecording } from '../utils/recording';
import { useAuth } from '../contexts/AuthContext';

type ActiveReview = {
  recording: Recording;
  segments: RecordingSegment[];
  speakers: RecordingSpeaker[];
};

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatTranscript(segments: RecordingSegment[], speakers: RecordingSpeaker[]) {
  const labels = new Map(speakers.map(speaker => [speaker.id, speaker.label]));
  return segments.map(segment => `${labels.get(segment.speakerId) || segment.speakerId}: ${segment.text}`).join('\n\n');
}

function getSampleForSpeaker(speakerId: string, segments: RecordingSegment[]) {
  const sample = segments.find(segment => segment.speakerId === speakerId && segment.text.trim().length > 12);
  if (!sample) return 'Nincs elég minta ehhez a beszélőhöz.';
  return sample.text.length > 120 ? `${sample.text.slice(0, 120)}...` : sample.text;
}

function getStatusLabel(status: RecordingProcessingStatus | null) {
  switch (status) {
    case 'transcribing': return 'Lejegyzés...';
    case 'summarizing': return 'Összefoglalás...';
    case 'ready': return 'Kész';
    case 'needs_review': return 'Ellenőrzés kell';
    case 'failed': return 'Hiba';
    default: return 'Rögzítve';
  }
}

export default function RecordingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [clientId, setClientId] = useState('');
  const [title, setTitle] = useState('');
  const [speakerCount, setSpeakerCount] = useState(2);
  const [includeSystemAudio, setIncludeSystemAudio] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeReview, setActiveReview] = useState<ActiveReview | null>(null);
  const [transcriptRecording, setTranscriptRecording] = useState<Recording | null>(null);
  const [transcriptQuery, setTranscriptQuery] = useState('');
  const [showSttDisclaimer, setShowSttDisclaimer] = useState(false);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const recordingSession = useRef<RecordingSession | null>(null);
  const timerRef = useRef<number>(0);
  const recordingTimeRef = useRef(0);

  useEffect(() => {
    if (open) loadData();
  }, [open]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recordingSession.current?.stop();
    };
  }, []);

  async function loadData() {
    try {
      const [clientRows, recordingRows] = await Promise.all([
        window.electronAPI.getClients(),
        window.electronAPI.getRecordings(),
      ]);
      setClients(clientRows);
      setRecordings(recordingRows);
    } catch (err) {
      console.error('Failed to load recordings panel data:', err);
    }
  }

  function handleStartClick() {
    if (isSttDisclaimerDismissed()) {
      startRecording();
    } else {
      setShowSttDisclaimer(true);
    }
  }

  async function startRecording() {
    try {
      const session = await startAudioRecording({ includeSystemAudio });
      recordingSession.current = session;
      mediaRecorder.current = new MediaRecorder(session.stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const duration = recordingTimeRef.current;
        recordingSession.current?.stop();
        recordingSession.current = null;
        saveAndProcessRecording(blob, duration);
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimeRef.current = 0;
      timerRef.current = window.setInterval(() => {
        recordingTimeRef.current += 1;
        setRecordingTime(recordingTimeRef.current);
      }, 1000);

      if (includeSystemAudio && !session.systemAudioActive) {
        alert('A rendszerhang rögzítése nem sikerült — a felvétel csak mikrofonról készül. (Windows szükséges.)');
      }
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Nem sikerült elindítani a felvételt. Ellenőrizd a mikrofon engedélyeket.');
    }
  }

  function stopRecording() {
    if (!mediaRecorder.current || !isRecording) return;
    mediaRecorder.current.stop();
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = 0;
    }
  }

  function makeDefaultTitle(recordingType: RecordingType) {
    const selectedClient = clients.find(client => client.id === clientId);
    const date = new Date().toLocaleDateString('hu-HU');
    if (recordingType === 'client_call') return `Hívás - ${selectedClient?.name || 'Ügyfél'} - ${date}`;
    return `Belső megbeszélés - ${date}`;
  }

  async function saveAndProcessRecording(blob: Blob, duration: number) {
    const recordingType: RecordingType = clientId ? 'client_call' : 'internal_meeting';
    const selectedClient = clients.find(client => client.id === clientId);
    const finalTitle = title.trim() || makeDefaultTitle(recordingType);

    try {
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Array.from(new Uint8Array(arrayBuffer));
      const filePath = await window.electronAPI.saveFile({
        buffer,
        fileName: `recording-${Date.now()}.webm`,
        type: 'audio/webm',
      });

      const created = await window.electronAPI.createRecording({
        title: finalTitle,
        client_id: clientId || null,
        file_path: filePath,
        duration_seconds: duration,
        recording_type: recordingType,
        expected_speaker_count: speakerCount,
        processing_status: 'recorded',
      });

      setTitle('');
      setProcessingId(created.id);
      await loadData();
      await processRecording(created, selectedClient || null, recordingType);
    } catch (err) {
      console.error('Failed to save recording:', err);
      alert(`Felvétel mentési hiba: ${err}`);
    } finally {
      setProcessingId(null);
      setRecordingTime(0);
      recordingTimeRef.current = 0;
    }
  }

  async function processRecording(recording: Recording, client: Client | null, recordingType: RecordingType) {
    try {
      await window.electronAPI.updateRecording(recording.id, { processing_status: 'transcribing', processing_error: null });
      await loadData();

      const transcribed = await window.electronAPI.transcribeRecording(recording.file_path, {
        expectedSpeakerCount: recording.expected_speaker_count || speakerCount,
        diarize: true,
      });
      if (transcribed.error) throw new Error(transcribed.error);

      const segments = transcribed.segments || [];
      const assignment = await window.electronAPI.assignRecordingSpeakers({
        segments,
        expectedSpeakerCount: recording.expected_speaker_count || speakerCount,
        recordingType,
        clientName: client?.name || null,
        userName: user?.name || null,
        userCompanyName: user?.company_name || null,
      });

      const speakers = assignment.speakers;
      const formattedTranscript = segments.length > 0 ? formatTranscript(segments, speakers) : transcribed.text;
      const speakerCountMismatch = Boolean(transcribed.detectedSpeakerCount && transcribed.detectedSpeakerCount !== (recording.expected_speaker_count || speakerCount));
      const needsReview = assignment.needsReview || assignment.confidence !== 'high' || speakerCountMismatch;
      const nextStatus: RecordingProcessingStatus = recordingType === 'internal_meeting' ? 'needs_review' : 'summarizing';

      await window.electronAPI.updateRecording(recording.id, {
        transcription: formattedTranscript,
        speaker_segments: JSON.stringify(segments),
        speaker_labels: JSON.stringify(speakers),
        detected_speaker_count: transcribed.detectedSpeakerCount || speakers.length,
        speaker_confidence: assignment.confidence,
        speaker_review_reason: speakerCountMismatch ? 'Az elvárt és talált beszélőszám eltér.' : (assignment.reason || null),
        processing_status: nextStatus,
      });

      if (recordingType === 'internal_meeting') {
        setActiveReview({ recording: { ...recording, speaker_segments: JSON.stringify(segments), speaker_labels: JSON.stringify(speakers) }, segments, speakers });
        await loadData();
        return;
      }

      const summary = await window.electronAPI.summarizeRecording(formattedTranscript);
      if (summary.error) throw new Error(summary.error);
      await window.electronAPI.updateRecording(recording.id, {
        ai_summary: summary.summary,
        processing_status: needsReview ? 'needs_review' : 'ready',
      });
      await loadData();
    } catch (err) {
      console.error('Recording processing failed:', err);
      await window.electronAPI.updateRecording(recording.id, {
        processing_status: 'failed',
        processing_error: String(err),
      });
      await loadData();
    }
  }

  async function generateInternalSummary() {
    if (!activeReview) return;
    const speakers = activeReview.speakers.map((speaker, index) => ({
      ...speaker,
      label: speaker.label.trim() || `Beszélő ${index + 1}`,
    }));
    const transcript = formatTranscript(activeReview.segments, speakers);

    try {
      setProcessingId(activeReview.recording.id);
      await window.electronAPI.updateRecording(activeReview.recording.id, {
        speaker_labels: JSON.stringify(speakers),
        transcription: transcript,
        processing_status: 'summarizing',
      });
      const { summary, error } = await window.electronAPI.summarizeRecording(transcript);
      if (error) throw new Error(error);
      await window.electronAPI.updateRecording(activeReview.recording.id, {
        ai_summary: summary,
        processing_status: 'ready',
      });
      setActiveReview(null);
      await loadData();
    } catch (err) {
      console.error('Internal summary failed:', err);
      await window.electronAPI.updateRecording(activeReview.recording.id, {
        processing_status: 'failed',
        processing_error: String(err),
      });
      await loadData();
    } finally {
      setProcessingId(null);
    }
  }

  function openReview(recording: Recording) {
    const segments = parseJsonArray<RecordingSegment>(recording.speaker_segments);
    const speakers = parseJsonArray<RecordingSpeaker>(recording.speaker_labels);
    setActiveReview({ recording, segments, speakers });
  }

  if (!open) return null;

  const recentRecordings = recordings.slice(0, 5);
  const transcriptSegments = parseJsonArray<RecordingSegment>(transcriptRecording?.speaker_segments);
  const transcriptSpeakers = parseJsonArray<RecordingSpeaker>(transcriptRecording?.speaker_labels);
  const transcriptLabels = new Map(transcriptSpeakers.map(speaker => [speaker.id, speaker.label]));
  const filteredTranscript = transcriptSegments.filter(segment => !transcriptQuery.trim() || segment.text.toLowerCase().includes(transcriptQuery.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onDoubleClick={onClose}>
      <div className="w-full max-w-3xl max-h-[86vh] bg-surface-900 border border-teal/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col" onDoubleClick={event => event.stopPropagation()}>
        <div className="h-1 bg-teal" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-teal/10 shrink-0">
          <div>
            <h2 className="font-pixel text-[15px] text-cream flex items-center gap-2">
              <AudioLines width={17} height={17} className="text-teal" /> Felvételek
            </h2>
            <p className="text-xs text-steel mt-1">Gyors rögzítés, beszélők és AI összefoglaló</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream transition-colors">
            <X width={16} height={16} />
          </button>
        </div>

        <div className="p-5 overflow-auto space-y-5">
          <div className="rounded-xl border border-teal/10 bg-surface-800/50 p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-cream">Új felvétel</h3>
                <p className="text-xs text-steel mt-0.5">Az ügyfél opcionális; üresen hagyva belső megbeszélésként mentjük.</p>
              </div>
              {isRecording && <span className="text-lg font-mono text-red-300 tabular-nums">{formatTime(recordingTime)}</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3">
              <div>
                <label className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Cím</label>
                <input
                  value={title}
                  onChange={event => setTitle(event.target.value)}
                  disabled={isRecording}
                  className="w-full px-3 py-2 bg-surface-900/60 border border-teal/10 rounded-lg text-sm text-cream focus:outline-none focus:border-teal/30 placeholder:text-steel/40"
                  placeholder="Automatikus cím, ha üresen marad"
                />
              </div>
              <div>
                <label className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Beszélők</label>
                <div className="flex items-center justify-between rounded-lg border border-teal/10 bg-surface-900/60 px-2 py-1.5">
                  <button disabled={isRecording || speakerCount <= 1} onClick={() => setSpeakerCount(prev => Math.max(1, prev - 1))} className="p-1 rounded hover:bg-teal/10 text-steel disabled:opacity-30">
                    <Minus width={14} height={14} />
                  </button>
                  <span className="text-sm font-semibold text-cream">{speakerCount}</span>
                  <button disabled={isRecording || speakerCount >= 8} onClick={() => setSpeakerCount(prev => Math.min(8, prev + 1))} className="p-1 rounded hover:bg-teal/10 text-steel disabled:opacity-30">
                    <Plus width={14} height={14} />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 mt-3 items-end">
              <div>
                <label className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Ügyfél</label>
                <select
                  value={clientId}
                  onChange={event => setClientId(event.target.value)}
                  disabled={isRecording}
                  className="w-full px-3 py-2 bg-surface-900/60 border border-teal/10 rounded-lg text-sm text-cream focus:outline-none focus:border-teal/30"
                >
                  <option value="">Belső megbeszélés</option>
                  {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </div>
              <button
                onClick={isRecording ? stopRecording : handleStartClick}
                className={`h-10 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                  isRecording ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-teal text-cream hover:bg-teal/80'
                }`}
              >
                {isRecording ? <><Square width={15} height={15} /> Leállítás</> : <><Mic width={15} height={15} /> Felvétel indítása</>}
              </button>
            </div>

            {canCaptureSystemAudio() && (
              <label className="mt-3 flex items-center gap-2 text-xs text-steel cursor-pointer select-none">
                <input type="checkbox" checked={includeSystemAudio} disabled={isRecording} onChange={event => setIncludeSystemAudio(event.target.checked)} className="accent-teal" />
                Rendszerhang rögzítése
              </label>
            )}
          </div>

          {activeReview && (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
              <h3 className="text-sm font-semibold text-cream flex items-center gap-2 mb-2">
                <Users width={15} height={15} className="text-amber-300" /> Beszélők azonosítása
              </h3>
              <div className="space-y-2">
                {activeReview.speakers.map((speaker, index) => (
                  <div key={speaker.id} className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-2 items-start rounded-lg bg-surface-900/45 border border-teal/8 p-2.5">
                    <input
                      value={speaker.label}
                      onChange={event => setActiveReview(prev => prev ? {
                        ...prev,
                        speakers: prev.speakers.map(item => item.id === speaker.id ? { ...item, label: event.target.value } : item),
                      } : prev)}
                      className="px-2.5 py-2 bg-surface-950/60 border border-teal/10 rounded-lg text-sm text-cream focus:outline-none focus:border-teal/30"
                      placeholder={`Beszélő ${index + 1}`}
                    />
                    <p className="text-xs text-steel leading-relaxed">“{getSampleForSpeaker(speaker.id, activeReview.segments)}”</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <button onClick={() => setActiveReview(null)} className="px-3 py-2 text-xs text-steel hover:text-cream">Később</button>
                <button onClick={generateInternalSummary} className="px-4 py-2 rounded-lg bg-teal text-cream text-xs font-medium hover:bg-teal/80 flex items-center gap-2">
                  {processingId === activeReview.recording.id ? <Loader2 width={13} height={13} className="animate-spin" /> : <Sparkles width={13} height={13} />}
                  Összefoglaló készítése
                </button>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-cream">Legutóbbi felvételek</h3>
            </div>
            {recentRecordings.length === 0 ? (
              <p className="text-xs text-steel/60 italic py-3">Még nincs felvétel.</p>
            ) : (
              <div className="space-y-2">
                {recentRecordings.map(recording => (
                  <div key={recording.id} className="rounded-lg border border-teal/10 bg-surface-800/40 overflow-hidden">
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-9 h-9 rounded-full bg-teal/10 flex items-center justify-center shrink-0">
                        {recording.recording_type === 'internal_meeting' ? <Users width={15} height={15} className="text-teal" /> : <UserRound width={15} height={15} className="text-teal" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-cream truncate">{recording.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-steel">
                          <span className="flex items-center gap-1"><Clock width={10} height={10} /> {formatTime(recording.duration_seconds || 0)}</span>
                          <span>{getStatusLabel(recording.processing_status)}</span>
                        </div>
                      </div>
                      {processingId === recording.id && <Loader2 width={15} height={15} className="text-teal animate-spin" />}
                      {recording.processing_status === 'needs_review' && recording.recording_type === 'internal_meeting' && !recording.ai_summary && (
                        <button onClick={() => openReview(recording)} className="px-3 py-1.5 rounded-lg bg-amber-400/10 text-amber-200 text-xs hover:bg-amber-400/15">Nevek</button>
                      )}
                      {(recording.ai_summary || recording.transcription) && (
                        <button onClick={() => setExpandedId(expandedId === recording.id ? null : recording.id)} className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream">
                          {expandedId === recording.id ? <ChevronUp width={15} height={15} /> : <ChevronDown width={15} height={15} />}
                        </button>
                      )}
                    </div>
                    {expandedId === recording.id && (
                      <div className="border-t border-teal/10 p-3 space-y-3">
                        {recording.ai_summary && <MarkdownSummary content={recording.ai_summary} />}
                        {recording.transcription && (
                          <button onClick={() => setTranscriptRecording(recording)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-900/60 border border-teal/10 text-xs text-cream hover:border-teal/25">
                            <ScrollText width={13} height={13} /> Átirat megnyitása
                          </button>
                        )}
                        {recording.processing_error && <p className="text-xs text-red-300">{recording.processing_error}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {transcriptRecording && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onDoubleClick={() => setTranscriptRecording(null)}>
          <div className="w-full max-w-3xl max-h-[86vh] bg-surface-900 border border-teal/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col" onDoubleClick={event => event.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-teal/10 shrink-0">
              <div>
                <h3 className="font-pixel text-[14px] text-cream">Átirat</h3>
                <p className="text-xs text-steel mt-1 truncate">{transcriptRecording.title}</p>
              </div>
              <button onClick={() => setTranscriptRecording(null)} className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream">
                <X width={16} height={16} />
              </button>
            </div>
            <div className="p-4 border-b border-teal/10 shrink-0">
              <div className="relative">
                <Search width={14} height={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel" />
                <input
                  value={transcriptQuery}
                  onChange={event => setTranscriptQuery(event.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-surface-800/60 border border-teal/10 rounded-lg text-sm text-cream focus:outline-none focus:border-teal/30 placeholder:text-steel/40"
                  placeholder="Keresés az átiratban"
                />
              </div>
            </div>
            <div className="p-5 overflow-auto space-y-3">
              {filteredTranscript.length > 0 ? filteredTranscript.map((segment, index) => (
                <div key={`${segment.speakerId}-${index}`} className="rounded-lg border border-teal/8 bg-surface-800/40 p-3">
                  <p className="text-xs font-semibold text-teal mb-1">{transcriptLabels.get(segment.speakerId) || segment.speakerId}</p>
                  <p className="text-sm text-cream/80 leading-relaxed">{segment.text}</p>
                </div>
              )) : (
                <p className="text-sm text-steel whitespace-pre-wrap leading-relaxed">{transcriptRecording.transcription}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showSttDisclaimer && (
        <SttDisclaimerModal
          onConfirm={() => { setShowSttDisclaimer(false); startRecording(); }}
          onClose={() => setShowSttDisclaimer(false)}
        />
      )}
    </div>
  );
}
