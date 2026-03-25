import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { ArrowRight, ArrowLeft, Check, Loader2, Receipt, Target, Palette, BarChart3, Calendar, FolderOpen, FileText, Mic, Eye, EyeOff, Mail, RefreshCw } from 'lucide-react';

type Step = 'auth' | 'confirm-email' | 'platform' | 'goal' | 'theme' | 'done';
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

const getPasswordStrength = (pwd: string) => {
  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  if (score <= 2) return { score: 1, label: 'Gyenge', color: 'bg-red-500' };
  if (score <= 3) return { score: 2, label: 'Közepes', color: 'bg-orange-400' };
  if (score <= 4) return { score: 3, label: 'Jó', color: 'bg-yellow-400' };
  return { score: 4, label: 'Erős', color: 'bg-emerald-400' };
};

export default function Onboarding() {
  const { user, login, register, resetPassword, googleLogin, updateUser, checkEmailConfirmed } = useAuth();
  const { theme, setTheme } = useTheme();

  // If user is logged in but hasn't completed onboarding, start at setup steps
  const [step, setStep] = useState<Step>(user ? 'platform' : 'auth');
  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('none');
  const [revenueGoal, setRevenueGoal] = useState(10_000_000);

  const strength = getPasswordStrength(password);

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
        if (password !== confirmPassword) {
          setError('A jelszavak nem egyeznek');
          setSubmitting(false);
          return;
        }
        await register({ name, email, password });
        // After register, go to email confirmation step
        setSubmitting(false);
        animateStep('confirm-email');
        return;
      }
      // login success → move to setup steps
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
      <div className="grid grid-cols-5 min-h-[520px]">
        {/* Left brand panel */}
        <div className="col-span-2 bg-gradient-to-b from-teal/20 to-surface-900 rounded-l-xl border-r border-teal/10 p-8 flex flex-col justify-between">
          <div>
            <h1 className="font-pixel text-2xl text-cream tracking-wide">KLIENT</h1>
            <p className="text-steel text-sm mt-2 leading-relaxed">
              A magyar vállalkozók<br />projektkezelő szoftvere.
            </p>
          </div>

          <div className="space-y-3">
            {FEATURES.map(f => (
              <div key={f.label} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal/10 border border-teal/15 flex items-center justify-center shrink-0 mt-0.5">
                  <f.icon width={14} height={14} className="text-teal" />
                </div>
                <div>
                  <p className="text-xs font-medium text-cream">{f.label}</p>
                  <p className="text-[11px] text-steel/70 leading-snug">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-steel/40">© 2025 Klient</p>
        </div>

        {/* Right form panel */}
        <div className="col-span-3 p-8 flex flex-col justify-center">
          <div className="space-y-5">
            {authMode !== 'reset' ? (
              <>
                <div>
                  <h2 className="text-lg font-semibold text-cream">
                    {authMode === 'login' ? 'Üdvözlünk!' : 'Fiók létrehozása'}
                  </h2>
                  <p className="text-steel text-sm mt-1">
                    {authMode === 'login' ? 'Jelentkezz be a fiókodba' : 'Kezdd el a projekted kezelését'}
                  </p>
                </div>

                <div className="flex bg-surface-800/60 rounded-lg p-0.5 border border-teal/10">
                  <button
                    onClick={() => { setAuthMode('login'); setError(''); setSuccessMsg(''); setConfirmPassword(''); }}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                      authMode === 'login' ? 'bg-teal text-cream shadow-sm' : 'text-steel hover:text-ash'
                    }`}
                  >
                    Belépés
                  </button>
                  <button
                    onClick={() => { setAuthMode('register'); setError(''); setSuccessMsg(''); }}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                      authMode === 'register' ? 'bg-teal text-cream shadow-sm' : 'text-steel hover:text-ash'
                    }`}
                  >
                    Regisztráció
                  </button>
                </div>
              </>
            ) : (
              <div>
                <h2 className="text-lg font-semibold text-cream">Jelszó visszaállítása</h2>
                <p className="text-steel text-sm mt-1">Küldünk egy visszaállító emailt</p>
              </div>
            )}

            <div className="space-y-4">
              {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-steel mb-1.5">Teljes név</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Kovács János"
                    className="w-full px-3.5 py-2.5 bg-surface-800 border border-teal/15 rounded-lg text-sm text-cream placeholder:text-steel/40 focus:outline-none focus:border-teal/50 focus:ring-1 focus:ring-teal/20"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-steel mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-3.5 py-2.5 bg-surface-800 border border-teal/15 rounded-lg text-sm text-cream placeholder:text-steel/40 focus:outline-none focus:border-teal/50 focus:ring-1 focus:ring-teal/20"
                />
              </div>

              {authMode !== 'reset' && (
                <div>
                  <label className="block text-xs font-medium text-steel mb-1.5">Jelszó</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 pr-10 bg-surface-800 border border-teal/15 rounded-lg text-sm text-cream placeholder:text-steel/40 focus:outline-none focus:border-teal/50 focus:ring-1 focus:ring-teal/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-steel/50 hover:text-steel transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff width={16} height={16} /> : <Eye width={16} height={16} />}
                    </button>
                  </div>

                  {/* Password strength meter — register only */}
                  {authMode === 'register' && password.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map(i => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                              i <= strength.score ? strength.color : 'bg-surface-700'
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-[11px] ${
                        strength.score <= 1 ? 'text-red-400' :
                        strength.score <= 2 ? 'text-orange-400' :
                        strength.score <= 3 ? 'text-yellow-400' :
                        'text-emerald-400'
                      }`}>
                        Jelszó erőssége: {strength.label}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Confirm password — register only */}
              {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-steel mb-1.5">Jelszó megerősítése</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full px-3.5 py-2.5 pr-10 bg-surface-800 border rounded-lg text-sm text-cream placeholder:text-steel/40 focus:outline-none focus:ring-1 ${
                        confirmPassword && confirmPassword !== password
                          ? 'border-red-500/50 focus:border-red-500/70 focus:ring-red-500/20'
                          : confirmPassword && confirmPassword === password
                            ? 'border-emerald-500/50 focus:border-emerald-500/70 focus:ring-emerald-500/20'
                            : 'border-teal/15 focus:border-teal/50 focus:ring-teal/20'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-steel/50 hover:text-steel transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff width={16} height={16} /> : <Eye width={16} height={16} />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== password && (
                    <p className="text-[11px] text-red-400 mt-1">A jelszavak nem egyeznek</p>
                  )}
                  {confirmPassword && confirmPassword === password && (
                    <p className="text-[11px] text-emerald-400 mt-1">A jelszavak egyeznek ✓</p>
                  )}
                </div>
              )}
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}
            {successMsg && <p className="text-emerald-400 text-xs">{successMsg}</p>}

            <button
              onClick={handleAuth}
              disabled={submitting || !email || (authMode !== 'reset' && !password) || (authMode === 'register' && !confirmPassword)}
              className="w-full py-3 bg-teal text-cream text-sm font-semibold rounded-lg hover:bg-teal/80 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              {submitting ? (
                <Loader2 width={16} height={16} className="animate-spin" />
              ) : authMode === 'login' ? (
                <>Belépés <ArrowRight width={16} height={16} /></>
              ) : authMode === 'register' ? (
                <>Fiók létrehozása <ArrowRight width={16} height={16} /></>
              ) : (
                'Email küldése'
              )}
            </button>

            {authMode === 'login' && (
              <button
                onClick={() => { setAuthMode('reset'); setError(''); setSuccessMsg(''); }}
                className="w-full text-xs text-steel/60 hover:text-steel transition-colors cursor-pointer"
              >
                Elfelejtetted a jelszavad?
              </button>
            )}
            {authMode === 'reset' && (
              <button
                onClick={() => { setAuthMode('login'); setError(''); setSuccessMsg(''); }}
                className="w-full text-xs text-steel/60 hover:text-steel transition-colors cursor-pointer"
              >
                ← Vissza a belépéshez
              </button>
            )}

            {authMode !== 'reset' && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-teal/10" />
                  <span className="text-[11px] text-steel/40 uppercase tracking-wider">vagy</span>
                  <div className="flex-1 h-px bg-teal/10" />
                </div>

                <button
                  onClick={handleGoogleAuth}
                  disabled={submitting}
                  className="w-full py-2.5 bg-surface-800 border border-teal/15 text-cream text-sm font-medium rounded-lg hover:bg-surface-800/80 hover:border-teal/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
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
        </div>
      </div>
    ),

    // ─── STEP 1.5: EMAIL CONFIRMATION ───
    'confirm-email': (
      <div className="space-y-6 text-center">
        <div className="w-14 h-14 rounded-full bg-teal/15 border border-teal/20 flex items-center justify-center mx-auto">
          <Mail width={28} height={28} className="text-teal" />
        </div>
        <div>
          <h2 className="font-pixel text-base text-cream">Nézd meg a postaládádat</h2>
          <p className="text-steel text-sm mt-2 leading-relaxed">
            Küldtünk egy megerősítő emailt a(z)<br />
            <span className="text-cream font-medium">{email}</span> címre.
          </p>
          <p className="text-steel/60 text-xs mt-3">
            Kattints az emailben található linkre, majd nyomd meg az alábbi gombot.
          </p>
        </div>

        <button
          onClick={async () => {
            setEmailCheckLoading(true);
            setError('');
            try {
              const confirmed = await checkEmailConfirmed(email, password);
              if (confirmed) {
                animateStep('platform');
              } else {
                setError('Az email cím még nincs megerősítve. Ellenőrizd a postaládád!');
              }
            } catch {
              setError('Hiba történt az ellenőrzés során.');
            }
            setEmailCheckLoading(false);
          }}
          disabled={emailCheckLoading}
          className="w-full py-3 bg-teal text-cream text-sm font-semibold rounded-lg hover:bg-teal/80 disabled:opacity-40 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          {emailCheckLoading ? (
            <Loader2 width={16} height={16} className="animate-spin" />
          ) : (
            <>
              <RefreshCw width={16} height={16} />
              Megerősítettem, tovább!
            </>
          )}
        </button>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <p className="text-[11px] text-steel/40">
          Nem kaptad meg? Nézd meg a spam mappát is.
        </p>
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
        className={`w-full transition-all duration-150 ease-out ${
          step === 'auth' ? 'max-w-2xl' : 'max-w-sm'
        } ${transitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}
        style={{ animation: 'modal-in 0.2s ease-out' }}
      >
        <div className={`bg-surface-800/50 rounded-xl border border-teal/10 ${step === 'auth' ? 'p-0 overflow-hidden' : 'p-8'}`}>
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
