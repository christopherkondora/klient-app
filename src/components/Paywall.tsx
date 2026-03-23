import { useState } from 'react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth } from '../contexts/AuthContext';
import { Crown, Zap, Shield, Check, Loader2, KeyRound, Sparkles, X, CreditCard } from 'lucide-react';

const PLANS = [
  {
    id: 'monthly' as const,
    name: 'Havi',
    price: '$12',
    period: '/hó',
    features: ['Korlátlan ügyfelek', 'Korlátlan projektek', 'AI funkciók', 'Fájlkezelés'],
    highlight: false,
  },
  {
    id: 'yearly' as const,
    name: 'Éves',
    price: '$120',
    period: '/év',
    badge: 'Népszerű',
    features: ['Minden havi funkció', '2 hónap ingyen', 'Prioritásos támogatás', 'Korai hozzáférés'],
    highlight: true,
  },
  {
    id: 'lifetime' as const,
    name: 'Élettartam',
    price: '$360',
    period: ' egyszeri',
    features: ['Örökös hozzáférés', 'Minden jövőbeli frissítés', 'VIP támogatás', 'Korai béta hozzáférés'],
    highlight: false,
  },
];

export default function Paywall() {
  const { subscription, activate, openCheckout, refresh } = useSubscription();
  const { logout } = useAuth();
  const [showLicenseInput, setShowLicenseInput] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [webviewLoading, setWebviewLoading] = useState(true);

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;
    setActivating(true);
    setError('');
    try {
      await activate(licenseKey.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aktiválás sikertelen');
    } finally {
      setActivating(false);
    }
  };

  const handleCheckout = async (plan: 'monthly' | 'yearly' | 'lifetime') => {
    setCheckingOut(plan);
    try {
      const url = await openCheckout(plan);
      setWebviewLoading(true);
      setCheckoutUrl(url);
    } catch {
      setError('Nem sikerült megnyitni a fizetési oldalt');
    } finally {
      setCheckingOut(null);
    }
  };

  const isTrialExpired = subscription?.status === 'expired' && subscription?.plan === 'trial';

  return (
    <div className="min-h-screen bg-ink flex flex-col">
      {/* Custom title bar area */}
      <div className="h-8 bg-ink [-webkit-app-region:drag] flex-shrink-0" />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal/20 mb-4">
            <Crown className="w-8 h-8 text-teal" />
          </div>
          <h1 className="text-3xl font-bold text-cream mb-2">
            {isTrialExpired ? 'A próbaidőszak lejárt' : 'Válassz előfizetést'}
          </h1>
          <p className="text-steel text-lg max-w-md mx-auto">
            {isTrialExpired
              ? 'A 14 napos ingyenes próbaidőszak véget ért. Válassz egy csomagot a folytatáshoz.'
              : 'Válaszd ki a számodra megfelelő csomagot és folytasd a munkát a Klient-tel.'}
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl w-full mb-8">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-6 flex flex-col transition-all ${
                plan.highlight
                  ? 'bg-teal/15 border-2 border-teal shadow-lg shadow-teal/10 scale-[1.02]'
                  : 'bg-ink-light border border-steel/20 hover:border-steel/40'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-teal text-ink text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-cream font-semibold text-lg">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-cream">{plan.price}</span>
                  <span className="text-steel text-sm ml-1">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-ash">
                    <Check className="w-4 h-4 text-teal flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(plan.id)}
                disabled={!!checkingOut}
                className={`w-full py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                  plan.highlight
                    ? 'bg-teal text-ink hover:bg-teal/90'
                    : 'bg-steel/20 text-cream hover:bg-steel/30'
                } disabled:opacity-50`}
              >
                {checkingOut === plan.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Előfizetés
              </button>
            </div>
          ))}
        </div>

        {error && !showLicenseInput && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}

        {/* License key activation */}
        <div className="max-w-md w-full">
          {!showLicenseInput ? (
            <button
              onClick={() => setShowLicenseInput(true)}
              className="w-full text-center text-steel text-sm hover:text-ash transition-colors flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              Van már licenckulcsod? Aktiváld itt
            </button>
          ) : (
            <div className="bg-ink-light border border-steel/20 rounded-xl p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
                  placeholder="Licenckulcs beillesztése..."
                  className="flex-1 bg-ink border border-steel/30 rounded-lg px-3 py-2 text-cream text-sm placeholder:text-steel/50 focus:outline-none focus:border-teal"
                />
                <button
                  onClick={handleActivate}
                  disabled={activating || !licenseKey.trim()}
                  className="bg-teal text-ink px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal/90 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  Aktiválás
                </button>
              </div>
              {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
            </div>
          )}
        </div>

        {/* Already purchased? Refresh button */}
        <button
          onClick={refresh}
          className="mt-4 text-steel text-xs hover:text-ash transition-colors"
        >
          Már fizettél? Kattints az állapot frissítéséhez
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          className="mt-6 text-steel/60 text-xs hover:text-steel transition-colors"
        >
          Kijelentkezés
        </button>
      </div>

      {/* Checkout webview modal */}
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
