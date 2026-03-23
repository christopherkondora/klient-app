import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { ArrowRight, ArrowLeft, Check, Loader2, Receipt, Target, Palette, BarChart3, Calendar, FolderOpen, FileText, Mic } from 'lucide-react';

type Step = 'auth' | 'platform' | 'goal' | 'theme' | 'done';
type AuthMode = 'login' | 'register' | 'reset';

const INVOICE_PLATFORMS = [
  { id: 'szamlazz', label: 'Számlázz.hu' },
  { id: 'billingo', label: 'Billingo' },
  { id: 'nav', label: 'NAV Online Számla' },
  { id: 'kulcs', label: 'Kulcs-Soft' },
  { id: 'none', label: 'Nincs / Egyéb' },
];

const GOAL_PRESETS = [
  { value: 3_000_000, label: '3M Ft' },
  { value: 6_000_000, label: '6M Ft' },
  { value: 10_000_000, label: '10M Ft' },
  { value: 15_000_000, label: '15M Ft' },
  { value: 25_000_000, label: '25M Ft' },
  { value: 50_000_000, label: '50M Ft' },
];

const FEATURES = [
  { icon: BarChart3, label: 'Pénzügyi áttekintés', desc: 'Bevételek, kiadások, profit' },
  { icon: Calendar, label: 'Naptár & időkövetés', desc: 'Pomodoro, órabeosztás' },
  { icon: FolderOpen, label: 'Fájlkezelés', desc: 'Ügyfél- és projektmappák' },
  { icon: FileText, label: 'Számlázás', desc: 'Készítés, nyomonkövetés' },
  { icon: Mic, label: 'Hangfelvétel & AI', desc: 'Átírás, összefoglaló' },
];

export default function Onboarding() {
  const { user, login, register, resetPassword, googleLogin, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();

  // If user is logged in but hasn't completed onboarding, start at setup steps
  const [step, setStep] = useState<Step>(user ? 'platform' : 'auth');
  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('none');
  const [revenueGoal, setRevenueGoal] = useState(10_000_000);

  const animateStep = (next: Step) => {
    setTransitioning(true);
    setTimeout(() => {
      setStep(next);
      setTransitioning(false);
    }, 150);
  };

  const handleAuth = async () => {
    setError('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      if (authMode === 'reset') {
        if (!email.trim()) {
          setError('Add meg az email címed');
          setSubmitting(false);
          return;
        }
        await resetPassword(email);
        setSuccessMsg('Jelszó-visszaállító email elküldve! Ellenőrizd a postaládád.');
        setSubmitting(false);
        return;
      }
      if (authMode === 'login') {
        await login(email, password);
      } else {
        if (!name.trim()) {
          setError('Név megadása kötelező');
          setSubmitting(false);
          return;
        }
        if (password.length < 6) {
          setError('A jelszónak legalább 6 karakter hosszúnak kell lennie');
          setSubmitting(false);
          return;
        }
        await register({ name, email, password });
      }
      // auth success → move to setup steps
      setSubmitting(false);
      animateStep('platform');
    } catch {
      setError(
        authMode === 'login'
          ? 'Hibás email vagy jelszó'
          : authMode === 'register'
            ? 'A regisztráció sikertelen. Lehet, hogy ez az email már foglalt.'
            : 'Hiba történt. Próbáld újra.'
      );
      setSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      await googleLogin();
      setSubmitting(false);
      animateStep('platform');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google bejelentkezés sikertelen';
      if (msg !== 'Google bejelentkezés megszakítva') {
        setError(msg);
      }
      setSubmitting(false);
    }
  };

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      await updateUser({
        invoice_platform: platform,
        revenue_goal_yearly: revenueGoal,
        onboarding_complete: 1,
      });
    } catch { /* continue anyway */ }
    setSubmitting(false);
    animateStep('done');
  };

  const formatGoal = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M Ft`;
    return `${(v / 1000).toFixed(0)}e Ft`;
  };

  // Steps that show in step dots (only setup steps, not auth or done)
  const setupSteps: Step[] = ['platform', 'goal', 'theme'];

  const stepContent: Record<Step, React.ReactNode> = {
    // ─── STEP 1: AUTH ───
    auth: (
      <div className="space-y-6">
        <div className="text-center space-y-1">
          <h1 className="font-pixel text-2xl text-cream tracking-wide">KLIENT</h1>
          <p className="text-steel text-sm">Projektkezelés, egyszerűen.</p>
        </div>

        <div className="grid grid-cols-2 gap-2 py-2">
          {FEATURES.slice(0, 4).map(f => (
            <div key={f.label} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-surface-800/30 border border-teal/5">
              <f.icon width={14} height={14} className="text-teal shrink-0" />
              <span className="text-[11px] text-steel leading-tight">{f.label}</span>
            </div>
          ))}
        </div>

        {authMode !== 'reset' && (
          <div className="flex bg-surface-800/50 rounded-lg p-1 border border-teal/10">
            <button
              onClick={() => { setAuthMode('login'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                authMode === 'login' ? 'bg-teal/20 text-cream' : 'text-steel hover:text-ash'
              }`}
            >
              Belépés
            </button>
            <button
              onClick={() => { setAuthMode('register'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                authMode === 'register' ? 'bg-teal/20 text-cream' : 'text-steel hover:text-ash'
              }`}
            >
              Regisztráció
            </button>
          </div>
        )}

        {authMode === 'reset' && (
          <div className="text-center">
            <p className="text-steel text-sm">Jelszó visszaállítása</p>
          </div>
        )}

        <div className="space-y-3">
          {authMode === 'register' && (
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Teljes neved"
              className="w-full px-3 py-2.5 bg-surface-800 border border-teal/15 rounded-lg text-sm text-cream placeholder:text-steel/50 focus:outline-none focus:border-teal/40"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email cím"
            className="w-full px-3 py-2.5 bg-surface-800 border border-teal/15 rounded-lg text-sm text-cream placeholder:text-steel/50 focus:outline-none focus:border-teal/40"
          />
          {authMode !== 'reset' && (
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Jelszó"
              className="w-full px-3 py-2.5 bg-surface-800 border border-teal/15 rounded-lg text-sm text-cream placeholder:text-steel/50 focus:outline-none focus:border-teal/40"
            />
          )}
        </div>

        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        {successMsg && <p className="text-emerald-400 text-xs text-center">{successMsg}</p>}

        <button
          onClick={authMode === 'reset' ? handleAuth : handleAuth}
          disabled={submitting || !email || (authMode !== 'reset' && !password)}
          className="w-full py-3 bg-teal text-cream text-sm font-medium rounded-lg hover:bg-teal/80 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          {submitting ? (
            <Loader2 width={16} height={16} className="animate-spin" />
          ) : authMode === 'login' ? (
            <>Belépés <ArrowRight width={16} height={16} /></>
          ) : authMode === 'register' ? (
            <>Regisztráció <ArrowRight width={16} height={16} /></>
          ) : (
            'Email küldése'
          )}
        </button>

        {authMode === 'login' && (
          <button
            onClick={() => { setAuthMode('reset'); setError(''); setSuccessMsg(''); }}
            className="w-full text-[11px] text-steel/60 hover:text-steel transition-colors cursor-pointer"
          >
            Elfelejtetted a jelszavad?
          </button>
        )}
        {authMode === 'reset' && (
          <button
            onClick={() => { setAuthMode('login'); setError(''); setSuccessMsg(''); }}
            className="w-full text-[11px] text-steel/60 hover:text-steel transition-colors cursor-pointer"
          >
            Vissza a belépéshez
          </button>
        )}

        {authMode !== 'reset' && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-teal/10" />
              <span className="text-[11px] text-steel/50 uppercase tracking-wider">vagy</span>
              <div className="flex-1 h-px bg-teal/10" />
            </div>

            <button
              onClick={handleGoogleAuth}
              disabled={submitting}
              className="w-full py-2.5 bg-surface-800 border border-teal/15 text-cream text-sm font-medium rounded-lg hover:bg-surface-800/80 hover:border-teal/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Folytatás Google fiókkal
            </button>
          </>
        )}
      </div>
    ),

    // ─── STEP 2: PLATFORM ───
    platform: (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-teal/15 border border-teal/20 flex items-center justify-center mx-auto mb-3">
            <Receipt width={20} height={20} className="text-teal" />
          </div>
          <h2 className="font-pixel text-base text-cream">Számlázás</h2>
          <p className="text-steel text-sm mt-1.5">Melyik platformot használod a számlázáshoz?</p>
        </div>

        <div className="space-y-2">
          {INVOICE_PLATFORMS.map(p => (
            <button
              key={p.id}
              onClick={() => setPlatform(p.id)}
              className={`w-full px-4 py-3 rounded-lg border text-sm text-left font-medium transition-colors ${
                platform === p.id
                  ? 'border-teal bg-teal/15 text-cream'
                  : 'border-teal/10 bg-surface-800/50 text-steel hover:border-teal/25 hover:text-ash'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => animateStep('goal')}
          className="w-full py-2.5 bg-teal text-cream text-sm font-medium rounded-lg hover:bg-teal/80 flex items-center justify-center gap-2 transition-colors"
        >
          Tovább
          <ArrowRight width={16} height={16} />
        </button>
      </div>
    ),

    // ─── STEP 3: REVENUE GOAL ───
    goal: (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-teal/15 border border-teal/20 flex items-center justify-center mx-auto mb-3">
            <Target width={20} height={20} className="text-teal" />
          </div>
          <h2 className="font-pixel text-base text-cream">Bevételi cél</h2>
          <p className="text-steel text-sm mt-1.5">Mekkora éves bevételt szeretnél elérni?</p>
        </div>

        <div className="text-center">
          <div className="text-3xl font-bold text-cream tabular-nums">
            {formatGoal(revenueGoal)}
          </div>
          <p className="text-steel/60 text-xs mt-1">
            ~{formatGoal(Math.round(revenueGoal / 12))}/hó
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {GOAL_PRESETS.map(g => (
            <button
              key={g.value}
              onClick={() => setRevenueGoal(g.value)}
              className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors ${
                revenueGoal === g.value
                  ? 'border-teal bg-teal/15 text-cream'
                  : 'border-teal/10 bg-surface-800/50 text-steel hover:border-teal/25 hover:text-ash'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <input
          type="range"
          min={1_000_000}
          max={100_000_000}
          step={500_000}
          value={revenueGoal}
          onChange={e => setRevenueGoal(Number(e.target.value))}
          className="w-full appearance-none h-2 rounded-full bg-steel/20 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-teal [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(18,69,89,0.5)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
        />

        <div className="flex gap-3">
          <button
            onClick={() => animateStep('platform')}
            className="px-4 py-2.5 text-sm text-steel hover:text-cream transition-colors"
          >
            <ArrowLeft width={16} height={16} />
          </button>
          <button
            onClick={() => animateStep('theme')}
            className="flex-1 py-2.5 bg-teal text-cream text-sm font-medium rounded-lg hover:bg-teal/80 flex items-center justify-center gap-2 transition-colors"
          >
            Tovább
            <ArrowRight width={16} height={16} />
          </button>
        </div>
      </div>
    ),

    // ─── STEP 4: THEME ───
    theme: (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-teal/15 border border-teal/20 flex items-center justify-center mx-auto mb-3">
            <Palette width={20} height={20} className="text-teal" />
          </div>
          <h2 className="font-pixel text-base text-cream">Megjelenés</h2>
          <p className="text-steel text-sm mt-1.5">Válaszd ki a kedvenc témádat</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'dark' as const, name: 'Sötét', bg: '#01161E', sidebar: '#010E13', card: '#0C2230', accent: '#124559' },
            { id: 'light' as const, name: 'Beige', bg: '#E4EFD4', sidebar: '#DCEACC', card: '#FFFFFF', accent: '#124559' },
            { id: 'teal-ocean' as const, name: 'Ocean', bg: '#0D3545', sidebar: '#0B2D3E', card: '#1A4D63', accent: '#598392' },
            { id: 'ash-soft' as const, name: 'Ash', bg: '#9EB8A0', sidebar: '#B2C8B4', card: '#D4E0D5', accent: '#124559' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`p-3 rounded-lg border-2 transition-colors ${
                theme === t.id ? 'border-teal bg-teal/10' : 'border-teal/10 hover:border-teal/30'
              }`}
            >
              <div className="w-full h-10 rounded-md border border-black/10 mb-1.5 flex overflow-hidden" style={{ backgroundColor: t.bg }}>
                <div className="w-4 h-full" style={{ backgroundColor: t.sidebar }} />
                <div className="flex-1 p-1 flex flex-col gap-0.5">
                  <div className="w-full h-1 rounded-sm" style={{ backgroundColor: t.card }} />
                  <div className="flex gap-0.5 flex-1">
                    <div className="flex-1 rounded-sm" style={{ backgroundColor: t.card }} />
                    <div className="flex-1 rounded-sm" style={{ backgroundColor: t.card }} />
                  </div>
                </div>
              </div>
              <p className="text-xs font-medium text-cream">{t.name}</p>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => animateStep('goal')}
            className="px-4 py-2.5 text-sm text-steel hover:text-cream transition-colors"
          >
            <ArrowLeft width={16} height={16} />
          </button>
          <button
            onClick={handleFinish}
            disabled={submitting}
            className="flex-1 py-2.5 bg-teal text-cream text-sm font-medium rounded-lg hover:bg-teal/80 disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
          >
            {submitting ? (
              <Loader2 width={16} height={16} className="animate-spin" />
            ) : (
              <>Indítás <Check width={16} height={16} /></>
            )}
          </button>
        </div>
      </div>
    ),

    // ─── STEP 5: DONE ───
    done: (
      <div className="text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-teal/20 border border-teal/30 flex items-center justify-center mx-auto">
          <Check width={32} height={32} className="text-ash" />
        </div>
        <div>
          <h2 className="font-pixel text-base text-cream">Minden kész!</h2>
          <p className="text-steel text-sm mt-2">
            {user?.name ? `Üdvözlünk, ${user.name.split(' ')[0]}!` : 'Üdvözlünk!'} Indulhat a munka.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-1.5 text-left">
          {FEATURES.map(f => (
            <div key={f.label} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-800/30 border border-teal/5">
              <f.icon width={15} height={15} className="text-teal shrink-0" />
              <div>
                <p className="text-xs font-medium text-cream">{f.label}</p>
                <p className="text-[10px] text-steel/70">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  };

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center p-4">
      <div
        className={`w-full max-w-sm transition-all duration-150 ease-out ${
          transitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
        }`}
        style={{ animation: 'modal-in 0.2s ease-out' }}
      >
        <div className="bg-surface-800/50 rounded-xl border border-teal/10 p-8">
          {stepContent[step]}
        </div>

        {/* Step dots — only for setup steps */}
        {setupSteps.includes(step) && (
          <div className="flex justify-center gap-2 mt-6">
            {setupSteps.map(s => (
              <div
                key={s}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  step === s ? 'bg-teal' : 'bg-surface-700'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
