import { useEffect, useState } from 'react';
import { useAds } from '../contexts/AdsContext';
import {
  AlertTriangle, AlertCircle, Info as InfoIcon, X, Megaphone, Loader2,
} from 'lucide-react';

function AdsAlertsContent() {
  const { selectedAccount } = useAds();
  const [alerts, setAlerts] = useState<AdsAlertRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedAccount) {
      loadAlerts(selectedAccount.id);
    }
  }, [selectedAccount?.id]);

  useEffect(() => {
    const unsub = window.electronAPI.onAdsAlertsUpdated(({ accountId }) => {
      if (selectedAccount && accountId === selectedAccount.id) {
        loadAlerts(accountId);
      }
    });
    return unsub;
  }, [selectedAccount?.id]);

  async function loadAlerts(accountId: string) {
    setLoading(true);
    try {
      const res = await window.electronAPI.adsGetAlerts(accountId);
      if (res.success && res.data) setAlerts(res.data);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleDismissAlert(alertId: string) {
    await window.electronAPI.adsDismissAlert(alertId);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }

  if (loading && alerts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-teal" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-pixel text-xl text-cream">Riasztások</h1>
        <p className="text-steel text-sm mt-1">Kampány figyelmeztetések és anomáliák</p>
      </div>

      {alerts.length === 0 ? (
        <div className="bg-surface-800/50 rounded-xl border border-teal/10 p-12 text-center">
          <Megaphone className="w-8 h-8 text-steel/20 mx-auto mb-3" />
          <p className="text-sm text-steel/60 italic">Nincs aktív riasztás.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-steel">
            {alerts.length} aktív figyelmeztetés
          </p>
          {alerts.map(alert => {
            const severityStyles = {
              critical: 'border-red-500/40 bg-red-500/10',
              warning: 'border-amber-500/40 bg-amber-500/10',
              info: 'border-blue-500/40 bg-blue-500/10',
            };
            const SeverityIcon = alert.severity === 'critical' ? AlertCircle
              : alert.severity === 'warning' ? AlertTriangle : InfoIcon;
            const severityIconColor = alert.severity === 'critical' ? 'text-red-400'
              : alert.severity === 'warning' ? 'text-amber-400' : 'text-blue-400';
            const severityLabel = alert.severity === 'critical' ? 'KRITIKUS'
              : alert.severity === 'warning' ? 'FIGYELEM' : 'INFO';

            return (
              <div key={alert.id} className={`rounded-lg border p-4 ${severityStyles[alert.severity]}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <SeverityIcon className={`w-4 h-4 mt-0.5 shrink-0 ${severityIconColor}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold tracking-wider ${severityIconColor}`}>{severityLabel}</span>
                        {alert.campaignName && (
                          <span className="text-xs text-cream font-medium truncate">{alert.campaignName}</span>
                        )}
                        <span className="text-xs text-cream">— {alert.title}</span>
                      </div>
                      <p className="text-[11px] text-steel mt-1">{alert.description}</p>
                      <p className="text-[10px] text-steel/50 mt-1">
                        {new Date(alert.detectedAt).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDismissAlert(alert.id)}
                    className="p-0.5 text-steel/50 hover:text-cream transition-colors shrink-0"
                    title="Elutasítás"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdsAlerts() {
  return <AdsAlertsContent />;
}
