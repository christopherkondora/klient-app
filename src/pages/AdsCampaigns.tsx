import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAds } from '../contexts/AdsContext';
import {
  Megaphone, ChevronLeft, ChevronRight,
} from 'lucide-react';

function formatMicros(micros: number): string {
  return Math.round(micros / 1_000_000).toLocaleString('hu-HU');
}

function formatPercent(value: number): string {
  return (value * 100).toFixed(2) + '%';
}

function AdsCampaignsContent() {
  const { campaigns, selectedAccount, loading } = useAds();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<'all' | 'ENABLED' | 'PAUSED'>('ENABLED');
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'status' | 'impressions' | 'clicks' | 'ctr' | 'cost' | 'conversions' | 'roas'>('cost');
  const [sortAsc, setSortAsc] = useState(false);
  const [campaignPage, setCampaignPage] = useState(0);
  const [perPage, setPerPage] = useState(10);

  useEffect(() => { setCampaignPage(0); }, [statusFilter]);

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

  const totalPages = Math.max(1, Math.ceil(filteredCampaigns.length / perPage));
  const pagedCampaigns = filteredCampaigns.slice(campaignPage * perPage, (campaignPage + 1) * perPage);

  function handleSort(col: typeof sortBy) {
    if (sortBy === col) setSortAsc(!sortAsc);
    else { setSortBy(col); setSortAsc(false); }
    setCampaignPage(0);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-pixel text-xl text-cream">Kampányok</h1>
        <p className="text-steel text-sm mt-1">Összes kampány kezelése és elemzése</p>
      </div>

      <div className="bg-surface-800/50 rounded-xl border border-teal/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-pixel text-sm text-cream">
            Kampányok
            <span className="ml-2 text-xs text-steel font-sans">({filteredCampaigns.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            {(['all', 'ENABLED', 'PAUSED'] as const).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${statusFilter === f ? 'bg-teal/15 text-cream font-medium' : 'text-steel hover:text-cream'}`}
              >
                {f === 'all' ? 'Mind' : f === 'ENABLED' ? 'Aktív' : 'Szüneteltetve'}
              </button>
            ))}
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
                        onClick={() => navigate(`/ads/campaigns/${c.campaign_id}`)}
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
    </div>
  );
}

export default function AdsCampaigns() {
  return <AdsCampaignsContent />;
}
