import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAds } from '../contexts/AdsContext';
import AdsAccountConnect from '../components/AdsAccountConnect';
import AdsAiPanel from '../components/AdsAiPanel';
import AdsAccountSelector from '../components/AdsAccountSelector';
import {
  Megaphone, RefreshCw, Loader2,
  Eye, MousePointerClick, TrendingUp, Target, Wallet, Info,
  Plus, Settings2, Clock, Sparkles,
  AlertTriangle, AlertCircle, InfoIcon, X,
} from 'lucide-react';

function formatMicros(micros: number): string {
  return Math.round(micros / 1_000_000).toLocaleString('hu-HU');
}

function formatPercent(value: number): string {
  return (value * 100).toFixed(2) + '%';
}

function formatRoas(conversionsValue: number, costMicros: number): string {
  if (!costMicros) return '–';
  return (conversionsValue / (costMicros / 1_000_000)).toFixed(2) + 'x';
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(amount);
}

function AdsOverviewContent() {
  const {
    accounts, selectedAccount, campaigns, kpi, dateRange,
    syncing, loading, lastSync,
    loadAccounts, selectAccount, setDateRange, refreshData, syncNow,
  } = useAds();
  const navigate = useNavigate();
  const [showConnect, setShowConnect] = useState(false);
  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const aiButtonRef = useRef<HTMLButtonElement>(null);
  const [alerts, setAlerts] = useState<AdsAlertRow[]>([]);

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
    try {
      const res = await window.electronAPI.adsGetAlerts(accountId);
      if (res.success && res.data) setAlerts(res.data);
    } catch { /* ignore */ }
  }

  async function handleDismissAlert(alertId: string) {
    await window.electronAPI.adsDismissAlert(alertId);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }

  async function handleAlertAnalysis(alert: AdsAlertRow) {
    if (alert.aiAnalysisId) {
      setShowAiPanel(true);
    } else if (selectedAccount) {
      try {
        const res = await window.electronAPI.adsRunAnalysis(selectedAccount.id, 'anomaly');
        if (res.success) {
          setShowAiPanel(true);
          loadAlerts(selectedAccount.id);
        }
      } catch { /* ignore */ }
    }
  }

  useEffect(() => {
    (async () => {
      const cred = await window.electronAPI.adsGetCredentials();
      setHasCredentials(cred.hasCredentials);
      await loadAccounts();
    })();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      setDateRange(dateRange);
    }
  }, [selectedAccount?.id]);

  const handleConnected = async () => {
    setShowConnect(false);
    setHasCredentials(true);
    await loadAccounts();
    await refreshData();
  };

  if (hasCredentials === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-teal" />
      </div>
    );
  }

  if (!hasCredentials || accounts.length === 0) {
    return (
      <>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-lg text-center space-y-6">
            <div className="w-16 h-16 bg-teal/10 rounded-2xl flex items-center justify-center mx-auto">
              <Megaphone className="w-8 h-8 text-teal" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-cream mb-2">Google Ads Elemző</h2>
              <p className="text-sm text-steel leading-relaxed">
                Kösd össze Google Ads fiókodat, hogy valós idejű teljesítmény adatokat és
                AI-alapú optimalizálási javaslatokat kapj kampányaidról.
              </p>
            </div>
            <button
              onClick={() => setShowConnect(true)}
              className="px-5 py-2.5 bg-teal/15 text-cream text-sm font-medium rounded-lg hover:bg-teal/25 transition-colors"
            >
              <Plus className="w-4 h-4 inline mr-2 -mt-0.5" />
              Fiók hozzáadása
            </button>
          </div>
        </div>
        {showConnect && (
          <AdsAccountConnect onClose={() => setShowConnect(false)} onConnected={handleConnected} />
        )}
      </>
    );
  }

  const dateRangeOptions: { value: typeof dateRange; label: string }[] = [
    { value: '7d', label: '7 nap' },
    { value: '14d', label: '14 nap' },
    { value: '30d', label: '30 nap' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-pixel text-xl text-cream">Áttekintés</h1>
            <AdsAccountSelector />
          </div>
          <p className="text-steel text-sm mt-1">Kampányteljesítmény és AI elemzés</p>
        </div>
        <div className="flex items-center gap-2">
          {lastSync && (
            <span className="text-[11px] text-steel/60 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(lastSync + 'Z').toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={syncNow}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors duration-150 ease-out bg-steel/20 text-cream hover:bg-steel/30 disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Szinkron
          </button>
          <div className="relative">
            <button
              ref={aiButtonRef}
              onClick={() => setShowAiPanel(!showAiPanel)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors duration-150 ease-out ${showAiPanel ? 'bg-teal/80 text-cream' : 'bg-teal text-cream hover:bg-teal/80'}`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI Elemzés
            </button>
          </div>
          <div className="flex bg-surface-800/50 border border-teal/10 rounded-lg overflow-hidden">
            {dateRangeOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDateRange(opt.value)}
                className={`px-3 py-2 text-xs transition-colors ${dateRange === opt.value ? 'bg-teal/15 text-cream font-medium' : 'text-steel hover:text-cream'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate('/ads/settings')}
            className="p-2 bg-surface-800/50 border border-teal/10 rounded-lg text-steel hover:text-cream transition-colors cursor-pointer"
            title="Beállítások"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI */}
      {loading && !kpi ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-teal" />
        </div>
      ) : kpi ? (
        <>
          {/* Alert banner */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-sm font-medium text-cream">{alerts.length} figyelmeztetés</span>
              </div>
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
                  <div key={alert.id} className={`rounded-lg border p-3 ${severityStyles[alert.severity]}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <SeverityIcon className={`w-4 h-4 mt-0.5 shrink-0 ${severityIconColor}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-bold tracking-wider ${severityIconColor}`}>{severityLabel}</span>
                            {alert.campaignName && <span className="text-xs text-cream font-medium truncate">{alert.campaignName}</span>}
                            <span className="text-xs text-cream">— {alert.title}</span>
                          </div>
                          <p className="text-[11px] text-steel mt-0.5">{alert.description}</p>
                          <button
                            onClick={() => handleAlertAnalysis(alert)}
                            className="text-[11px] text-teal hover:text-teal/80 mt-1 transition-colors"
                          >
                            {alert.aiAnalysisId ? 'AI Elemzés megtekintése →' : 'Elemzés kérése →'}
                          </button>
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

          {/* Hero cost + ROAS */}
          <div className="relative bg-surface-800/50 rounded-2xl border-l-[3px] border-teal p-6">
            <div className="absolute -top-20 -right-20 w-72 h-72 bg-teal/5 rounded-full blur-3xl pointer-events-none" style={{ clipPath: 'inset(0 0 0 0 round 1rem)' }} />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-xs text-steel tracking-[0.15em] font-medium mb-1">
                  KÖLTÉS • {dateRange === '7d' ? 'UTOLSÓ 7 NAP' : dateRange === '14d' ? 'UTOLSÓ 14 NAP' : 'UTOLSÓ 30 NAP'}
                </p>
                <p className="text-4xl font-bold text-cream tracking-tight">{formatCurrency(Math.round((kpi.cost_micros || 0) / 1e6))}</p>
                <p className="text-xs text-steel/60 mt-1">
                  Konverziós érték: <span className="text-emerald-400">{formatCurrency(Math.round(kpi.conversions_value || 0))}</span>
                  {' · '}Konverziók: <span className="text-cream font-medium">{(kpi.conversions || 0).toFixed(1)}</span>
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-1.5 mb-1">
                  <p className="text-xs text-steel tracking-[0.15em] font-medium">ROAS</p>
                  <div className="relative group">
                    <Info className="w-3.5 h-3.5 text-steel/40 cursor-help hover:text-steel/70 transition-colors" />
                    <div className="absolute bottom-full right-0 mb-2 w-52 bg-surface-900 border border-teal/15 rounded-lg p-3 shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 z-[100]"
                      style={{ backgroundColor: 'var(--color-surface-900)' }}>
                      <div className="space-y-1">
                        <p className="text-[11px] text-cream leading-relaxed">🟢 Kiváló: ≥ 3x</p>
                        <p className="text-[11px] text-cream leading-relaxed">🟡 Átlagos: 1–3x</p>
                        <p className="text-[11px] text-cream leading-relaxed">🔴 Gyenge: {'<'} 1x (veszteséges)</p>
                      </div>
                      <p className="text-[10px] text-steel/50 mt-2 pt-2 border-t border-teal/10">Iparági átlag: ~2–4x (szektortól függ)</p>
                      <div className="absolute top-full right-4 -mt-px w-2 h-2 rotate-45 border-r border-b border-teal/15" style={{ backgroundColor: 'var(--color-surface-900)' }} />
                    </div>
                  </div>
                </div>
                <p className={`text-4xl font-bold tracking-tight ${
                  kpi.cost_micros && (kpi.conversions_value / (kpi.cost_micros / 1e6)) >= 3 ? 'text-emerald-400' :
                  kpi.cost_micros && (kpi.conversions_value / (kpi.cost_micros / 1e6)) >= 1 ? 'text-cream' :
                  'text-red-400'
                }`}>
                  {formatRoas(kpi.conversions_value || 0, kpi.cost_micros || 0)}
                </p>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {(() => {
              const ctr = kpi.impressions ? (kpi.clicks || 0) / kpi.impressions : 0;
              return [
                { label: 'MEGJELENÍTÉSEK', value: (kpi.impressions || 0).toLocaleString('hu-HU'), icon: Eye, color: 'text-blue-400' },
                { label: 'KATTINTÁSOK', value: (kpi.clicks || 0).toLocaleString('hu-HU'), icon: MousePointerClick, color: 'text-emerald-400' },
                { label: 'CTR', value: formatPercent(ctr), icon: TrendingUp, color: ctr >= 0.05 ? 'text-emerald-400' : ctr >= 0.03 ? 'text-cream' : 'text-red-400',
                  info: { lines: ['🟢 Kiváló: ≥ 5%', '🟡 Átlagos: 3–5%', '🔴 Gyenge: < 3%'], note: 'Google Ads Search átlag: ~3.17%' } },
                { label: 'KONVERZIÓK', value: (kpi.conversions || 0).toFixed(1), icon: Target, color: (kpi.conversions || 0) > 0 ? 'text-emerald-400' : 'text-steel/40' },
                { label: 'KONV. ÉRTÉK', value: formatCurrency(Math.round(kpi.conversions_value || 0)), icon: Wallet, color: 'text-orange-400' },
              ] as const;
            })().map(card => (
              <div key={card.label} className="bg-surface-800/50 rounded-xl border border-teal/10 p-5 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-2">
                  <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
                  <span className="text-[11px] text-steel tracking-[0.1em] font-medium">{card.label}</span>
                  {'info' in card && card.info && (
                    <div className="relative group">
                      <Info className="w-3.5 h-3.5 text-steel/40 cursor-help hover:text-steel/70 transition-colors" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-surface-900 border border-teal/15 rounded-lg p-3 shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 z-[100]"
                        style={{ backgroundColor: 'var(--color-surface-900)' }}>
                        <div className="space-y-1">
                          {card.info.lines.map((l: string) => (
                            <p key={l} className="text-[11px] text-cream leading-relaxed">{l}</p>
                          ))}
                        </div>
                        <p className="text-[10px] text-steel/50 mt-2 pt-2 border-t border-teal/10">{card.info.note}</p>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 rotate-45 border-r border-b border-teal/15" style={{ backgroundColor: 'var(--color-surface-900)' }} />
                      </div>
                    </div>
                  )}
                </div>
                <p className={`text-2xl font-bold ${card.color.startsWith('text-red') ? 'text-red-400' : 'text-cream'}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Quick campaign summary */}
          <div className="bg-surface-800/50 rounded-xl border border-teal/10 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-pixel text-sm text-cream">Top Kampányok</h2>
              <button
                onClick={() => navigate('/ads/campaigns')}
                className="text-xs text-teal hover:text-teal/80 transition-colors"
              >
                Összes kampány →
              </button>
            </div>
            <div className="space-y-2">
              {campaigns
                .filter(c => c.status === 'ENABLED')
                .sort((a, b) => (b.cost_micros || 0) - (a.cost_micros || 0))
                .slice(0, 5)
                .map(c => {
                  const roas = c.cost_micros ? (c.conversions_value / (c.cost_micros / 1e6)) : 0;
                  return (
                    <div
                      key={c.id}
                      onClick={() => navigate(`/ads/campaigns/${c.campaign_id}`)}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-teal/5 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <span className="text-sm text-cream truncate">{c.name}</span>
                        <span className="text-[10px] bg-surface-900/60 text-steel px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
                          {c.type?.replace('_', ' ') || '–'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-sm text-cream font-medium">{formatMicros(c.cost_micros || 0)} Ft</span>
                        <span className={`text-sm font-medium w-16 text-right ${roas >= 3 ? 'text-emerald-400' : roas >= 1 ? 'text-cream' : 'text-red-400'}`}>
                          {roas ? roas.toFixed(2) + 'x' : '–'}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </>
      ) : null}

      {showConnect && (
        <AdsAccountConnect onClose={() => setShowConnect(false)} onConnected={handleConnected} />
      )}
      {showAiPanel && selectedAccount && (
        <AdsAiPanel accountId={selectedAccount.id} onClose={() => setShowAiPanel(false)} anchorRef={aiButtonRef} />
      )}
    </div>
  );
}

export default function AdsOverview() {
  return <AdsOverviewContent />;
}
