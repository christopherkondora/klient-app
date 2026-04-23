import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Megaphone, TrendingUp, TrendingDown, MousePointerClick, Eye, Target, DollarSign, ExternalLink, Loader2, Unlink2 } from 'lucide-react';

interface Props {
  clientId: string;
  onUnlink?: () => void;
}

function formatMicros(micros: number): string {
  return Math.round(micros / 1_000_000).toLocaleString('hu-HU') + ' Ft';
}

function pctChange(current: number, previous: number): { value: string; positive: boolean } | null {
  if (!previous) return null;
  const pct = ((current - previous) / previous) * 100;
  return { value: (pct > 0 ? '+' : '') + pct.toFixed(1) + '%', positive: pct >= 0 };
}

function ctr(clicks: number, impressions: number): string {
  if (!impressions) return '0%';
  return ((clicks / impressions) * 100).toFixed(2) + '%';
}

export default function ClientAdsTab({ clientId, onUnlink }: Props) {
  const navigate = useNavigate();
  const [data, setData] = useState<AdsClientSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await window.electronAPI.adsGetClientAdsSummary(clientId);
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.error || 'Nem sikerült betölteni');
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-steel/40" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <Megaphone className="w-8 h-8 text-steel/20 mx-auto mb-3" />
        <p className="text-sm text-steel/60 italic">{error || 'Nincs adat'}</p>
      </div>
    );
  }

  const { kpi, prevCostMicros, prevConversions, campaigns, dailyCost } = data;
  const costDelta = pctChange(kpi.cost_micros, prevCostMicros);
  const convDelta = pctChange(kpi.conversions, prevConversions);

  // Sparkline: normalize dailyCost to 0-1 for SVG
  const maxCost = Math.max(...dailyCost.map(d => d.cost_micros), 1);
  const sparkPoints = dailyCost.map((d, i) => {
    const x = (i / Math.max(dailyCost.length - 1, 1)) * 100;
    const y = 100 - (d.cost_micros / maxCost) * 100;
    return `${x},${y}`;
  }).join(' ');

  const kpis = [
    { label: 'Költés (30 nap)', value: formatMicros(kpi.cost_micros), icon: DollarSign, delta: costDelta },
    { label: 'Konverziók', value: kpi.conversions.toLocaleString('hu-HU'), icon: Target, delta: convDelta },
    { label: 'Kattintások', value: kpi.clicks.toLocaleString('hu-HU'), icon: MousePointerClick, delta: null },
    { label: 'Megjelenések', value: kpi.impressions.toLocaleString('hu-HU'), icon: Eye, delta: null },
    { label: 'CTR', value: ctr(kpi.clicks, kpi.impressions), icon: TrendingUp, delta: null },
  ];

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="bg-surface-800/50 rounded-lg border border-teal/10 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <k.icon className="w-3.5 h-3.5 text-teal" />
              <span className="text-[10px] tracking-wider text-steel/50 font-medium">{k.label.toUpperCase()}</span>
            </div>
            <p className="text-lg font-bold text-cream">{k.value}</p>
            {k.delta && (
              <span className={`text-[10px] font-medium ${k.delta.positive ? 'text-emerald-400' : 'text-red-400'}`}>
                {k.delta.value} vs előző 30 nap
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Sparkline + Campaigns side by side */}
      <div className="grid grid-cols-12 gap-4">
        {/* Sparkline */}
        <div className="col-span-5 bg-surface-800/50 rounded-lg border border-teal/10 p-4">
          <p className="text-[10px] tracking-wider text-steel/50 font-medium mb-3">NAPI KÖLTÉS (30 NAP)</p>
          {dailyCost.length > 1 ? (
            <svg viewBox="0 0 100 100" className="w-full h-24" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon
                points={`0,100 ${sparkPoints} 100,100`}
                fill="url(#sparkGrad)"
              />
              <polyline
                points={sparkPoints}
                fill="none"
                stroke="#14b8a6"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          ) : (
            <p className="text-xs text-steel/40 italic text-center py-6">Nincs elég adat</p>
          )}
        </div>

        {/* Campaigns */}
        <div className="col-span-7 bg-surface-800/50 rounded-lg border border-teal/10 p-4">
          <p className="text-[10px] tracking-wider text-steel/50 font-medium mb-3">TOP KAMPÁNYOK</p>
          {campaigns.length === 0 ? (
            <p className="text-xs text-steel/40 italic text-center py-6">Nincsenek kampányok</p>
          ) : (
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {campaigns.slice(0, 8).map(c => (
                <div key={c.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-surface-900/30 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.status === 'ENABLED' ? 'bg-emerald-400' : 'bg-steel/30'}`} />
                    <span className="text-xs text-cream/80 truncate">{c.name}</span>
                  </div>
                  <span className="text-xs text-steel/60 shrink-0 ml-3">{formatMicros(c.cost_micros)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/ads')}
          className="flex items-center gap-2 text-xs text-teal hover:text-cyan-400 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Megnyitás a Google Ads modulban
        </button>
        {onUnlink && (
          <button
            disabled={unlinking}
            onClick={async () => {
              setUnlinking(true);
              try {
                for (const acc of data!.accounts) {
                  await window.electronAPI.adsLinkAccount(acc.id, null);
                }
                onUnlink();
              } finally {
                setUnlinking(false);
              }
            }}
            className="flex items-center gap-1.5 text-xs text-steel/40 hover:text-red-400 transition-colors"
          >
            {unlinking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink2 className="w-3 h-3" />}
            Fiók leválasztása
          </button>
        )}
      </div>
    </div>
  );
}
