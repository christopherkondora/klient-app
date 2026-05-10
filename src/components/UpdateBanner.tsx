import { useEffect, useState } from 'react';
import { AlertCircle, Download, RefreshCw, X } from 'lucide-react';

type UpdateStatus = 'idle' | 'available' | 'downloaded' | 'error';

function extractVersion(info: unknown) {
  return typeof info === 'object' && info !== null && 'version' in info ? String((info as { version?: unknown }).version || '') : '';
}

export default function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [version, setVersion] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const applyStatus = (nextStatus: { status?: string; info?: unknown }) => {
      if (nextStatus.status === 'available' || nextStatus.status === 'downloaded') {
        setVersion(extractVersion(nextStatus.info));
        setStatus(nextStatus.status);
        setDismissed(false);
      } else if (nextStatus.status === 'error') {
        setVersion('');
        setStatus('error');
        setDismissed(false);
      }
    };

    window.electronAPI.getUpdateStatus().then(applyStatus).catch(() => {});

    const cleanupStatus = window.electronAPI.onUpdateStatus(applyStatus);
    const cleanupAvailable = window.electronAPI.onUpdateAvailable((info) => {
      setVersion(extractVersion(info));
      setStatus('available');
      setDismissed(false);
    });
    const cleanupDownloaded = window.electronAPI.onUpdateDownloaded((info) => {
      setVersion(extractVersion(info));
      setStatus('downloaded');
      setDismissed(false);
    });
    const cleanupError = window.electronAPI.onUpdateError(() => {
      setVersion('');
      setStatus('error');
      setDismissed(false);
    });
    return () => { cleanupStatus(); cleanupAvailable(); cleanupDownloaded(); cleanupError(); };
  }, []);

  if (status === 'idle' || dismissed) return null;

  return (
    <div className="px-4 py-2 text-xs font-medium flex items-center justify-center gap-3 bg-teal/15 text-teal">
      {status === 'available' ? (
        <>
          <Download className="w-3.5 h-3.5 animate-bounce" />
          <span>Új verzió érhető el{version ? ` (v${version})` : ''} — letöltés folyamatban...</span>
        </>
      ) : status === 'downloaded' ? (
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
      ) : (
        <>
          <AlertCircle className="w-3.5 h-3.5" />
          <span>A frissítés ellenőrzése sikertelen.</span>
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
