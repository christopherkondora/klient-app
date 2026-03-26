import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import Paywall from '../components/Paywall';
import { Crown, Check, Zap, User, Palette, SlidersHorizontal, Info, LogOut, KeyRound, Eye, EyeOff, XCircle, RotateCcw, CreditCard, X, Loader2 } from 'lucide-react';
import { version } from '../../package.json';

const INVOICE_PLATFORMS = [
  { id: 'szamlazz', label: 'Számlázz.hu' },
  { id: 'billingo', label: 'Billingo' },
  { id: 'nav', label: 'NAV Online Számla' },
  { id: 'kulcs', label: 'Kulcs-Soft' },
  { id: 'none', label: 'Nincs / Egyéb' },
];

const PLANS = [
  {
    id: 'monthly' as const,
    name: 'Havi',
    price: '3 990 Ft',
    period: '/hó',
  },
  {
    id: 'yearly' as const,
    name: 'Éves',
    price: '39 900 Ft',
    period: '/év',
    badge: '2 hónap ingyen',
  },
  {
    id: 'lifetime' as const,
    name: 'Lifetime',
    price: '119 900 Ft',
    period: ' egyszeri',
  },
];

type Tab = 'fiok' | 'elofizetes' | 'megjelenes' | 'altalanos' | 'alkalmazas';

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: 'fiok', label: 'Fiók', icon: User },
  { id: 'elofizetes', label: 'Előfizetés', icon: Crown },
  { id: 'megjelenes', label: 'Megjelenés', icon: Palette },
  { id: 'altalanos', label: 'Általános', icon: SlidersHorizontal },
  { id: 'alkalmazas', label: 'Alkalmazás', icon: Info },
];

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { user, updateUser, logout, changePassword } = useAuth();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showPwForm, setShowPwForm] = useState(false);

  const handleChangePassword = async () => {
    setPwError('');
    setPwSuccess('');
    if (newPw.length < 6) { setPwError('Az új jelszónak legalább 6 karakter hosszúnak kell lennie'); return; }
    if (newPw !== confirmPw) { setPwError('A két jelszó nem egyezik'); return; }
    setPwLoading(true);
    try {
      await changePassword(currentPw, newPw);
      setPwSuccess('Jelszó sikeresen megváltoztatva!');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => { setPwSuccess(''); setShowPwForm(false); }, 2000);
    } catch (err: any) {
      setPwError(err.message || 'Hiba történt');
    } finally {
      setPwLoading(false);
    }
  };
  const { subscription, refresh, cancelSubscription, reactivateSubscription, openCheckout } = useSubscription();
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [webviewLoading, setWebviewLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('fiok');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [subActionError, setSubActionError] = useState('');

  const currentPlan = subscription?.plan || 'trial';
  const isTrial = subscription?.status === 'trial';
  const isPaid = subscription?.status === 'active' && currentPlan !== 'trial';
  const isCancelled = subscription?.status === 'cancelled';

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    setSubActionError('');
    try {
      await cancelSubscription();
      setShowCancelConfirm(false);
    } catch (err: any) {
      setSubActionError(err.message || 'Hiba történt a lemondás során');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleReactivate = async () => {
    setReactivateLoading(true);
    setSubActionError('');
    try {
      await reactivateSubscription();
    } catch (err: any) {
      setSubActionError(err.message || 'Hiba történt az újraaktiválás során');
    } finally {
      setReactivateLoading(false);
    }
  };

  const handleUpgrade = async (plan: 'monthly' | 'yearly' | 'lifetime') => {
    if (plan === currentPlan) return;
    if (isPaid || isCancelled) {
      // Already has subscription — open checkout directly for the new plan
      setCheckoutLoading(plan);
      setSubActionError('');
      try {
        const url = await openCheckout(plan);
        setCheckoutUrl(url);
      } catch (err: any) {
        setSubActionError(err.message || 'Nem sikerült megnyitni a fizetési oldalt');
      } finally {
        setCheckoutLoading(null);
      }
    } else {
      // Trial/expired — show Paywall
      setShowCheckout(true);
    }
  };

  const planLabel = (plan: string) => {
    switch (plan) {
      case 'monthly': return 'Havi';
      case 'yearly': return 'Éves';
      case 'lifetime': return 'Lifetime';
      case 'trial': return 'Próbaidőszak';
      default: return plan;
    }
  };

  if (showCheckout) {
    return <Paywall overlay onClose={() => { setShowCheckout(false); refresh(); }} />;
  }

  return (
    <div className="max-w-4xl mx-auto flex gap-6 h-full">
      {/* Tab navigation */}
      <nav className="w-48 shrink-0 py-2">
        <h1 className="font-pixel text-lg text-cream px-3 mb-6">Beállítások</h1>
        <div className="space-y-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all relative ${
                  isActive
                    ? 'bg-teal/15 text-cream before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-teal'
                    : 'text-steel hover:bg-teal/5 hover:text-ash'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Tab content */}
      <div className="flex-1 overflow-auto py-2 pr-1">
        {/* ── Fiók ── */}
        {activeTab === 'fiok' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-pixel text-[15px] text-cream">Fiók</h2>
              <p className="text-xs text-steel mt-1">Fiókbeállítások és bejelentkezési adatok</p>
            </div>

            <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6 space-y-5">
              {user && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-steel mb-1.5">E-mail cím</label>
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-800 border border-teal/10">
                      <span className="text-sm text-cream">{user.email}</span>
                    </div>
                  </div>

                  {/* Password change */}
                  <div className="pt-3 border-t border-teal/10">
                    {!showPwForm ? (
                      <button
                        onClick={() => setShowPwForm(true)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-cream border border-teal/20 rounded-lg hover:bg-teal/10 transition-colors"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        Jelszó megváltoztatása
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-ash">Jelszó megváltoztatása</h3>

                        <div>
                          <label className="block text-xs font-medium text-steel mb-1.5">Jelenlegi jelszó</label>
                          <div className="relative">
                            <input
                              type={showCurrentPw ? 'text' : 'password'}
                              value={currentPw}
                              onChange={e => setCurrentPw(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-teal/10 text-sm text-cream focus:outline-none focus:border-teal/40 pr-10"
                              placeholder="••••••••"
                            />
                            <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-steel hover:text-ash">
                              {showCurrentPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-steel mb-1.5">Új jelszó</label>
                          <div className="relative">
                            <input
                              type={showNewPw ? 'text' : 'password'}
                              value={newPw}
                              onChange={e => setNewPw(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-teal/10 text-sm text-cream focus:outline-none focus:border-teal/40 pr-10"
                              placeholder="Legalább 6 karakter"
                            />
                            <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-steel hover:text-ash">
                              {showNewPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-steel mb-1.5">Új jelszó megerősítése</label>
                          <input
                            type="password"
                            value={confirmPw}
                            onChange={e => setConfirmPw(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-teal/10 text-sm text-cream focus:outline-none focus:border-teal/40"
                            placeholder="••••••••"
                          />
                        </div>

                        {pwError && <p className="text-xs text-red-400">{pwError}</p>}
                        {pwSuccess && <p className="text-xs text-emerald-400">{pwSuccess}</p>}

                        <div className="flex gap-2">
                          <button
                            onClick={handleChangePassword}
                            disabled={pwLoading || !currentPw || !newPw || !confirmPw}
                            className="px-4 py-2 text-sm font-medium bg-teal text-ink rounded-lg hover:bg-teal/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {pwLoading ? 'Mentés...' : 'Jelszó mentése'}
                          </button>
                          <button
                            onClick={() => { setShowPwForm(false); setCurrentPw(''); setNewPw(''); setConfirmPw(''); setPwError(''); }}
                            className="px-4 py-2 text-sm text-steel hover:text-ash transition-colors"
                          >
                            Mégse
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Logout */}
                  <div className="pt-3 border-t border-teal/10">
                    <button
                      onClick={logout}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 border border-red-400/20 rounded-lg hover:bg-red-400/10 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Kijelentkezés
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Előfizetés ── */}
        {activeTab === 'elofizetes' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-pixel text-[15px] text-cream">Előfizetés</h2>
              <p className="text-xs text-steel mt-1">Jelenlegi csomagod és fizetési információk</p>
            </div>

            {/* Current plan indicator */}
            <div className={`px-5 py-4 rounded-lg border ${
              isPaid
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : isCancelled
                  ? 'bg-amber-500/10 border-amber-500/20'
                  : 'bg-teal/5 border-teal/10'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-steel">Jelenlegi csomag</p>
                  <p className={`text-sm font-semibold mt-0.5 ${
                    isPaid ? 'text-emerald-400' : isCancelled ? 'text-amber-400' : 'text-cream'
                  }`}>
                    {planLabel(currentPlan)}
                    {isPaid && <span className="ml-2 text-[10px] font-normal text-emerald-400/70">Aktív ✓</span>}
                    {isCancelled && <span className="ml-2 text-[10px] font-normal text-amber-400/70">Lemondva</span>}
                    {isTrial && <span className="ml-2 text-[10px] font-normal text-steel">14 napos ingyenes</span>}
                  </p>
                </div>
                {(isPaid || isCancelled) && subscription?.current_period_end && currentPlan !== 'lifetime' && (
                  <div className="text-right">
                    <p className="text-[10px] text-steel">{isCancelled ? 'Hozzáférés eddig' : 'Következő számlázás'}</p>
                    <p className="text-xs text-cream">{new Date(subscription.current_period_end).toLocaleDateString('hu-HU')}</p>
                  </div>
                )}
                {isPaid && currentPlan === 'lifetime' && (
                  <div className="text-right">
                    <p className="text-[10px] text-emerald-400/70">Örökös hozzáférés</p>
                  </div>
                )}
              </div>

              {/* Cancelled info banner */}
              {isCancelled && subscription?.current_period_end && (
                <div className="mt-3 pt-3 border-t border-amber-500/20 flex items-center justify-between">
                  <p className="text-xs text-amber-400/80">
                    Az előfizetésed le lett mondva. Hozzáférésed a jelenlegi időszak végéig ({new Date(subscription.current_period_end).toLocaleDateString('hu-HU')}) aktív marad.
                  </p>
                  <button
                    onClick={handleReactivate}
                    disabled={reactivateLoading}
                    className="ml-4 shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors disabled:opacity-40"
                  >
                    <RotateCcw className="w-3 h-3" />
                    {reactivateLoading ? 'Visszaállítás...' : 'Visszaállítás'}
                  </button>
                </div>
              )}
            </div>

            {subActionError && (
              <p className="text-xs text-red-400 px-1">{subActionError}</p>
            )}

            {/* Plan cards */}
            {currentPlan !== 'lifetime' && (
              <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6">
                <p className="text-xs text-steel mb-4">{isPaid || isCancelled ? 'Csomag váltás' : 'Válassz csomagot'}</p>
                <div className="grid grid-cols-3 gap-3">
                  {PLANS.map((plan) => {
                    const isCurrentPlan = plan.id === currentPlan && !isCancelled;
                    return (
                      <div
                        key={plan.id}
                        className={`relative rounded-xl p-4 border transition-all ${
                          isCurrentPlan
                            ? 'border-teal bg-teal/10'
                            : 'border-steel/15 hover:border-steel/30'
                        }`}
                      >
                        {plan.badge && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-teal text-ink text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                            {plan.badge}
                          </span>
                        )}
                        <p className="text-sm font-semibold text-cream">{plan.name}</p>
                        <p className="text-lg font-bold text-cream mt-1">{plan.price}</p>
                        <p className="text-[10px] text-steel">{plan.period}</p>
                        {isCurrentPlan ? (
                          <div className="mt-3 py-1.5 rounded-lg bg-teal/15 text-center">
                            <span className="text-[11px] font-medium text-teal flex items-center justify-center gap-1">
                              <Check className="w-3 h-3" /> Aktív
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleUpgrade(plan.id)}
                            disabled={!!checkoutLoading}
                            className="mt-3 w-full py-1.5 rounded-lg bg-steel/15 hover:bg-steel/25 text-xs font-medium text-cream transition-colors flex items-center justify-center gap-1 disabled:opacity-40"
                          >
                            {checkoutLoading === plan.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Zap className="w-3 h-3" />
                            )}
                            {isPaid || isCancelled ? 'Váltás' : 'Előfizetés'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cancel subscription */}
            {isPaid && currentPlan !== 'lifetime' && (
              <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6">
                {!showCancelConfirm ? (
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="flex items-center gap-2 text-xs text-steel hover:text-red-400 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Előfizetés lemondása
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-red-400">Biztosan lemondod az előfizetésed?</p>
                    <p className="text-xs text-steel">
                      A jelenlegi számlázási időszak végéig ({subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('hu-HU') : '—'}) továbbra is hozzáférsz minden funkcióhoz. Ezután az előfizetés lejár.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancelSubscription}
                        disabled={cancelLoading}
                        className="px-4 py-2 text-sm font-medium bg-red-500/15 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/25 transition-colors disabled:opacity-40"
                      >
                        {cancelLoading ? 'Lemondás...' : 'Igen, lemondom'}
                      </button>
                      <button
                        onClick={() => { setShowCancelConfirm(false); setSubActionError(''); }}
                        className="px-4 py-2 text-sm text-steel hover:text-ash transition-colors"
                      >
                        Mégse
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Megjelenés ── */}
        {activeTab === 'megjelenes' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-pixel text-[15px] text-cream">Megjelenés</h2>
              <p className="text-xs text-steel mt-1">Téma és vizuális beállítások</p>
            </div>

            <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6">
              <label className="block text-xs font-medium text-steel mb-3">Téma</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'dark' as const, name: 'Sötét', desc: 'Alapértelmezett', bg: '#01161E', sidebar: '#010E13', card: '#0C2230', text: '#EFF6E0', accent: '#124559', steel: '#598392' },
                  { id: 'light' as const, name: 'Light — Beige', desc: 'Nappali', bg: '#E4EFD4', sidebar: '#DCEACC', card: '#FFFFFF', text: '#01161E', accent: '#124559', steel: '#598392' },
                  { id: 'teal-ocean' as const, name: 'Teal — Ocean', desc: 'Egyedi', bg: '#0D3545', sidebar: '#0B2D3E', card: '#1A4D63', text: '#EFF6E0', accent: '#598392', steel: '#7FA0AD' },
                  { id: 'ash-soft' as const, name: 'Ash — Soft', desc: 'Természetes', bg: '#9EB8A0', sidebar: '#B2C8B4', card: '#D4E0D5', text: '#01161E', accent: '#124559', steel: '#598392' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      theme === t.id
                        ? 'border-teal bg-teal/10'
                        : 'border-teal/10 hover:border-teal/30'
                    }`}
                  >
                    <div className="w-full h-14 rounded-md border border-black/10 mb-2 flex overflow-hidden" style={{ backgroundColor: t.bg }}>
                      <div className="w-5 h-full flex flex-col gap-0.5 p-1 justify-center" style={{ backgroundColor: t.sidebar }}>
                        <div className="w-full h-1 rounded-sm" style={{ backgroundColor: t.accent }} />
                        <div className="w-full h-1 rounded-sm" style={{ backgroundColor: t.accent }} />
                        <div className="w-full h-1 rounded-sm" style={{ backgroundColor: t.accent }} />
                      </div>
                      <div className="flex-1 p-1.5 flex flex-col gap-1">
                        <div className="w-full h-2 rounded-sm" style={{ backgroundColor: t.card }} />
                        <div className="flex gap-1">
                          <div className="flex-1 h-4 rounded-sm" style={{ backgroundColor: t.card }} />
                          <div className="flex-1 h-4 rounded-sm" style={{ backgroundColor: t.card }} />
                          <div className="flex-1 h-4 rounded-sm" style={{ backgroundColor: t.card }} />
                        </div>
                        <div className="w-full flex-1 rounded-sm" style={{ backgroundColor: t.card }} />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-cream">{t.name}</p>
                    <p className="text-[10px] text-steel">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Általános ── */}
        {activeTab === 'altalanos' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-pixel text-[15px] text-cream">Általános</h2>
              <p className="text-xs text-steel mt-1">Számlázási és alkalmazás beállítások</p>
            </div>

            {/* Invoice Platform */}
            <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6">
              <h3 className="text-sm font-semibold text-ash mb-1">Számlázási platform</h3>
              <p className="text-[11px] text-steel mb-4">Válaszd ki, melyik rendszert használod a számlázáshoz.</p>
              <div className="flex flex-wrap gap-2">
                {INVOICE_PLATFORMS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => updateUser({ invoice_platform: p.id })}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      user?.invoice_platform === p.id
                        ? 'border-teal bg-teal/15 text-cream'
                        : 'border-teal/10 text-steel hover:border-teal/25 hover:text-ash'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pomodoro */}
            <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6">
              <h3 className="text-sm font-semibold text-ash mb-1">Pomodoro</h3>
              <p className="text-[11px] text-steel mb-4">Ha bekapcsolod, a befejezett Pomodoro munkamenetek automatikusan rögzülnek a kiválasztott projekt naptári eseményéhez.</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-steel">Projekt követés</span>
                <button
                  onClick={() => updateUser({ pomodoro_project_tracking: user?.pomodoro_project_tracking === 1 ? 0 : 1 })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    user?.pomodoro_project_tracking === 1 ? 'bg-teal' : 'bg-surface-800 border border-teal/20'
                  }`}
                >
                  <span className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full transition-all ${
                    user?.pomodoro_project_tracking === 1
                      ? 'left-5.5 bg-cream'
                      : 'left-0.5 bg-steel/60'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Alkalmazás ── */}
        {activeTab === 'alkalmazas' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-pixel text-[15px] text-cream">Alkalmazás</h2>
              <p className="text-xs text-steel mt-1">Verzió és rendszerinformációk</p>
            </div>

            <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-steel">Verzió</span>
                <span className="text-xs text-cream font-medium">
                  v{version} <span className="text-steel/60 ml-1">BETA</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-steel">Platform</span>
                <span className="text-xs text-cream font-medium">Electron + React</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-steel">Állapot</span>
                <span className="text-xs text-amber-400 font-medium">Béta — fejlesztés alatt</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stripe Checkout webview modal (for plan switching) */}
      {checkoutUrl && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onDoubleClick={() => { setCheckoutUrl(null); refresh(); }}>
          <div className="bg-surface-800 rounded-xl border border-teal/15 shadow-2xl w-[90vw] h-[85vh] flex flex-col overflow-hidden" onDoubleClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-teal/10 shrink-0">
              <div className="flex items-center gap-2">
                <CreditCard width={14} height={14} className="text-steel" />
                <span className="text-sm text-cream font-medium">Fizetés</span>
              </div>
              <button
                onClick={() => { setCheckoutUrl(null); refresh(); }}
                className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream transition-colors"
              >
                <X width={16} height={16} />
              </button>
            </div>
            <div className="flex-1 relative">
              {webviewLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-800 z-10">
                  <Loader2 className="w-8 h-8 text-teal animate-spin mb-3" />
                  <p className="text-steel text-sm">Fizetési oldal betöltése...</p>
                </div>
              )}
              <webview
                src={checkoutUrl}
                partition="persist:checkout"
                className="w-full h-full"
                style={{ width: '100%', height: '100%' }}
                // @ts-expect-error webview events
                onDidFinishLoad={() => setWebviewLoading(false)}
                ref={(el: HTMLWebViewElement | null) => {
                  if (el) {
                    el.addEventListener('did-finish-load', () => setWebviewLoading(false));
                    el.addEventListener('did-fail-load', () => setWebviewLoading(false));
                    el.addEventListener('did-navigate', (e: any) => {
                      if (e.url?.includes('/success')) { setCheckoutUrl(null); refresh(); }
                    });
                    el.addEventListener('will-navigate', (e: any) => {
                      if (e.url?.includes('/success')) { setCheckoutUrl(null); refresh(); }
                    });
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
