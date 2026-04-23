import { Outlet, Navigate } from 'react-router-dom';
import AdsSidebar from './AdsSidebar';
import TitleBar from './TitleBar';
import { Home } from 'lucide-react';
import { useAppMode } from '../contexts/AppModeContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { AdsProvider } from '../contexts/AdsContext';

export default function AdsLayout() {
  const { setMode } = useAppMode();
  const { hasAdsModule } = useSubscription();

  if (!hasAdsModule) {
    return <Navigate to="/" replace />;
  }

  return (
    <AdsProvider>
      <div className="flex flex-col h-screen bg-ink text-cream">
        <TitleBar />
        <div className="flex flex-1 overflow-hidden">
          <AdsSidebar />
          <main className="flex-1 bg-surface-900 overflow-y-auto overflow-x-hidden">
            <div className="p-8 pb-24 min-h-full">
              <Outlet />
            </div>
          </main>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setMode('klient'); }}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-cyan-600 text-cream shadow-lg shadow-cyan-600/25 hover:bg-cyan-500 hover:scale-105 transition-all flex items-center justify-center z-[9999]"
          title="Vissza a Klient-be"
        >
          <Home size={22} />
        </button>
      </div>
    </AdsProvider>
  );
}
