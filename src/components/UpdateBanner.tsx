import { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';

export default function UpdateBanner() {
  const [status, setStatus] = useState<'idle' | 'available' | 'downloaded'>('idle');
  const [version, setVersion] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const cleanupAvailable = window.electronAPI.onUpdateAvailable((info: any) => {
      setVersion(info?.version || '');
      setStatus('available');
      setDismissed(false);
    });
    const cleanupDownloaded = window.electronAPI.onUpdateDownloaded((info: any) => {
      setVersion(info?.version || '');
      setStatus('downloaded');
      setDismissed(false);
    });
    return () => { cleanupAvailable(); cleanupDownloaded(); };
  }, []);

  if (status === 'idle' || dismissed) return null;

  return (
    <div className="px-4 py-2 text-xs font-medium flex items-center justify-center gap-3 bg-teal/15 text-teal">
      {status === 'available' ? (
        <>
          <Download className="w-3.5 h-3.5 animate-bounce" />
          <span>Új verzió érhető el{version ? ` (v${version})` : ''} — letöltés folyamatban...</span>
        </>
      ) : (
        <>
          <RefreshCw className="w-3.5 h-3.5" />
          <span>A frissítés{version ? ` (v${version})` : ''} letöltődött.</span>
          <button
            onClick={() => window.electronAPI.installUpdate()}
            className="px-2.5 py-0.5 rounded bg-teal text-ink font-semibold hover:bg-teal/80 transition-colors"
          >
            Telepítés most
          </button>
        </>
      )}
      <button
        onClick={() => setDismissed(true)}
        className="ml-1 p-0.5 rounded hover:bg-teal/20 transition-colors"
        title="Elrejtés"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
