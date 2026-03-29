import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function PaymentCancel() {
  useEffect(() => {
    // Signal to parent window/webview that payment was cancelled
    if (window.opener) {
      window.opener.postMessage({ type: 'payment_cancelled' }, '*');
    }
  }, []);

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center p-6">
      <div className="text-center space-y-6 max-w-md">
        <div className="w-20 h-20 rounded-full bg-steel/20 border-2 border-steel/40 flex items-center justify-center mx-auto">
          <X className="w-10 h-10 text-steel" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-cream mb-2">
            Fizetés megszakítva
          </h1>
          <p className="text-steel">
            A fizetési folyamat megszakadt. Ezt az ablakot bezárhatod és újra próbálkozhatsz.
          </p>
        </div>
        <div className="text-xs text-steel/60">
          Ez az ablak automatikusan bezáródik...
        </div>
      </div>
    </div>
  );
}
