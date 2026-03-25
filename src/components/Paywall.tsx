import { useState, useEffect, useRef } from 'react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth } from '../contexts/AuthContext';
import { Crown, Zap, Check, Loader2, Sparkles, X, CreditCard } from 'lucide-react';

const PLANS = [
  {
    id: 'monthly' as const,
    name: 'Havi',
    price: '3 990 Ft',
    period: '/hó',
    features: ['Korlátlan ügyfelek', 'Korlátlan projektek', 'AI funkciók', 'Fájlkezelés'],
    highlight: false,
  },
  {
    id: 'yearly' as const,
    name: 'Éves',
    price: '39 900 Ft',
    period: '/év',
    badge: 'Népszerű',
    features: ['Minden havi funkció', '2 hónap ingyen', 'Prioritásos támogatás', 'Korai hozzáférés'],
    highlight: true,
  },
  {
    id: 'lifetime' as const,
    name: 'Lifetime',
    price: '119 900 Ft',
    period: ' egyszeri',
    features: ['Örökös hozzáférés', 'Minden jövőbeli frissítés', 'VIP támogatás', 'Korai béta hozzáférés'],
    highlight: false,
  },
];

const CELEBRATION_COLORS = ['#124559', '#598392', '#AEC3B0', '#EFF6E0', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];
const CONFETTI_PARTICLES = Array.from({ length: 40 }, (_, i) => ({
  left: ((i * 23 + 7) % 100),
  delay: ((i * 73) % 3000) / 1000,
  duration: 2 + ((i * 31) % 2500) / 1000,
  color: CELEBRATION_COLORS[i % CELEBRATION_COLORS.length],
  size: 4 + ((i * 13) % 8),
  isCircle: i % 3 === 0,
}));

export default function Paywall({ overlay, onClose }: { overlay?: boolean; onClose?: () => void } = {}) {
  const { subscription, openCheckout, refresh, isActive, setCelebratingPayment } = useSubscription();
  const { logout } = useAuth();
  const [error, setError] = useState('');
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [webviewLoading, setWebviewLoading] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [postCheckout, setPostCheckout] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const minTimeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postCheckoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successHandled = useRef(false);

  const isPaidActive = subscription?.status === 'active' && subscription?.plan !== 'trial';

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const startPolling = (intervalMs: number) => {
    stopPolling();
    pollRef.current = setInterval(refresh, intervalMs);
  };

  const handleCheckout = async (plan: 'monthly' | 'yearly' | 'lifetime') => {
    setCheckingOut(plan);
    setError('');
    successHandled.current = false;
    try {
      const url = await openCheckout(plan);
      setWebviewLoading(true);
      setCheckoutUrl(url);
      startPolling(3000);
    } catch {
      setError('Nem sikerült megnyitni a fizetési oldalt');
    } finally {
      setCheckingOut(null);
    }
  };

  const closeCheckout = () => {
    stopPolling();
    setCheckoutUrl(null);
    // Enter post-checkout mode: poll aggressively for 45s
    setPostCheckout(true);
    refresh();
    startPolling(2000);
    postCheckoutTimer.current = setTimeout(() => {
      stopPolling();
      setPostCheckout(false);
    }, 45000);
  };

  // When subscription becomes paid+active: show celebration
  // Note: celebratingPayment is set in SubscriptionContext (same batch) to prevent unmount race
  useEffect(() => {
    if (isPaidActive && !successHandled.current) {
      successHandled.current = true;
      stopPolling();
      setCheckoutUrl(null);
      setPostCheckout(false);
      if (postCheckoutTimer.current) { clearTimeout(postCheckoutTimer.current); postCheckoutTimer.current = null; }
      setShowCelebration(true);

      // Auto-dismiss after 4 seconds
      const timer = setTimeout(() => {
        setCelebratingPayment(false);
        setShowCelebration(false);
        if (overlay && onClose) onClose();
      }, 4000);
      minTimeRef.current = timer;

      return () => clearTimeout(timer);
    }
  }, [isPaidActive]);

  // Safety: if celebratingPayment is true but we're mounted without celebration showing, clear it
  useEffect(() => {
    if (isPaidActive && !showCelebration && successHandled.current) {
      const safetyTimer = setTimeout(() => {
        setCelebratingPayment(false);
      }, 500);
      return () => clearTimeout(safetyTimer);
    }
  }, [isPaidActive, showCelebration]);

  // Cleanup timers on unmount — also clear celebrating state to prevent stuck screen
  useEffect(() => {
    return () => {
      stopPolling();
      if (minTimeRef.current) clearTimeout(minTimeRef.current);
      if (postCheckoutTimer.current) clearTimeout(postCheckoutTimer.current);
      setCelebratingPayment(false);
    };
  }, []);

  const isTrialExpired = subscription?.status === 'expired' && subscription?.plan === 'trial';

  return (
    <div className="min-h-screen bg-ink flex flex-col">
      {/* Custom title bar area — only in standalone mode */}
      {!overlay && <div className="h-8 bg-ink [-webkit-app-region:drag] flex-shrink-0" />}

      {/* Close button for overlay mode */}
      {overlay && onClose && (
        <div className="flex justify-end px-4 pt-3 shrink-0">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-teal/10 text-steel hover:text-cream transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

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

        {/* Post-checkout processing indicator */}
        {postCheckout && (
          <div className="flex items-center justify-center gap-2 mt-4 px-4 py-3 rounded-lg bg-teal/10 border border-teal/20">
            <Loader2 className="w-4 h-4 text-teal animate-spin" />
            <p className="text-sm text-cream">Fizetés feldolgozása...</p>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}

        {/* Already purchased? Refresh button */}
        <button
          onClick={() => { refresh(); if (!postCheckout) { setPostCheckout(true); startPolling(2000); postCheckoutTimer.current = setTimeout(() => { stopPolling(); setPostCheckout(false); }, 30000); } }}
          className="mt-4 text-steel text-xs hover:text-ash transition-colors"
        >
          Már fizettél? Kattints az állapot frissítéséhez
        </button>

        {/* Logout — only in standalone mode */}
        {!overlay && (
          <button
            onClick={logout}
            className="mt-6 text-steel/60 text-xs hover:text-steel transition-colors"
          >
            Kijelentkezés
          </button>
        )}
      </div>

      {/* Stripe Checkout webview modal */}
      {checkoutUrl && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onDoubleClick={closeCheckout}>
          <div className="bg-surface-800 rounded-xl border border-teal/15 shadow-2xl w-[90vw] h-[85vh] flex flex-col overflow-hidden" onDoubleClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-teal/10 shrink-0">
              <div className="flex items-center gap-2">
                <CreditCard width={14} height={14} className="text-steel" />
                <span className="text-sm text-cream font-medium">Fizetés</span>
              </div>
              <button
                onClick={closeCheckout}
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
                      if (e.url?.includes('/success')) closeCheckout();
                    });
                    el.addEventListener('will-navigate', (e: any) => {
                      if (e.url?.includes('/success')) closeCheckout();
                    });
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Payment success celebration */}
      {showCelebration && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink overflow-hidden celebration-glow">
          {/* Confetti particles */}
          {CONFETTI_PARTICLES.map((p, i) => (
            <div
              key={i}
              className="absolute top-0 pointer-events-none confetti-piece"
              style={{
                left: `${p.left}%`,
                width: p.size,
                height: p.isCircle ? p.size : p.size * 1.8,
                borderRadius: p.isCircle ? '50%' : '2px',
                backgroundColor: p.color,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
              }}
            />
          ))}

          {/* Center content */}
          <div className="text-center z-10 space-y-6">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center mx-auto check-pop">
              <Check className="w-10 h-10 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-cream">Köszönjük, hogy előfizettél!</h2>
              <p className="text-steel mt-2">Az előfizetésed hamarosan aktív lesz</p>
            </div>
            <p className="text-emerald-400 text-sm">Előfizetés aktív ✓</p>
          </div>
        </div>
      )}
    </div>
  );
}
