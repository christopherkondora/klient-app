import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface SubscriptionContextType {
  subscription: Subscription | null;
  loading: boolean;
  isActive: boolean;
  daysRemaining: number | null;
  hasAdsModule: boolean;
  adsStatus: 'none' | 'active' | 'cancelled' | 'expired' | 'past_due';
  refresh: () => Promise<void>;
  openCheckout: (plan: 'monthly' | 'yearly' | 'lifetime', module?: 'klient' | 'ads') => Promise<string>;
  cancelSubscription: (module?: 'klient' | 'ads') => Promise<void>;
  reactivateSubscription: (module?: 'klient' | 'ads') => Promise<void>;
  celebratingPayment: boolean;
  setCelebratingPayment: (v: boolean) => void;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscription: null,
  loading: true,
  isActive: false,
  daysRemaining: null,
  hasAdsModule: false,
  adsStatus: 'none',
  refresh: async () => {},
  openCheckout: async () => { return ''; },
  cancelSubscription: async () => {},
  reactivateSubscription: async () => {},
  celebratingPayment: false,
  setCelebratingPayment: () => {},
});

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [celebratingPayment, setCelebratingPaymentRaw] = useState(false);
  const initialLoadDone = useRef(false);
  const prevSubRef = useRef<Subscription | null>(null);

  // Safety: auto-clear celebration after 6s no matter what
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setCelebratingPayment = useCallback((v: boolean) => {
    setCelebratingPaymentRaw(v);
    if (celebrationTimer.current) { clearTimeout(celebrationTimer.current); celebrationTimer.current = null; }
    if (v) {
      celebrationTimer.current = setTimeout(() => {
        setCelebratingPaymentRaw(false);
        celebrationTimer.current = null;
      }, 6000);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      return;
    }
    try {
      const sub = await window.electronAPI.getSubscription();
      const next = sub ?? prevSubRef.current;

      // Detect trial/expired → paid transition (outside state updater to avoid side-effect race)
      if (initialLoadDone.current && next) {
        const wasPaid = prevSubRef.current?.status === 'active' && prevSubRef.current?.plan !== 'trial';
        const isPaid = next.status === 'active' && next.plan !== 'trial';
        if (!wasPaid && isPaid) {
          setCelebratingPayment(true);
        }
      }

      prevSubRef.current = next;
      setSubscription(next);
    } catch {
      // Don't overwrite existing subscription on transient errors
    } finally {
      setLoading(false);
      // Only mark initial load done when we actually fetched with a user
      if (user) initialLoadDone.current = true;
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Re-check subscription every 5 minutes while app is open
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, refresh]);

  const isActive = (() => {
    if (!subscription) return false;
    if (subscription.status === 'active') return true;
    if (subscription.status === 'trial' && subscription.trial_ends_at) {
      return new Date(subscription.trial_ends_at) > new Date();
    }
    // Cancelled but period not yet ended
    if (subscription.status === 'cancelled' && subscription.current_period_end) {
      return new Date(subscription.current_period_end) > new Date();
    }
    return false;
  })();

  const daysRemaining = (() => {
    if (!subscription) return null;
    let endDate: string | null = null;
    if (subscription.status === 'trial' && subscription.trial_ends_at) {
      endDate = subscription.trial_ends_at;
    } else if (subscription.current_period_end) {
      endDate = subscription.current_period_end;
    }
    if (!endDate) return null;
    const diff = new Date(endDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();

  const openCheckout = async (plan: 'monthly' | 'yearly' | 'lifetime', module?: 'klient' | 'ads'): Promise<string> => {
    const result = await window.electronAPI.openCheckout({ plan, module });
    return result.url;
  };

  const cancelSubscription = async (module?: 'klient' | 'ads') => {
    await window.electronAPI.cancelSubscription(module);
    await refresh();
  };

  const reactivateSubscription = async (module?: 'klient' | 'ads') => {
    await window.electronAPI.reactivateSubscription(module);
    await refresh();
  };

  const hasAdsModule = (() => {
    if (!subscription) return false;
    const s = subscription.ads_status;
    if (s === 'active') return true;
    if (s === 'cancelled' && subscription.ads_current_period_end) {
      return new Date(subscription.ads_current_period_end) > new Date();
    }
    return false;
  })();

  const adsStatus = subscription?.ads_status || 'none';

  return (
    <SubscriptionContext.Provider value={{ subscription, loading, isActive, daysRemaining, hasAdsModule, adsStatus, refresh, openCheckout, cancelSubscription, reactivateSubscription, celebratingPayment, setCelebratingPayment }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
