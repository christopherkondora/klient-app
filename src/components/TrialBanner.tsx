import { Clock } from 'lucide-react';
import { useSubscription } from '../contexts/SubscriptionContext';

export default function TrialBanner() {
  const { subscription, daysRemaining } = useSubscription();

  if (!subscription || subscription.status !== 'trial' || daysRemaining === null) return null;

  const urgent = daysRemaining <= 3;

  return (
    <div className={`px-4 py-1.5 text-xs font-medium flex items-center justify-center gap-2 ${
      urgent ? 'bg-red-500/15 text-red-400' : 'bg-teal/10 text-teal'
    }`}>
      <Clock className="w-3.5 h-3.5" />
      {daysRemaining === 0
        ? 'A próbaidőszak ma lejár!'
        : `${daysRemaining} nap van hátra a próbaidőszakból`}
    </div>
  );
}
