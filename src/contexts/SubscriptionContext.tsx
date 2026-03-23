import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface SubscriptionContextType {
  subscription: Subscription | null;
  loading: boolean;
  isActive: boolean;
  daysRemaining: number | null;
  refresh: () => Promise<void>;
  activate: (licenseKey: string) => Promise<void>;
  openCheckout: (plan: 'monthly' | 'yearly' | 'lifetime') => Promise<string>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscription: null,
  loading: true,
  isActive: false,
  daysRemaining: null,
  refresh: async () => {},
  activate: async () => {},
  openCheckout: async () => { return ''; },
});

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    try {
      const sub = await window.electronAPI.getSubscription();
      setSubscription(sub);
    } catch {
      setSubscription(null);
    } finally {
      setLoading(false);
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

  const activate = async (licenseKey: string) => {
    const sub = await window.electronAPI.activateSubscription({ license_key: licenseKey });
    setSubscription(sub);
  };

  const openCheckout = async (plan: 'monthly' | 'yearly' | 'lifetime'): Promise<string> => {
    const result = await window.electronAPI.openCheckout({ plan });
    return result.url;
  };

  return (
    <SubscriptionContext.Provider value={{ subscription, loading, isActive, daysRemaining, refresh, activate, openCheckout }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
