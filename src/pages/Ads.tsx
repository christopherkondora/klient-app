import { useEffect, useState, useRef } from 'react';
import { AdsProvider, useAds } from '../contexts/AdsContext';
import AdsAccountConnect from '../components/AdsAccountConnect';
import AdsCampaignView from '../components/AdsCampaignView';
import AdsAiPanel from '../components/AdsAiPanel';
import {
  Megaphone, RefreshCw, Loader2, ChevronLeft, ChevronRight,
  Eye,
  MousePointerClick, TrendingUp, Target, Wallet, Info,
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

function AdsContent() {
  const {
    accounts, selectedAccount, campaigns, kpi, dateRange,
    syncing, loading, lastSync,
    loadAccounts, selectAccount, setDateRange, refreshData, syncNow,
  } = useAds();
  const [showConnect, setShowConnect] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'ENABLED' | 'PAUSED'>('ENABLED');
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'status' | 'impressions' | 'clicks' | 'ctr' | 'cost' | 'conversions' | 'roas'>('cost');
  const [sortAsc, setSortAsc] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [campaignPage, setCampaignPage] = useState(0);
  const [perPage, setPerPage] = useState(10);
  const aiButtonRef = useRef<HTMLButtonElement>(null);
  const [alerts, setAlerts] = useState<AdsAlertRow[]>([]);

  // Reset page when filters change
  useEffect(() => { setCampaignPage(0); }, [statusFilter]);

  // Fetch alerts when account changes
  useEffect(() => {
    if (selectedAccount) {
      loadAlerts(selectedAccount.id);
    }
  }, [selectedAccount?.id]);

  // Listen for alert updates from sync
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
      // Open AI panel to show existing analysis
      setShowAiPanel(true);
    } else if (selectedAccount) {
      // Trigger new anomaly analysis
      try {
        const res = await window.electronAPI.adsRunAnalysis(selectedAccount.id, 'anomaly');
        if (res.success) {
          setShowAiPanel(true);
          // Reload alerts to get the linked AI analysis ID
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

  // Load data when accounts are loaded and first account is selected
  useEffect(() => {
    if (selectedAccount) {
      setDateRange(dateRange); // triggers loadData
    }
  }, [selectedAccount?.id]);

  const handleConnected = async () => {
    setShowConnect(false);
    setHasCredentials(true);
    await loadAccounts();
    // Force data refresh after account connection + sync
    await refreshData();
  };

  // Onboarding: no credentials or no accounts
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

            <div className="grid gap-3 text-left">
              <div className="flex items-start gap-3 bg-surface-900/50 rounded-lg p-3">
                <div className="w-6 h-6 rounded-full bg-teal/15 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[11px] font-bold text-teal">1</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-cream">Google Cloud Projekt beállítása</p>
                  <p className="text-xs text-steel mt-0.5">Hozz létre OAuth credentials-t a Google Cloud Console-on</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-surface-900/50 rounded-lg p-3">
                <div className="w-6 h-6 rounded-full bg-teal/15 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[11px] font-bold text-teal">2</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-cream">Developer Token + API kulcsok megadása</p>
                  <p className="text-xs text-steel mt-0.5">Add meg a Google Ads Developer Token-ed és az OAuth adatokat</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-surface-900/50 rounded-lg p-3">
                <div className="w-6 h-6 rounded-full bg-teal/15 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[11px] font-bold text-teal">3</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-cream">Fiók összekapcsolása</p>
                  <p className="text-xs text-steel mt-0.5">OAuth bejelentkezés után válaszd ki a kezelni kívánt fiókot</p>
                </div>
              </div>
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
          <AdsAccountConnect
            onClose={() => setShowConnect(false)}
            onConnected={handleConnected}
          />
        )}
      </>
    );
  }

  // Campaign detail view
  if (selectedCampaignId && selectedAccount) {
    return (
      <AdsCampaignView
        accountId={selectedAccount.id}
        campaignId={selectedCampaignId}
        onBack={() => setSelectedCampaignId(null)}
      />
    );
  }

  // Sort campaigns
  const filteredCampaigns = campaigns
    .filter(c => statusFilter === 'all' || c.status === statusFilter)
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = (a.name || '').localeCompare(b.name || '');
      else if (sortBy === 'type') cmp = (a.type || '').localeCompare(b.type || '');
      else if (sortBy === 'status') cmp = (a.status || '').localeCompare(b.status || '');
      else if (sortBy === 'impressions') cmp = (a.impressions || 0) - (b.impressions || 0);
      else if (sortBy === 'clicks') cmp = (a.clicks || 0) - (b.clicks || 0);
      else if (sortBy === 'ctr') {
        const ctrA = a.impressions ? a.clicks / a.impressions : 0;
        const ctrB = b.impressions ? b.clicks / b.impressions : 0;
        cmp = ctrA - ctrB;
      }
      else if (sortBy === 'cost') cmp = (a.cost_micros || 0) - (b.cost_micros || 0);
      else if (sortBy === 'conversions') cmp = (a.conversions || 0) - (b.conversions || 0);
      else if (sortBy === 'roas') {
        const roasA = a.cost_micros ? (a.conversions_value || 0) / (a.cost_micros / 1e6) : 0;
        const roasB = b.cost_micros ? (b.conversions_value || 0) / (b.cost_micros / 1e6) : 0;
        cmp = roasA - roasB;
      }
      return sortAsc ? cmp : -cmp;
    });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredCampaigns.length / perPage));
  const pagedCampaigns = filteredCampaigns.slice(campaignPage * perPage, (campaignPage + 1) * perPage);

  function handleSort(col: typeof sortBy) {
    if (sortBy === col) setSortAsc(!sortAsc);
    else { setSortBy(col); setSortAsc(false); }
    setCampaignPage(0);
  }

  const dateRangeOptions: { value: typeof dateRange; label: string }[] = [
    { value: '7d', label: '7 nap' },
    { value: '14d', label: '14 nap' },
    { value: '30d', label: '30 nap' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-pixel text-xl text-cream">Áttekintés</h1>
          <p className="text-steel text-sm mt-1">Kampányteljesítmény és AI elemzés</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Last sync */}
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

          {/* Date range */}
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
            onClick={() => setShowConnect(true)}
            className="p-2 bg-surface-800/50 border border-teal/10 rounded-lg text-steel hover:text-cream transition-colors cursor-pointer"
            title="Fiók beállítások"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          HERO — Cost + ROAS highlight
         ══════════════════════════════════════════════════════════ */}
      {loading && !kpi ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-teal" />
        </div>
      ) : kpi ? (
        <>
          {/* ══════════════════════════════════════════════════════════
              ALERT BANNER
             ══════════════════════════════════════════════════════════ */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-sm font-medium text-cream">
                  {alerts.length} figyelmeztetés
                </span>
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
                            {alert.campaignName && (
                              <span className="text-xs text-cream font-medium truncate">{alert.campaignName}</span>
                            )}
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

          {/* ══════════════════════════════════════════════════════════
              KPI Cards (4 cols)
             ══════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {(() => {
              const ctr = kpi.impressions ? (kpi.clicks || 0) / kpi.impressions : 0;
              const roas = kpi.cost_micros ? (kpi.conversions_value || 0) / (kpi.cost_micros / 1e6) : 0;
              const cpa = kpi.conversions ? (kpi.cost_micros || 0) / 1e6 / kpi.conversions : 0;
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
        </>
      ) : null}

      {/* ══════════════════════════════════════════════════════════
          CAMPAIGN TABLE
         ══════════════════════════════════════════════════════════ */}
      <div className="bg-surface-800/50 rounded-xl border border-teal/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-pixel text-sm text-cream">
            Kampányok
            <span className="ml-2 text-xs text-steel font-sans">({filteredCampaigns.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            {/* Status filter */}
            {(['all', 'ENABLED', 'PAUSED'] as const).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${statusFilter === f ? 'bg-teal/15 text-cream font-medium' : 'text-steel hover:text-cream'}`}
              >
                {f === 'all' ? 'Mind' : f === 'ENABLED' ? 'Aktív' : 'Szüneteltetve'}
              </button>
            ))}
            {/* Per page selector */}
            <select
              value={perPage}
              onChange={e => { setPerPage(Number(e.target.value)); setCampaignPage(0); }}
              className="text-xs px-2 py-1 bg-surface-900 border border-teal/10 rounded-md text-steel focus:outline-none focus:ring-1 focus:ring-teal/30"
            >
              <option value={5}>5 / oldal</option>
              <option value={10}>10 / oldal</option>
              <option value={25}>25 / oldal</option>
              <option value={50}>50 / oldal</option>
            </select>
          </div>
        </div>

        {filteredCampaigns.length === 0 ? (
          <div className="text-center py-12">
            <Megaphone className="w-8 h-8 text-steel/20 mx-auto mb-3" />
            <p className="text-sm text-steel/60 italic">
              {campaigns.length === 0 ? 'Nincs kampány adat. Futtasd a szinkronizációt.' : 'Nincs a szűrésnek megfelelő kampány.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-teal/10">
                    <th className="text-left py-2 px-3 text-xs font-medium text-steel/60 cursor-pointer hover:text-cream" onClick={() => handleSort('name')}>
                      <span className="inline-flex items-center gap-1 whitespace-nowrap">Kampány{sortBy === 'name' && <span>{sortAsc ? '↑' : '↓'}</span>}</span>
                    </th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-steel/60 w-24 cursor-pointer hover:text-cream" onClick={() => handleSort('type')}>
                      <span className="inline-flex items-center justify-center gap-1 whitespace-nowrap">Típus{sortBy === 'type' && <span>{sortAsc ? '↑' : '↓'}</span>}</span>
                    </th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-steel/60 w-16 cursor-pointer hover:text-cream" onClick={() => handleSort('status')}>
                      <span className="inline-flex items-center justify-center gap-1 whitespace-nowrap">Státusz{sortBy === 'status' && <span>{sortAsc ? '↑' : '↓'}</span>}</span>
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-steel/60 w-24 cursor-pointer hover:text-cream" onClick={() => handleSort('impressions')}>
                      <span className="inline-flex items-center justify-end gap-1 whitespace-nowrap w-full">Megjelenítés{sortBy === 'impressions' && <span>{sortAsc ? '↑' : '↓'}</span>}</span>
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-steel/60 w-20 cursor-pointer hover:text-cream" onClick={() => handleSort('clicks')}>
                      <span className="inline-flex items-center justify-end gap-1 whitespace-nowrap w-full">Kattintás{sortBy === 'clicks' && <span>{sortAsc ? '↑' : '↓'}</span>}</span>
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-steel/60 w-16 cursor-pointer hover:text-cream" onClick={() => handleSort('ctr')}>
                      <span className="inline-flex items-center justify-end gap-1 whitespace-nowrap w-full">CTR{sortBy === 'ctr' && <span>{sortAsc ? '↑' : '↓'}</span>}</span>
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-steel/60 w-24 cursor-pointer hover:text-cream" onClick={() => handleSort('cost')}>
                      <span className="inline-flex items-center justify-end gap-1 whitespace-nowrap w-full">Költés{sortBy === 'cost' && <span>{sortAsc ? '↑' : '↓'}</span>}</span>
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-steel/60 w-20 cursor-pointer hover:text-cream" onClick={() => handleSort('conversions')}>
                      <span className="inline-flex items-center justify-end gap-1 whitespace-nowrap w-full">Konv.{sortBy === 'conversions' && <span>{sortAsc ? '↑' : '↓'}</span>}</span>
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-steel/60 w-16 cursor-pointer hover:text-cream" onClick={() => handleSort('roas')}>
                      <span className="inline-flex items-center justify-end gap-1 whitespace-nowrap w-full">ROAS{sortBy === 'roas' && <span>{sortAsc ? '↑' : '↓'}</span>}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedCampaigns.map(c => {
                    const ctr = c.impressions ? (c.clicks / c.impressions) : 0;
                    const roas = c.cost_micros ? (c.conversions_value / (c.cost_micros / 1e6)) : 0;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedCampaignId(c.campaign_id)}
                        className="border-b border-teal/5 hover:bg-teal/5 cursor-pointer transition-colors duration-150 ease-out"
                      >
                        <td className="py-2.5 px-3 text-cream font-medium truncate max-w-[240px]">{c.name}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="text-[10px] bg-surface-900/60 text-steel px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
                            {c.type?.replace('_', ' ') || '–'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${c.status === 'ENABLED' ? 'bg-emerald-400' : 'bg-steel/40'}`} />
                        </td>
                        <td className="py-2.5 px-3 text-right text-steel">{(c.impressions || 0).toLocaleString('hu-HU')}</td>
                        <td className="py-2.5 px-3 text-right text-steel">{(c.clicks || 0).toLocaleString('hu-HU')}</td>
                        <td className="py-2.5 px-3 text-right text-steel">{formatPercent(ctr)}</td>
                        <td className="py-2.5 px-3 text-right text-cream font-medium">{formatMicros(c.cost_micros || 0)} Ft</td>
                        <td className="py-2.5 px-3 text-right text-steel">{(c.conversions || 0).toFixed(1)}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`font-medium ${roas >= 3 ? 'text-emerald-400' : roas >= 1 ? 'text-cream' : 'text-red-400'}`}>
                            {roas ? roas.toFixed(2) + 'x' : '–'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-teal/10">
                <p className="text-xs text-steel/60">
                  {campaignPage * perPage + 1}–{Math.min((campaignPage + 1) * perPage, filteredCampaigns.length)} / {filteredCampaigns.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCampaignPage(p => Math.max(0, p - 1))}
                    disabled={campaignPage === 0}
                    className="p-1 rounded hover:bg-teal/10 text-steel hover:text-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-steel min-w-[3rem] text-center">{campaignPage + 1} / {totalPages}</span>
                  <button
                    onClick={() => setCampaignPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={campaignPage >= totalPages - 1}
                    className="p-1 rounded hover:bg-teal/10 text-steel hover:text-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modals ── */}
      {showConnect && (
        <AdsAccountConnect
          onClose={() => setShowConnect(false)}
          onConnected={handleConnected}
        />
      )}

      {showAiPanel && selectedAccount && (
        <AdsAiPanel
          accountId={selectedAccount.id}
          onClose={() => setShowAiPanel(false)}
          anchorRef={aiButtonRef}
        />
      )}
    </div>
  );
}

export default function Ads() {
  return (
    <AdsProvider>
      <AdsContent />
    </AdsProvider>
  );
}
