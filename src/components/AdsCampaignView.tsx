import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import AdsAiPanel from './AdsAiPanel';
import SearchCampaignDetail from './SearchCampaignDetail';
import PMaxCampaignDetail from './PMaxCampaignDetail';

interface Props {
  accountId: string;
  campaignId: string;
  onBack: () => void;
}

function formatMicros(micros: number): string {
  return Math.round(micros / 1_000_000).toLocaleString('hu-HU');
}

export default function AdsCampaignView({ accountId, campaignId, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [dailyMetrics, setDailyMetrics] = useState<AdsDailyMetricRow[]>([]);
  const [campaign, setCampaign] = useState<AdsCampaignRow | null>(null);
  const [metricType, setMetricType] = useState<'impressions' | 'clicks' | 'cost'>('clicks');
  const [showAiPanel, setShowAiPanel] = useState(false);

  useEffect(() => {
    loadData();
  }, [accountId, campaignId]);

  async function loadData() {
    setLoading(true);
    try {
      const endDate = new Date().toISOString().slice(0, 10);
      const startDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

      const [campRes, metricsRes] = await Promise.all([
        window.electronAPI.adsGetCampaigns(accountId),
        window.electronAPI.adsGetDailyMetrics(accountId, 'campaign', campaignId, startDate, endDate),
      ]);

      if (campRes.success && campRes.data) {
        setCampaign(campRes.data.find(c => c.campaign_id === campaignId) || null);
      }
      if (metricsRes.success && metricsRes.data) setDailyMetrics(metricsRes.data);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-teal" />
      </div>
    );
  }

  const chartData = dailyMetrics.map(m => ({
    date: m.date.slice(5), // MM-DD
    impressions: m.impressions,
    clicks: m.clicks,
    cost: Math.round(m.cost_micros / 1_000_000),
  }));

  const metricOptions: { key: typeof metricType; label: string; color: string }[] = [
    { key: 'clicks', label: 'Kattintások', color: '#34d399' },
    { key: 'impressions', label: 'Megjelenítések', color: '#60a5fa' },
    { key: 'cost', label: 'Költés (Ft)', color: '#fb923c' },
  ];

  const activeMetric = metricOptions.find(m => m.key === metricType)!;

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 bg-surface-900 border border-teal/10 rounded-lg text-steel hover:text-cream transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-cream">{campaign?.name || 'Kampány'}</h2>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[11px] bg-surface-800 text-steel px-1.5 py-0.5 rounded">
              {campaign?.type?.replace('_', ' ') || '–'}
            </span>
            <span className="flex items-center gap-1.5 text-[11px]">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${campaign?.status === 'ENABLED' ? 'bg-emerald-400' : 'bg-steel/40'}`} />
              <span className={campaign?.status === 'ENABLED' ? 'text-emerald-400' : 'text-steel'}>{campaign?.status === 'ENABLED' ? 'Aktív' : 'Szüneteltetve'}</span>
            </span>
            {campaign?.budget_amount_micros && (
              <span className="text-[11px] text-steel">
                Budget: {formatMicros(campaign.budget_amount_micros)} Ft / {campaign.budget_type === 'DAILY' ? 'nap' : 'össz.'}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowAiPanel(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal/10 border border-teal/20 rounded-lg text-xs text-teal hover:bg-teal/20 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Elemezd ezt a kampányt
        </button>
      </div>

      {/* Daily metrics chart */}
      <div className="bg-surface-900/40 border border-teal/8 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-cream">Napi metrikák (utolsó 30 nap)</h3>
          <div className="flex bg-surface-900 border border-teal/10 rounded-lg overflow-hidden">
            {metricOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => setMetricType(opt.key)}
                className={`px-3 py-1 text-[11px] transition-colors ${metricType === opt.key ? 'bg-teal/15 text-cream font-medium' : 'text-steel hover:text-cream'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8a9ab5' }} />
              <YAxis tick={{ fontSize: 10, fill: '#8a9ab5' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1e2e', border: '1px solid rgba(45,212,191,0.15)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Line
                type="monotone"
                dataKey={metricType}
                stroke={activeMetric.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-steel text-center py-8">Nincs metrika adat erre az időszakra</p>
        )}
      </div>

      {/* Campaign type-specific detail */}
      {campaign?.type === 'SEARCH' && (
        <SearchCampaignDetail accountId={accountId} campaignId={campaignId} />
      )}
      {campaign?.type === 'PERFORMANCE_MAX' && (
        <PMaxCampaignDetail accountId={accountId} campaignId={campaignId} />
      )}
      {campaign && campaign.type !== 'SEARCH' && campaign.type !== 'PERFORMANCE_MAX' && (
        <div className="bg-surface-900/40 border border-teal/8 rounded-xl p-6 text-center">
          <p className="text-sm text-steel">
            A(z) <span className="text-cream font-medium">{campaign.type?.replace('_', ' ')}</span> típusú kampányokhoz jelenleg nem érhető el részletes nézet.
          </p>
        </div>
      )}

      {showAiPanel && (
        <AdsAiPanel
          accountId={accountId}
          onClose={() => setShowAiPanel(false)}
          initialType="performance"
        />
      )}
    </div>
  );
}
