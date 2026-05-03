import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import Paywall from '../components/Paywall';
import PageHeader from '../components/PageHeader';
import { Crown, Check, Zap, User, Palette, SlidersHorizontal, Info, LogOut, KeyRound, Eye, EyeOff, XCircle, RotateCcw, CreditCard, X, Loader2, Receipt, CheckCircle, AlertCircle, Link as LinkIcon, Trash2, Megaphone, Calculator, Building2, FileCheck2, Percent, Briefcase, MapPin, Shield, Edit3 } from 'lucide-react';
import { version } from '../../package.json';
import TaxProfileWizard from '../components/TaxProfileWizard';
import { SUBSCRIPTION_PLANS as PLANS } from '../constants/subscriptionPlans';

// Platform selection now handled in the Számlázás tab
// const INVOICE_PLATFORMS = [
//   { id: 'szamlazz', label: 'Számlázz.hu' },
//   { id: 'billingo', label: 'Billingo' },
//   { id: 'nav', label: 'NAV Online Számla' },
//   { id: 'kulcs', label: 'Kulcs-Soft' },
//   { id: 'none', label: 'Nincs / Egyéb' },
// ];

type Tab = 'fiok' | 'elofizetes' | 'megjelenes' | 'szamlazas' | 'adozas' | 'altalanos' | 'alkalmazas' | 'ads';

const ALL_TABS: { id: Tab; label: string; icon: typeof User; businessOnly?: boolean }[] = [
  { id: 'fiok', label: 'Fiók', icon: User },
  { id: 'elofizetes', label: 'Előfizetés', icon: Crown },
  { id: 'ads', label: 'Klient Ads', icon: Megaphone },
  { id: 'megjelenes', label: 'Megjelenés', icon: Palette },
  { id: 'szamlazas', label: 'Számlázás', icon: Receipt, businessOnly: true },
  { id: 'adozas', label: 'Adózás', icon: Calculator, businessOnly: true },
  { id: 'altalanos', label: 'Általános', icon: SlidersHorizontal },
  { id: 'alkalmazas', label: 'Alkalmazás', icon: Info },
];

type BillingPlatform = 'billingo' | 'szamlazz' | 'egyeb' | 'none';
type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'error';

function AdsSubscriptionTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-pixel text-[15px] text-cream">Klient Ads</h2>
        <p className="text-xs text-steel mt-1">Google Ads kampánykezelő és AI elemző modul</p>
      </div>

      {/* Feature highlights (teaser) */}
      <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-teal/10 rounded-xl flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-teal" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-cream">Google Ads Elemző Modul</h3>
            <p className="text-xs text-steel">Valós idejű kampányteljesítmény, AI elemzés, automatikus riasztások</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            'Kampány teljesítmény dashboard',
            'AI-alapú optimalizálási javaslatok',
            'Automatikus anomália detektálás',
            'Részletes kampány elemzés',
            'Költés és ROAS riportok',
            'Egyedi riasztási szabályok',
          ].map(f => (
            <div key={f} className="flex items-center gap-2 text-xs text-steel">
              <Check className="w-3.5 h-3.5 text-teal shrink-0" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Coming soon */}
      <div className="bg-surface-800/30 rounded-lg border border-dashed border-teal/20 p-8 text-center">
        <span className="inline-block text-[10px] tracking-[0.2em] uppercase bg-teal/15 text-teal px-2.5 py-1 rounded-full mb-3">
          Hamarosan
        </span>
        <h3 className="text-sm font-semibold text-cream mb-1.5">A modul fejlesztés alatt áll</h3>
        <p className="text-xs text-steel max-w-md mx-auto leading-relaxed">
          A Klient Ads modul a következő verziókban válik elérhetővé. Addig is a fenti funkciók előre tervezettek — értesítünk, amint élesbe kerül.
        </p>
      </div>
    </div>
  );
}

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
  const [showTaxWizard, setShowTaxWizard] = useState(false);
  const [taxProfile, setTaxProfile] = useState<BusinessProfileRow | null>(null);

  const loadTaxProfile = async () => {
    try {
      const p = await window.electronAPI.getTaxProfile();
      setTaxProfile(p);
    } catch { setTaxProfile(null); }
  };
  useEffect(() => { if (user?.is_business !== 0) loadTaxProfile(); }, [user?.id, user?.is_business]);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [subActionError, setSubActionError] = useState('');

  // Billing config state
  const [billingPlatform, setBillingPlatform] = useState<BillingPlatform>('none');
  const [billingApiKey, setBillingApiKey] = useState('');
  const [billingUrl, setBillingUrl] = useState('');
  const [savedBillingUrl, setSavedBillingUrl] = useState('');
  const [showBillingKey, setShowBillingKey] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [connectionError, setConnectionError] = useState('');
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingLoaded, setBillingLoaded] = useState(false);

  // Load billing config on mount
  useEffect(() => {
    window.electronAPI.getBillingConfig().then(async (cfg) => {
      // If the user profile has a different invoice_platform than the local billing-store,
      // prefer the user profile (source of truth) so that Settings never shows a stale platform
      // from a previous session/user.
      const profilePlatform = (user?.invoice_platform || 'none') as BillingPlatform;
      const validPlatforms: BillingPlatform[] = ['billingo', 'szamlazz', 'egyeb', 'none'];
      const normalizedProfilePlatform: BillingPlatform = validPlatforms.includes(profilePlatform) ? profilePlatform : 'none';

      if (cfg.platform !== normalizedProfilePlatform) {
        try {
          await window.electronAPI.setBillingConfig({ platform: normalizedProfilePlatform });
        } catch { /* ignore */ }
        setBillingPlatform(normalizedProfilePlatform);
        setBillingUrl('');
        setSavedBillingUrl('');
        setBillingApiKey('');
        setConnectionStatus('idle');
      } else {
        setBillingPlatform((cfg.platform as BillingPlatform) || 'none');
        setBillingUrl(cfg.url || '');
        setSavedBillingUrl(cfg.url || '');
        if (cfg.hasApiKey) {
          setBillingApiKey('••••••••••••••••');
          setConnectionStatus('connected');
        }
      }
      setBillingLoaded(true);
    });
  }, [user?.invoice_platform]);

  const handleSaveBillingConfig = async () => {
    setBillingSaving(true);
    try {
      const isPlaceholder = billingApiKey === '••••••••••••••••';
      await window.electronAPI.setBillingConfig({
        platform: billingPlatform,
        apiKey: isPlaceholder ? undefined : billingApiKey || undefined,
        url: billingPlatform === 'egyeb' ? billingUrl : undefined,
      });
      // Keep user profile in sync so onboarding/sidebar reflect the same platform
      if (user?.invoice_platform !== billingPlatform) {
        try { await updateUser({ invoice_platform: billingPlatform }); } catch { /* ignore */ }
      }
      if ((billingPlatform === 'billingo' || billingPlatform === 'szamlazz') && billingApiKey && !isPlaceholder) {
        await handleTestConnection();
      }
      if (billingPlatform === 'egyeb') {
        setSavedBillingUrl(billingUrl);
      }
    } finally {
      setBillingSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setConnectionError('');
    const res = await window.electronAPI.testBillingConnection({ platform: billingPlatform });
    if (res.success) {
      setConnectionStatus('connected');
    } else {
      setConnectionStatus('error');
      setConnectionError(res.error || 'Ismeretlen hiba');
    }
  };

  const handleClearBillingConfig = async () => {
    await window.electronAPI.clearBillingConfig();
    setBillingApiKey('');
    setBillingUrl('');
    setSavedBillingUrl('');
    setConnectionStatus('idle');
    setConnectionError('');
  };

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
    <div className="max-w-6xl mx-auto h-full min-h-0 flex flex-col gap-6">
      <PageHeader
        title="Beállítások"
        subtitle="Fiók, előfizetés, megjelenés és számlázási konfiguráció egy közös admin felületen."
      />

      <div className="flex min-h-0 flex-1 gap-6">
      {/* Tab navigation */}
      <nav className="w-56 shrink-0 py-2">
        <div className="space-y-1">
          {ALL_TABS.filter(t => !t.businessOnly || user?.is_business !== 0).map((tab) => {
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

                  {/* Business / private mode toggle */}
                  <div className="pt-3 border-t border-teal/10">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-cream mb-0.5">Vállalkozói mód</p>
                        <p className="text-xs text-steel">
                          {user.is_business !== 0
                            ? 'Vállalkozóként használod az appot – a számlázás és az adózási modul aktív.'
                            : 'Magánszemélyként használod az appot – a számlázás és az adózás ki van kapcsolva.'}
                        </p>
                      </div>
                      <button
                        onClick={() => updateUser({ is_business: user.is_business === 0 ? 1 : 0 })}
                        className={`shrink-0 relative w-11 h-6 rounded-full transition-colors cursor-pointer ${user.is_business !== 0 ? 'bg-teal' : 'bg-steel/30'}`}
                        aria-label="Vállalkozói mód"
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-cream transition-transform ${user.is_business !== 0 ? 'translate-x-5' : ''}`} />
                      </button>
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

            {/* Business Info */}
            <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-ash">Vállalkozási adatok</h3>
                <p className="text-[11px] text-steel mt-0.5">Ezek az adatok jelennek meg a generált szerződéseken.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-steel mb-1.5">Cégnév / Vállalkozó neve</label>
                  <input
                    type="text"
                    value={user?.company_name || ''}
                    onChange={e => updateUser({ company_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-teal/10 text-sm text-cream focus:outline-none focus:border-teal/40"
                    placeholder="Pl. Kovács Péter EV"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-steel mb-1.5">Adószám</label>
                  <input
                    type="text"
                    value={user?.tax_number || ''}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 11);
                      let formatted = raw;
                      if (raw.length > 8) formatted = raw.slice(0, 8) + '-' + raw.slice(8);
                      if (raw.length > 9) formatted = raw.slice(0, 8) + '-' + raw.slice(8, 9) + '-' + raw.slice(9);
                      updateUser({ tax_number: formatted });
                    }}
                    maxLength={13}
                    className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-teal/10 text-sm text-cream focus:outline-none focus:border-teal/40"
                    placeholder="12345678-1-42"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-steel mb-1.5">Székhely / Cím</label>
                  <input
                    type="text"
                    value={user?.address || ''}
                    onChange={e => {
                      let val = e.target.value;
                      // Auto-insert space after 4-digit postal code
                      const m = val.match(/^(\d{4})(\S)/);
                      if (m) val = m[1] + ' ' + val.slice(4);
                      updateUser({ address: val });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-teal/10 text-sm text-cream focus:outline-none focus:border-teal/40"
                    placeholder="1234 Budapest, Példa utca 1."
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-steel mb-1.5">Bankszámlaszám</label>
                  <input
                    type="text"
                    value={user?.bank_account || ''}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 24);
                      let formatted = raw;
                      if (raw.length > 8) formatted = raw.slice(0, 8) + '-' + raw.slice(8);
                      if (raw.length > 16) formatted = raw.slice(0, 8) + '-' + raw.slice(8, 16) + '-' + raw.slice(16);
                      updateUser({ bank_account: formatted });
                    }}
                    maxLength={26}
                    className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-teal/10 text-sm text-cream focus:outline-none focus:border-teal/40"
                    placeholder="12345678-12345678-12345678"
                  />
                </div>
              </div>
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

        {/* ── Számlázás ── */}
        {activeTab === 'szamlazas' && billingLoaded && (
          <div className="space-y-6">
            <div>
              <h2 className="font-pixel text-[15px] text-cream">Számlázás</h2>
              <p className="text-xs text-steel mt-1">Számlázó rendszer integráció és API beállítások</p>
            </div>

            {/* Platform selector */}
            <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6">
              <h3 className="text-sm font-semibold text-ash mb-1">Számlázó rendszer</h3>
              <p className="text-[11px] text-steel mb-4">Válaszd ki, melyik számlázót szeretnéd használni.</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { id: 'billingo' as BillingPlatform, label: 'Billingo', desc: 'Mély integráció, API kulcson keresztül', deep: true },
                  { id: 'szamlazz' as BillingPlatform, label: 'Számlázz.hu', desc: 'Mély integráció, API kulcson keresztül', deep: true },
                  { id: 'egyeb' as BillingPlatform, label: 'Egyéb', desc: 'Egyszerű link megnyitás', deep: false },
                  { id: 'none' as BillingPlatform, label: 'Nincs számlázó', desc: 'Nem használok számlázó rendszert', deep: false },
                ]).map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (billingPlatform !== p.id) {
                        setBillingPlatform(p.id);
                        setConnectionStatus('idle');
                        setConnectionError('');
                        setBillingApiKey('');
                      }
                    }}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      billingPlatform === p.id
                        ? 'border-teal bg-teal/10'
                        : 'border-teal/10 hover:border-teal/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${p.deep ? 'bg-teal' : 'bg-steel/40'}`} />
                      <span className="text-sm font-medium text-cream">{p.label}</span>
                    </div>
                    <p className="text-[10px] text-steel mt-1 ml-[18px]">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Billingo config */}
            {billingPlatform === 'billingo' && (
              <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-ash">Billingo API konfiguráció</h3>
                  <p className="text-[11px] text-steel mt-0.5">Add meg a Billingo API kulcsodat a közvetlen integráció használatához.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-steel mb-1.5">API kulcs</label>
                  <div className="relative">
                    <input
                      type={showBillingKey ? 'text' : 'password'}
                      value={billingApiKey}
                      onChange={e => { setBillingApiKey(e.target.value); setConnectionStatus('idle'); setConnectionError(''); }}
                      onFocus={() => { if (billingApiKey === '••••••••••••••••') setBillingApiKey(''); }}
                      className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-teal/10 text-sm text-cream focus:outline-none focus:border-teal/40 pr-10"
                      placeholder="Billingo API kulcs"
                    />
                    <button type="button" onClick={() => setShowBillingKey(!showBillingKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-steel hover:text-ash">
                      {showBillingKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Connection status */}
                {connectionStatus !== 'idle' && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                    connectionStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-400' :
                    connectionStatus === 'error' ? 'bg-red-500/10 text-red-400' :
                    'bg-teal/5 text-steel'
                  }`}>
                    {connectionStatus === 'testing' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {connectionStatus === 'connected' && <CheckCircle className="w-3.5 h-3.5" />}
                    {connectionStatus === 'error' && <AlertCircle className="w-3.5 h-3.5" />}
                    <span>
                      {connectionStatus === 'testing' && 'Ellenőrzés...'}
                      {connectionStatus === 'connected' && 'Kapcsolódva'}
                      {connectionStatus === 'error' && (connectionError || 'Hibás kulcs')}
                    </span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveBillingConfig}
                    disabled={billingSaving || !billingApiKey || billingApiKey === '••••••••••••••••'}
                    className="px-4 py-2 text-sm font-medium bg-teal text-ink rounded-lg hover:bg-teal/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {billingSaving ? 'Mentés...' : 'Mentés és tesztelés'}
                  </button>
                  <button
                    onClick={handleTestConnection}
                    disabled={connectionStatus === 'testing'}
                    className="px-4 py-2 text-sm text-cream border border-teal/20 rounded-lg hover:bg-teal/10 transition-colors disabled:opacity-40"
                  >
                    Kapcsolat tesztelése
                  </button>
                  {connectionStatus === 'connected' && (
                    <button
                      onClick={handleClearBillingConfig}
                      className="px-4 py-2 text-sm text-red-400 border border-red-400/20 rounded-lg hover:bg-red-400/10 transition-colors ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Számlázz.hu config */}
            {billingPlatform === 'szamlazz' && (
              <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-ash">Számlázz.hu API konfiguráció</h3>
                  <p className="text-[11px] text-steel mt-0.5">Add meg a Számlázz.hu Agent kulcsodat a közvetlen integráció használatához.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-steel mb-1.5">Agent kulcs</label>
                  <div className="relative">
                    <input
                      type={showBillingKey ? 'text' : 'password'}
                      value={billingApiKey}
                      onChange={e => { setBillingApiKey(e.target.value); setConnectionStatus('idle'); setConnectionError(''); }}
                      onFocus={() => { if (billingApiKey === '••••••••••••••••') setBillingApiKey(''); }}
                      className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-teal/10 text-sm text-cream focus:outline-none focus:border-teal/40 pr-10"
                      placeholder="Számlázz.hu Agent kulcs"
                    />
                    <button type="button" onClick={() => setShowBillingKey(!showBillingKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-steel hover:text-ash">
                      {showBillingKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Connection status */}
                {connectionStatus !== 'idle' && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                    connectionStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-400' :
                    connectionStatus === 'error' ? 'bg-red-500/10 text-red-400' :
                    'bg-teal/5 text-steel'
                  }`}>
                    {connectionStatus === 'testing' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {connectionStatus === 'connected' && <CheckCircle className="w-3.5 h-3.5" />}
                    {connectionStatus === 'error' && <AlertCircle className="w-3.5 h-3.5" />}
                    <span>
                      {connectionStatus === 'testing' && 'Ellenőrzés...'}
                      {connectionStatus === 'connected' && 'Kapcsolódva'}
                      {connectionStatus === 'error' && (connectionError || 'Hibás kulcs')}
                    </span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveBillingConfig}
                    disabled={billingSaving || !billingApiKey || billingApiKey === '••••••••••••••••'}
                    className="px-4 py-2 text-sm font-medium bg-teal text-ink rounded-lg hover:bg-teal/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {billingSaving ? 'Mentés...' : 'Mentés és tesztelés'}
                  </button>
                  <button
                    onClick={handleTestConnection}
                    disabled={connectionStatus === 'testing'}
                    className="px-4 py-2 text-sm text-cream border border-teal/20 rounded-lg hover:bg-teal/10 transition-colors disabled:opacity-40"
                  >
                    Kapcsolat tesztelése
                  </button>
                  {connectionStatus === 'connected' && (
                    <button
                      onClick={handleClearBillingConfig}
                      className="px-4 py-2 text-sm text-red-400 border border-red-400/20 rounded-lg hover:bg-red-400/10 transition-colors ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Egyéb – URL config */}
            {billingPlatform === 'egyeb' && (
              <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-ash">Egyéb számlázó</h3>
                  <p className="text-[11px] text-steel mt-0.5">Add meg a számlázó rendszered webes felületének URL-jét.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-steel mb-1.5">URL</label>
                  <div className="relative">
                    <input
                      type="url"
                      value={billingUrl}
                      onChange={e => setBillingUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-teal/10 text-sm text-cream focus:outline-none focus:border-teal/40 pl-9"
                      placeholder="https://szamlazo.example.com"
                    />
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-steel" />
                  </div>
                </div>

                <button
                  onClick={handleSaveBillingConfig}
                  disabled={billingSaving || !billingUrl || (!!billingUrl && billingUrl === savedBillingUrl)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center gap-2 ${billingUrl && billingUrl === savedBillingUrl ? 'bg-emerald-500/20 text-emerald-400 disabled:opacity-100' : 'bg-teal text-ink hover:bg-teal/80 disabled:opacity-40'}`}
                >
                  {billingSaving ? 'Mentés...' : (billingUrl && billingUrl === savedBillingUrl) ? (<><Check className="w-3.5 h-3.5" /> Mentve</>) : 'Mentés'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Adózás ── */}
        {activeTab === 'adozas' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-pixel text-[15px] text-cream">Adózás</h2>
              <p className="text-xs text-steel mt-1">Adózási profil és ÁFA beállítások</p>
            </div>

            {(() => {
              const vallTipus = taxProfile?.vallalkozasTipus;
              const adozasForma = taxProfile?.adozasForma;
              const hasProfile = !!vallTipus && !!adozasForma;
              const vatStatus = user?.vat_status;
              const vatLabel =
                vatStatus === 'exempt' ? 'Alanyi mentes (AAM)' :
                vatStatus === 'standard' ? `Áfakörös · ${user?.vat_rate_default ?? 27}%` :
                '—';
              const vallTipusLabel = vallTipus === 'EV' ? 'Egyéni vállalkozó' : vallTipus || '—';
              const adozasFormaLabel =
                adozasForma === 'atalany' ? 'Átalányadózás' :
                adozasForma === 'vszja' ? 'VSZJA' :
                adozasForma === 'TAO' ? 'TAO (társasági adó)' :
                adozasForma === 'KIVA' ? 'KIVA' :
                '—';
              const foglalkozasLabel =
                taxProfile?.foglalkozas === 'fofoglalkozasu' ? 'Főfoglalkozású' :
                taxProfile?.foglalkozas === 'mellekfoglalkozasu' ? 'Mellékfoglalkozású' :
                '—';

              return (
                <>
                  {/* Hero card */}
                  <div className="relative overflow-hidden rounded-2xl border-l-[3px] border-teal bg-gradient-to-br from-surface-800/70 to-surface-900/40 p-6">
                    <div className="absolute -top-24 -right-24 w-72 h-72 bg-teal/5 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative flex items-start justify-between gap-6 flex-wrap">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-teal/15 border border-teal/20 flex items-center justify-center shrink-0">
                          <Calculator width={22} height={22} className="text-teal" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs text-steel tracking-[0.15em] uppercase font-medium">Adózási profil</p>
                            {hasProfile ? (
                              <span className="inline-flex items-center gap-1 text-[10px] tracking-[0.1em] uppercase font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                <CheckCircle width={10} height={10} /> Beállítva
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] tracking-[0.1em] uppercase font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                <AlertCircle width={10} height={10} /> Hiányzik
                              </span>
                            )}
                          </div>
                          <p className="text-2xl font-bold text-cream mt-1 truncate">{vallTipusLabel}</p>
                          <p className="text-sm text-steel mt-0.5">
                            {adozasFormaLabel}
                            {vatStatus && (
                              <span className="text-steel/50"> · {vatLabel}</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => setShowTaxWizard(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-teal text-ink rounded-lg hover:bg-teal/80 transition-colors cursor-pointer shrink-0"
                      >
                        <Edit3 width={14} height={14} />
                        {hasProfile ? 'Szerkesztés' : 'Beállítás'}
                      </button>
                    </div>
                  </div>

                  {/* Stat grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Vállalkozás típusa */}
                    <div className="bg-surface-800/50 rounded-xl border border-teal/10 p-4 hover:border-teal/20 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 width={14} height={14} className="text-teal/70" />
                        <p className="text-[10px] text-steel tracking-[0.12em] uppercase font-medium">Vállalkozás típusa</p>
                      </div>
                      <p className="text-sm font-semibold text-cream">{vallTipusLabel}</p>
                    </div>

                    {/* Adózási forma */}
                    <div className="bg-surface-800/50 rounded-xl border border-teal/10 p-4 hover:border-teal/20 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <FileCheck2 width={14} height={14} className="text-teal/70" />
                        <p className="text-[10px] text-steel tracking-[0.12em] uppercase font-medium">Adózási forma</p>
                      </div>
                      <p className="text-sm font-semibold text-cream">{adozasFormaLabel}</p>
                    </div>

                    {/* ÁFA státusz */}
                    <div className="bg-surface-800/50 rounded-xl border border-teal/10 p-4 hover:border-teal/20 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <Percent width={14} height={14} className="text-teal/70" />
                        <p className="text-[10px] text-steel tracking-[0.12em] uppercase font-medium">ÁFA státusz</p>
                      </div>
                      <p className="text-sm font-semibold text-cream">{vatLabel}</p>
                    </div>

                    {/* ÁFA adószám */}
                    <div className="bg-surface-800/50 rounded-xl border border-teal/10 p-4 hover:border-teal/20 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield width={14} height={14} className="text-teal/70" />
                        <p className="text-[10px] text-steel tracking-[0.12em] uppercase font-medium">ÁFA adószám</p>
                      </div>
                      <p className={`text-sm font-semibold font-mono ${user?.vat_number ? 'text-cream' : 'text-steel/40'}`}>
                        {user?.vat_number || '—'}
                      </p>
                    </div>

                    {/* Foglalkoztatás (EV only) */}
                    {vallTipus === 'EV' && (
                      <div className="bg-surface-800/50 rounded-xl border border-teal/10 p-4 hover:border-teal/20 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <Briefcase width={14} height={14} className="text-teal/70" />
                          <p className="text-[10px] text-steel tracking-[0.12em] uppercase font-medium">Foglalkoztatás</p>
                        </div>
                        <p className="text-sm font-semibold text-cream">{foglalkozasLabel}</p>
                      </div>
                    )}

                    {/* HIPA kulcs */}
                    <div className="bg-surface-800/50 rounded-xl border border-teal/10 p-4 hover:border-teal/20 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin width={14} height={14} className="text-teal/70" />
                        <p className="text-[10px] text-steel tracking-[0.12em] uppercase font-medium">HIPA kulcs</p>
                      </div>
                      <p className={`text-sm font-semibold ${typeof taxProfile?.hipaKulcs === 'number' ? 'text-cream' : 'text-steel/40'}`}>
                        {typeof taxProfile?.hipaKulcs === 'number' ? `${taxProfile.hipaKulcs}%` : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Help text */}
                  <div className="flex items-start gap-2.5 bg-teal/5 border border-teal/15 rounded-xl px-4 py-3">
                    <Info width={14} height={14} className="text-teal/70 shrink-0 mt-0.5" />
                    <p className="text-xs text-steel/80 leading-relaxed">
                      A <span className="text-cream">Pénzügyek</span> oldalon ezen adatok alapján becsüljük meg az éves adóterhedet (SZJA, járulékok, HIPA).
                      Változás esetén frissítsd a profilt, hogy pontos maradjon a becslés.
                    </p>
                  </div>
                </>
              );
            })()}

            {showTaxWizard && (
              <TaxProfileWizard
                onClose={() => setShowTaxWizard(false)}
                onSaved={() => { setShowTaxWizard(false); loadTaxProfile(); }}
              />
            )}
          </div>
        )}

        {/* ── Általános ── */}
        {activeTab === 'altalanos' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-pixel text-[15px] text-cream">Általános</h2>
              <p className="text-xs text-steel mt-1">Alkalmazás beállítások</p>
            </div>

            {/* Team mode */}
            <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6">
              <h3 className="text-sm font-semibold text-ash mb-1">Csapat mód</h3>
              <p className="text-[11px] text-steel mb-4">Csapat módban kezelheted a csapattagjaidat és hozzárendelheted őket projektekhez. Az időkövetés funkciók elrejtésre kerülnek.</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-steel">Csapat mód</span>
                <button
                  onClick={() => updateUser({ team_mode: user?.team_mode === 1 ? 0 : 1 })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    user?.team_mode === 1 ? 'bg-teal' : 'bg-surface-800 border border-teal/20'
                  }`}
                >
                  <span className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full transition-all ${
                    user?.team_mode === 1
                      ? 'left-5.5 bg-cream'
                      : 'left-0.5 bg-steel/60'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Klient Ads ── */}
        {activeTab === 'ads' && (
          <AdsSubscriptionTab />
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
