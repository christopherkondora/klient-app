import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Timer, Play, Pause, RotateCcw, Coffee, X,
  ChevronUp, ChevronDown, Settings2,
} from 'lucide-react';

type Phase = 'work' | 'shortBreak' | 'longBreak';

const PHASE_LABELS: Record<Phase, string> = {
  work: 'Munka',
  shortBreak: 'Szünet',
  longBreak: 'Hosszú szünet',
};

const PHASE_COLORS: Record<Phase, string> = {
  work: 'text-teal',
  shortBreak: 'text-emerald-400',
  longBreak: 'text-violet-400',
};

function playChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 830;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
    // Second tone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 1050;
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.3);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
    osc2.start(ctx.currentTime + 0.3);
    osc2.stop(ctx.currentTime + 1.2);
  } catch { /* audio not available */ }
}

function sendNotification(title: string, body: string) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') new Notification(title, { body });
    });
  }
}

export default function PomodoroTimer() {
  const { user, updateUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Timer config (minutes)
  const [workMin, setWorkMin] = useState(25);
  const [shortBreakMin, setShortBreakMin] = useState(5);
  const [longBreakMin, setLongBreakMin] = useState(15);
  const [longBreakEvery, setLongBreakEvery] = useState(4);

  // Timer state
  const [phase, setPhase] = useState<Phase>('work');
  const [secondsLeft, setSecondsLeft] = useState(workMin * 60);
  const [running, setRunning] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);

  // Project tracking
  const [projects, setProjects] = useState<{ id: string; name: string; client_name?: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [pomodoroStartedAt, setPomodoroStartedAt] = useState<string | null>(null);

  // First-use prompt
  const [showFirstUsePrompt, setShowFirstUsePrompt] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const projectTrackingEnabled = user?.pomodoro_project_tracking === 1;

  // Load projects if tracking enabled
  useEffect(() => {
    if (projectTrackingEnabled && open) {
      window.electronAPI.getProjects().then((p: Project[]) => {
        setProjects(p.filter(pr => pr.status === 'active').map(pr => ({
          id: pr.id,
          name: pr.name,
          client_name: pr.client_name,
        })));
      });
    }
  }, [projectTrackingEnabled, open]);

  // Reset seconds when config changes (only if not running)
  useEffect(() => {
    if (!running) {
      const mins = phase === 'work' ? workMin : phase === 'shortBreak' ? shortBreakMin : longBreakMin;
      setSecondsLeft(mins * 60);
    }
  }, [workMin, shortBreakMin, longBreakMin, phase, running]);

  // The timer interval
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  // When timer hits 0
  useEffect(() => {
    if (secondsLeft === 0 && running) {
      setRunning(false);
      playChime();

      if (phase === 'work') {
        const newCount = completedPomodoros + 1;
        setCompletedPomodoros(newCount);
        sendNotification('Pomodoro kész! 🍅', `${newCount}. munkamenet befejezve. Ideje szünetet tartani!`);

        // Log to project if tracking enabled
        if (projectTrackingEnabled && selectedProjectId && pomodoroStartedAt) {
          logPomodoroToProject(selectedProjectId, workMin, pomodoroStartedAt);
          setPomodoroStartedAt(null);
        }

        // Next phase
        if (newCount % longBreakEvery === 0) {
          setPhase('longBreak');
          setSecondsLeft(longBreakMin * 60);
        } else {
          setPhase('shortBreak');
          setSecondsLeft(shortBreakMin * 60);
        }
      } else {
        sendNotification('Szünet vége! ⏰', 'Ideje visszatérni a munkához!');
        setPhase('work');
        setSecondsLeft(workMin * 60);
      }
    }
  }, [secondsLeft, running, phase, completedPomodoros, workMin, shortBreakMin, longBreakMin, longBreakEvery, projectTrackingEnabled, selectedProjectId, pomodoroStartedAt]);

  const logPomodoroToProject = useCallback(async (projectId: string, minutes: number, startedAt: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const startDate = today;
      const endDate = today;
      const events = await window.electronAPI.getCalendarEvents(startDate, endDate) as CalendarEvent[];
      const existingEvent = events.find(e => e.project_id === projectId && e.date === today);

      if (existingEvent) {
        const currentMinutes = existingEvent.actual_minutes ?? 0;
        await window.electronAPI.updateCalendarEvent(existingEvent.id, {
          actual_minutes: currentMinutes + minutes,
        });
      } else {
        const [h, m] = startedAt.split(':').map(Number);
        const endMin = h * 60 + m + minutes;
        const endH = String(Math.floor(endMin / 60) % 24).padStart(2, '0');
        const endM = String(endMin % 60).padStart(2, '0');
        await window.electronAPI.createCalendarEvent({
          project_id: projectId,
          title: 'Pomodoro',
          description: `${minutes} perc fókuszált munka`,
          date: today,
          start_time: startedAt,
          end_time: `${endH}:${endM}`,
          duration_hours: Math.round((minutes / 60) * 100) / 100,
          actual_minutes: minutes,
          type: 'work',
        });
      }
    } catch (err) {
      console.error('Pomodoro log failed:', err);
    }
  }, []);

  const handleStart = () => {
    // First-use prompt
    if (!localStorage.getItem('pomodoro_first_use_prompted')) {
      localStorage.setItem('pomodoro_first_use_prompted', '1');
      setShowFirstUsePrompt(true);
      return;
    }

    if (phase === 'work') {
      const now = new Date();
      setPomodoroStartedAt(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    }
    setRunning(true);
  };

  const handlePause = () => setRunning(false);

  const handleReset = () => {
    setRunning(false);
    setPomodoroStartedAt(null);
    const mins = phase === 'work' ? workMin : phase === 'shortBreak' ? shortBreakMin : longBreakMin;
    setSecondsLeft(mins * 60);
  };

  const handleFullReset = () => {
    setRunning(false);
    setPomodoroStartedAt(null);
    setPhase('work');
    setSecondsLeft(workMin * 60);
    setCompletedPomodoros(0);
  };

  const handleFirstUseResponse = async (enableTracking: boolean) => {
    if (enableTracking) {
      await updateUser({ pomodoro_project_tracking: 1 });
    }
    setShowFirstUsePrompt(false);
    // Now start the timer
    if (phase === 'work') {
      const now = new Date();
      setPomodoroStartedAt(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    }
    setRunning(true);
  };

  // Format time
  const totalSecs = phase === 'work' ? workMin * 60 : phase === 'shortBreak' ? shortBreakMin * 60 : longBreakMin * 60;
  const progress = totalSecs > 0 ? (totalSecs - secondsLeft) / totalSecs : 0;
  const displayMin = Math.floor(secondsLeft / 60);
  const displaySec = secondsLeft % 60;

  // SVG circle dimensions
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-6 right-[5.5rem] z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
          running
            ? 'bg-teal text-cream animate-pulse shadow-teal/30'
            : 'bg-teal text-cream shadow-teal/25 hover:bg-teal/80 hover:scale-105'
        }`}
        title="Pomodoro"
      >
        {running ? (
          <span className="text-sm font-bold font-mono">{displayMin}:{String(displaySec).padStart(2, '0')}</span>
        ) : (
          <Timer size={22} />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-[5.5rem] z-50 w-72 bg-surface-900/95 backdrop-blur-md border border-teal/15 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-teal/10">
            <div className="flex items-center gap-2">
              <Timer size={14} className="text-teal" />
              <span className="text-xs font-semibold text-cream">Pomodoro</span>
              {completedPomodoros > 0 && (
                <span className="text-[10px] text-steel bg-teal/10 px-1.5 py-0.5 rounded-full">
                  🍅 {completedPomodoros}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSettings(v => !v)}
                className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'text-cream bg-teal/15' : 'text-steel hover:text-cream hover:bg-teal/10'}`}
                title="Beállítások"
              >
                <Settings2 size={13} />
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-steel hover:text-cream hover:bg-teal/10 transition-colors">
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Settings panel */}
          {showSettings && (
            <div className="px-4 py-3 border-b border-teal/10 space-y-2.5">
              <TimeSetting label="Munka" value={workMin} onChange={setWorkMin} min={1} max={90} disabled={running} />
              <TimeSetting label="Szünet" value={shortBreakMin} onChange={setShortBreakMin} min={1} max={30} disabled={running} />
              <TimeSetting label="Hosszú szünet" value={longBreakMin} onChange={setLongBreakMin} min={1} max={60} disabled={running} />
              <TimeSetting label="Hosszú szünet minden" value={longBreakEvery} onChange={setLongBreakEvery} min={2} max={10} disabled={running} suffix=". után" />
            </div>
          )}

          {/* Project selector (only if tracking enabled) */}
          {projectTrackingEnabled && phase === 'work' && (
            <div className="px-4 pt-3">
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                disabled={running}
                className="w-full text-xs bg-surface-800 border border-teal/15 rounded-lg px-2.5 py-1.5 text-cream disabled:opacity-50"
              >
                <option value="">Nincs projekt</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.client_name ? `${p.client_name} – ` : ''}{p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Timer display */}
          <div className="flex flex-col items-center py-6">
            {/* Phase label */}
            <span className={`text-[10px] font-medium uppercase tracking-wider mb-3 ${PHASE_COLORS[phase]}`}>
              {phase !== 'work' && <Coffee size={10} className="inline mr-1 -mt-0.5" />}
              {PHASE_LABELS[phase]}
            </span>

            {/* Circular progress */}
            <div className="relative w-36 h-36">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
                <circle
                  cx="64" cy="64" r={radius}
                  fill="none" stroke="currentColor"
                  className="text-teal/10" strokeWidth="4"
                />
                <circle
                  cx="64" cy="64" r={radius}
                  fill="none" stroke="currentColor"
                  className={PHASE_COLORS[phase]}
                  strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold font-mono text-cream tracking-tight">
                  {displayMin}:{String(displaySec).padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 pb-5">
            <button
              onClick={handleReset}
              className="p-2 rounded-lg text-steel hover:text-cream hover:bg-teal/10 transition-colors"
              title="Újraindítás"
            >
              <RotateCcw size={16} />
            </button>

            {running ? (
              <button
                onClick={handlePause}
                className="w-12 h-12 rounded-full bg-teal/20 text-cream border-2 border-teal/40 flex items-center justify-center hover:bg-teal/30 transition-colors"
              >
                <Pause size={20} />
              </button>
            ) : (
              <button
                onClick={handleStart}
                className="w-12 h-12 rounded-full bg-teal text-ink flex items-center justify-center hover:bg-teal/90 transition-colors shadow-lg shadow-teal/20"
              >
                <Play size={20} className="ml-0.5" />
              </button>
            )}

            <button
              onClick={handleFullReset}
              className="p-2 rounded-lg text-steel hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Teljes visszaállítás"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* First-use prompt modal */}
      {showFirstUsePrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-900 border border-teal/15 rounded-2xl shadow-2xl w-80 p-6">
            <div className="flex items-center gap-2 mb-3">
              <Timer size={18} className="text-teal" />
              <h3 className="text-sm font-semibold text-cream">Pomodoro beállítás</h3>
            </div>
            <p className="text-xs text-steel leading-relaxed mb-5">
              Szeretnéd a Pomodoro munkameneteket projektekhez kapcsolni?
              A befejezett időt automatikusan rögzítjük a kiválasztott projekt naptári eseményéhez.
              <br /><br />
              <span className="text-steel/60">Ezt később a Beállításokban is megváltoztathatod.</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleFirstUseResponse(false)}
                className="flex-1 py-2 text-xs font-medium text-steel border border-teal/15 rounded-lg hover:border-teal/30 hover:text-cream transition-colors"
              >
                Nem, köszi
              </button>
              <button
                onClick={() => handleFirstUseResponse(true)}
                className="flex-1 py-2 text-xs font-medium text-cream bg-teal rounded-lg hover:bg-teal/90 transition-colors"
              >
                Igen, kapcsold be
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TimeSetting({
  label, value, onChange, min, max, disabled, suffix,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; disabled: boolean; suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-steel">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={disabled || value <= min}
          className="p-0.5 rounded text-steel hover:text-cream disabled:opacity-30 transition-colors"
        >
          <ChevronDown size={12} />
        </button>
        <span className="text-xs font-medium text-cream w-8 text-center">
          {value}{suffix ?? ' p'}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={disabled || value >= max}
          className="p-0.5 rounded text-steel hover:text-cream disabled:opacity-30 transition-colors"
        >
          <ChevronUp size={12} />
        </button>
      </div>
    </div>
  );
}
