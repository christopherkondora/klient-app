import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

export default function PaymentSuccess() {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // Signal to parent window/webview that payment was successful
    if (window.opener) {
      window.opener.postMessage({ type: 'payment_success' }, '*');
    }

    // Auto-close after 3 seconds with countdown
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          window.close();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, []);

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center p-6">
      <div className="text-center space-y-6 max-w-md">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center mx-auto">
          <Check className="w-10 h-10 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-cream mb-2">
            Sikeres fizetés!
          </h1>
          <p className="text-steel">
            Az előfizetésed hamarosan aktív lesz. Ezt az ablakot bezárhatod.
          </p>
        </div>
        <div className="text-xs text-steel/60">
          Az ablak {countdown} másodperc múlva automatikusan bezáródik...
        </div>
      </div>
    </div>
  );
}
