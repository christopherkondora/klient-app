import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import Paywall from '../components/Paywall';
import { Crown, Check, Zap } from 'lucide-react';

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

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { user, updateUser, logout } = useAuth();
  const { subscription, refresh } = useSubscription();
  const [showCheckout, setShowCheckout] = useState(false);

  const currentPlan = subscription?.plan || 'trial';
  const isTrial = subscription?.status === 'trial';
  const isPaid = subscription?.status === 'active' && currentPlan !== 'trial';

  const handleUpgrade = (plan: 'monthly' | 'yearly' | 'lifetime') => {
    if (plan === currentPlan) return;
    setShowCheckout(true);
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
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="font-pixel text-xl text-cream">Beállítások</h1>
        <p className="text-steel text-sm mt-2">Alkalmazás beállításai</p>
      </div>

      {/* Theme Settings */}
      <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6">
        <h2 className="font-pixel text-[14px] text-ash mb-4">Megjelenés</h2>
        <div className="space-y-4">
          <div>
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
      </div>

      {/* Subscription Management */}
      <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Crown className="w-4 h-4 text-teal" />
          <h2 className="font-pixel text-[14px] text-ash">Előfizetés</h2>
        </div>

        {/* Current plan indicator */}
        <div className={`px-4 py-3 rounded-lg border mb-5 ${
          isPaid
            ? 'bg-emerald-500/10 border-emerald-500/20'
            : 'bg-teal/5 border-teal/10'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-steel">Jelenlegi csomag</p>
              <p className={`text-sm font-semibold mt-0.5 ${
                isPaid ? 'text-emerald-400' : 'text-cream'
              }`}>
                {planLabel(currentPlan)}
                {isPaid && <span className="ml-2 text-[10px] font-normal text-emerald-400/70">Aktív ✓</span>}
                {isTrial && <span className="ml-2 text-[10px] font-normal text-steel">14 napos ingyenes</span>}
              </p>
            </div>
            {isPaid && subscription?.current_period_end && currentPlan !== 'lifetime' && (
              <div className="text-right">
                <p className="text-[10px] text-steel">Következő számlázás</p>
                <p className="text-xs text-cream">{new Date(subscription.current_period_end).toLocaleDateString('hu-HU')}</p>
              </div>
            )}
            {isPaid && currentPlan === 'lifetime' && (
              <div className="text-right">
                <p className="text-[10px] text-emerald-400/70">Örökös hozzáférés</p>
              </div>
            )}
          </div>
        </div>

        {/* Plan cards */}
        {currentPlan !== 'lifetime' && (
          <>
            <p className="text-xs text-steel mb-3">{isPaid ? 'Csomag váltás' : 'Válassz csomagot'}</p>
            <div className="grid grid-cols-3 gap-3">
              {PLANS.map((plan) => {
                const isCurrentPlan = plan.id === currentPlan;
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
                        className="mt-3 w-full py-1.5 rounded-lg bg-steel/15 hover:bg-steel/25 text-xs font-medium text-cream transition-colors flex items-center justify-center gap-1"
                      >
                        <Zap className="w-3 h-3" />
                        {isPaid ? 'Váltás' : 'Előfizetés'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Invoice Platform */}
      <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6">
        <h2 className="font-pixel text-[14px] text-ash mb-4">Számlázás</h2>
        <div>
          <label className="block text-xs font-medium text-steel mb-3">Platform</label>
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
      </div>

      {/* Pomodoro */}
      <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6">
        <h2 className="font-pixel text-[14px] text-ash mb-2">Pomodoro</h2>
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

      {/* App Info */}
      <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6">
        <h2 className="font-pixel text-[14px] text-ash mb-4">Alkalmazás</h2>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-steel">Verzió</span>
            <span className="text-xs text-cream font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-steel">Platform</span>
            <span className="text-xs text-cream font-medium">Electron + React</span>
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6">
        <h2 className="font-pixel text-[14px] text-ash mb-4">Fiók</h2>
        {user && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-steel">Bejelentkezve</span>
              <span className="text-xs text-cream font-medium">{user.email}</span>
            </div>
            <button
              onClick={logout}
              className="w-full py-2 text-sm text-red-400 border border-red-400/20 rounded-lg hover:bg-red-400/10 transition-colors"
            >
              Kijelentkezés
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
