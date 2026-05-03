export type SubscriptionPlanId = 'monthly' | 'yearly' | 'lifetime';

export interface SubscriptionPlanDefinition {
  id: SubscriptionPlanId;
  name: string;
  price: string;
  period: string;
  badge?: string;
}

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlanDefinition[] = [
  {
    id: 'monthly' as const,
    name: 'Havi',
    price: '4 990 Ft',
    period: '/hó',
  },
  {
    id: 'yearly' as const,
    name: 'Éves',
    price: '49 900 Ft',
    period: '/év',
    badge: '2 hónap ingyen',
  },
  {
    id: 'lifetime' as const,
    name: 'Lifetime',
    price: '149 900 Ft',
    period: ' egyszeri',
  },
] as const;