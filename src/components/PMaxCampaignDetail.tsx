import { useEffect, useState, useMemo } from 'react';
import { Loader2, Info, Search } from 'lucide-react';
import Pagination from './Pagination';

interface Props {
  accountId: string;
  campaignId: string;
}

type Tab = 'channels' | 'asset_groups' | 'asset_quality' | 'products' | 'placements';

const TABS: { key: Tab; label: string }[] = [
  { key: 'channels', label: 'Csatorna bontás' },
  { key: 'asset_groups', label: 'Asset groupok' },
  { key: 'asset_quality', label: 'Asset minősítés' },
  { key: 'products', label: 'Termékek' },
  { key: 'placements', label: 'Elhelyezések' },
];

const AD_STRENGTH_COLORS: Record<string, string> = {
  EXCELLENT: 'text-emerald-400',
  GOOD: 'text-blue-400',
  AVERAGE: 'text-amber-400',
  POOR: 'text-red-400',
  UNSPECIFIED: 'text-steel/50',
};

const AD_STRENGTH_LABELS: Record<string, string> = {
  EXCELLENT: 'Kiváló',
  GOOD: 'Jó',
  AVERAGE: 'Közepes',
  POOR: 'Gyenge',
  UNSPECIFIED: 'N/A',
};

const PERF_COLORS: Record<string, string> = {
  BEST: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  GOOD: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  LOW: 'bg-red-500/15 text-red-400 border-red-500/20',
  LEARNING: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  UNSPECIFIED: 'bg-surface-800 text-steel/50 border-teal/5',
};

function formatMicros(micros: number): string {
  return Math.round(micros / 1_000_000).toLocaleString('hu-HU');
}

function calcROAS(convValue: number, costMicros: number): number {
  const cost = costMicros / 1_000_000;
  return cost > 0 ? convValue / cost : 0;
}

export default function PMaxCampaignDetail({ accountId, campaignId }: Props) {
  const [tab, setTab] = useState<Tab>('channels');
  const [loading, setLoading] = useState(false);

  const [assetGroups, setAssetGroups] = useState<AdsAssetGroupRow[]>([]);
  const [assets, setAssets] = useState<AdsAssetGroupAssetRow[]>([]);
  const [shopping, setShopping] = useState<AdsShoppingPerformanceRow[]>([]);
  const [placements, setPlacements] = useState<AdsPlacementRow[]>([]);

  const [prodSearch, setProdSearch] = useState('');
  const [prodPage, setProdPage] = useState(1);

  useEffect(() => {
    loadTabData(tab);
  }, [tab, accountId, campaignId]);

  async function loadTabData(t: Tab) {
    setLoading(true);
    try {
      if ((t === 'channels' || t === 'asset_groups') && assetGroups.length === 0) {
        const res = await window.electronAPI.adsGetAssetGroups(accountId, campaignId);
        if (res.success && res.data) setAssetGroups(res.data);
      }
      if (t === 'asset_quality' && assets.length === 0) {
        if (assetGroups.length === 0) {
          const agRes = await window.electronAPI.adsGetAssetGroups(accountId, campaignId);
          if (agRes.success && agRes.data) setAssetGroups(agRes.data);
        }
        const res = await window.electronAPI.adsGetAssetGroupAssets(accountId, campaignId);
        if (res.success && res.data) setAssets(res.data);
      }
      if (t === 'products' && shopping.length === 0) {
        const res = await window.electronAPI.adsGetShoppingPerformance(accountId, campaignId);
        if (res.success && res.data) setShopping(res.data);
      }
      if (t === 'placements' && placements.length === 0) {
        const res = await window.electronAPI.adsGetPlacements(accountId, campaignId);
        if (res.success && res.data) setPlacements(res.data);
      }
    } finally {
      setLoading(false);
    }
  }

  // Channel breakdown from asset groups aggregate
  const channelData = useMemo(() => {
    const totalCost = assetGroups.reduce((s, ag) => s + ag.cost_micros, 0);
    const totalClicks = assetGroups.reduce((s, ag) => s + ag.clicks, 0);
    const totalImpressions = assetGroups.reduce((s, ag) => s + ag.impressions, 0);
    const totalConversions = assetGroups.reduce((s, ag) => s + ag.conversions, 0);
    const totalConvValue = assetGroups.reduce((s, ag) => s + ag.conversions_value, 0);
    return { totalCost, totalClicks, totalImpressions, totalConversions, totalConvValue };
  }, [assetGroups]);

  // Asset groups by field type
  const assetsByType = useMemo(() => {
    const map = new Map<string, AdsAssetGroupAssetRow[]>();
    for (const a of assets) {
      const type = a.field_type || 'UNKNOWN';
      if (!map.has(type)) map.set(type, []);
      map.get(type)!.push(a);
    }
    return map;
  }, [assets]);

  // Filtered shopping products
  const filteredProducts = useMemo(() => {
    if (!prodSearch) return shopping;
    const q = prodSearch.toLowerCase();
    return shopping.filter(s => s.product_title?.toLowerCase().includes(q) || s.product_item_id?.toLowerCase().includes(q));
  }, [shopping, prodSearch]);

  const prodPageItems = filteredProducts.slice((prodPage - 1) * 25, prodPage * 25);

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex bg-surface-900/40 border border-teal/8 rounded-xl overflow-hidden">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
              tab === t.key
                ? 'bg-teal/10 text-cream border-b-2 border-teal'
                : 'text-steel hover:text-cream hover:bg-surface-800/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-teal" />
        </div>
      )}

      {/* Channel breakdown tab */}
      {!loading && tab === 'channels' && (
        <div className="space-y-3">
          {assetGroups.length === 0 ? (
            <div className="bg-surface-900/40 border border-teal/8 rounded-xl p-8 text-center">
              <p className="text-sm text-steel">Nem elérhető csatorna bontás adat</p>
              <p className="text-[11px] text-steel/50 mt-1">A Performance Max kampányok korlátozott csatorna szintű adatot szolgáltatnak az API-n keresztül.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <ChannelCard label="Megjelenítés" value={channelData.totalImpressions.toLocaleString('hu-HU')} />
                <ChannelCard label="Kattintás" value={channelData.totalClicks.toLocaleString('hu-HU')} />
                <ChannelCard label="Költés" value={`${formatMicros(channelData.totalCost)} Ft`} />
                <ChannelCard label="Konverzió" value={channelData.totalConversions.toFixed(1)} />
                <ChannelCard label="ROAS" value={`${calcROAS(channelData.totalConvValue, channelData.totalCost).toFixed(2)}×`} />
              </div>
              <div className="bg-surface-900/40 border border-teal/8 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-400/60 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-steel/70">
                    A Performance Max kampányok részletes csatorna bontása (Search, Display, YouTube, Gmail, Maps) jelenleg nem érhető el a Google Ads API-n keresztül. A fenti összesített adatok az összes csatornát tartalmazzák.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Asset groups tab */}
      {!loading && tab === 'asset_groups' && (
        <div className="space-y-3">
          {assetGroups.length === 0 ? (
            <div className="bg-surface-900/40 border border-teal/8 rounded-xl p-8 text-center">
              <p className="text-sm text-steel">Nincs asset group adat</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {assetGroups.map(ag => {
                const roas = calcROAS(ag.conversions_value, ag.cost_micros);
                return (
                  <div key={ag.id} className="bg-surface-900/40 border border-teal/8 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-cream">{ag.name}</h4>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${ag.status === 'ENABLED' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                        {ag.status === 'ENABLED' ? 'Aktív' : ag.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-steel/50 uppercase">Erősség:</span>
                      <span className={`text-xs font-medium ${AD_STRENGTH_COLORS[ag.ad_strength || ''] || 'text-steel/50'}`}>
                        {AD_STRENGTH_LABELS[ag.ad_strength || ''] || ag.ad_strength || 'N/A'}
                      </span>
                      <AdStrengthBar strength={ag.ad_strength} />
                    </div>
                    <div className="grid grid-cols-4 gap-2 pt-2 border-t border-teal/5">
                      <MetricCell label="Kattintás" value={ag.clicks.toLocaleString('hu-HU')} />
                      <MetricCell label="Költés" value={`${formatMicros(ag.cost_micros)} Ft`} />
                      <MetricCell label="Konverzió" value={ag.conversions.toFixed(1)} />
                      <MetricCell label="ROAS" value={`${roas.toFixed(2)}×`} highlight={roas >= 3 ? 'green' : roas >= 1 ? 'amber' : 'red'} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Asset quality tab */}
      {!loading && tab === 'asset_quality' && (
        <div className="space-y-3">
          {assets.length === 0 ? (
            <div className="bg-surface-900/40 border border-teal/8 rounded-xl p-8 text-center">
              <p className="text-sm text-steel">Nincs asset minősítési adat</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from(assetsByType.entries()).map(([type, items]) => (
                  <div key={type} className="bg-surface-900/40 border border-teal/8 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-teal/8 flex items-center justify-between">
                      <h4 className="text-xs font-medium text-cream">{formatFieldType(type)}</h4>
                      <span className="text-[10px] text-steel/50">{items.length} asset</span>
                    </div>
                    <div className="p-3 space-y-2">
                      {items.map((a, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${PERF_COLORS[a.performance_label || 'UNSPECIFIED']}`}>
                            {a.performance_label || '–'}
                          </span>
                          <span className="text-[11px] text-cream truncate flex-1" title={a.asset_text || a.asset_name || '–'}>
                            {a.asset_text || a.asset_name || '–'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-surface-900/40 border border-teal/8 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-400/60 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-steel/70">
                    A Performance Max asset minősítés a Google gépi tanulási modelljein alapul. A BEST jelölésű assetek a legjobban teljesítenek, a LOW jelölésűek cseréje ajánlott. A LEARNING állapot azt jelzi, hogy a rendszer még gyűjti az adatokat.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Products tab */}
      {!loading && tab === 'products' && (
        <div className="bg-surface-900/40 border border-teal/8 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-teal/8 flex items-center gap-3">
            <div className="relative flex-1 max-w-[300px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-steel/50" />
              <input
                type="text"
                placeholder="Termék keresés..."
                value={prodSearch}
                onChange={e => { setProdSearch(e.target.value); setProdPage(1); }}
                className="w-full pl-8 pr-3 py-1.5 text-[11px] bg-surface-900 border border-teal/10 rounded-lg text-cream placeholder:text-steel/40 focus:outline-none focus:border-teal/30"
              />
            </div>
            <span className="text-[11px] text-steel/50">Utolsó 30 nap · Top 100</span>
          </div>
          {filteredProducts.length === 0 ? (
            <p className="text-sm text-steel text-center py-8">Nincs termék teljesítmény adat</p>
          ) : (
            <>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-teal/8 text-steel/60 uppercase tracking-wider">
                    <th className="text-left px-4 py-2 font-medium">Termék</th>
                    <th className="text-right px-2 py-2 font-medium w-24">Megjelenítés</th>
                    <th className="text-right px-2 py-2 font-medium w-20">Kattintás</th>
                    <th className="text-right px-2 py-2 font-medium w-24">Költés</th>
                    <th className="text-right px-2 py-2 font-medium w-20">Konverzió</th>
                    <th className="text-right px-4 py-2 font-medium w-20">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {prodPageItems.map((s, i) => {
                    const roas = calcROAS(s.conversions_value, s.cost_micros);
                    return (
                      <tr key={i} className="border-b border-teal/5 hover:bg-surface-800/30">
                        <td className="px-4 py-2.5">
                          <p className="text-cream truncate max-w-[300px]" title={s.product_title || ''}>{s.product_title || '–'}</p>
                          <p className="text-[10px] text-steel/40">{s.product_item_id}</p>
                        </td>
                        <td className="px-2 py-2.5 text-right text-steel">{s.impressions.toLocaleString('hu-HU')}</td>
                        <td className="px-2 py-2.5 text-right text-steel">{s.clicks.toLocaleString('hu-HU')}</td>
                        <td className="px-2 py-2.5 text-right text-steel">{formatMicros(s.cost_micros)} Ft</td>
                        <td className="px-2 py-2.5 text-right text-steel">{s.conversions.toFixed(1)}</td>
                        <td className={`px-4 py-2.5 text-right font-medium ${roas >= 3 ? 'text-emerald-400' : roas >= 1 ? 'text-amber-400' : 'text-red-400'}`}>
                          {roas.toFixed(2)}×
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination
                currentPage={prodPage}
                totalItems={filteredProducts.length}
                itemsPerPage={25}
                onPageChange={setProdPage}
              />
            </>
          )}
        </div>
      )}

      {/* Placements tab */}
      {!loading && tab === 'placements' && (
        <div className="bg-surface-900/40 border border-teal/8 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-teal/8">
            <span className="text-[11px] text-steel/50">Top 50 elhelyezés · Utolsó 30 nap</span>
          </div>
          {placements.length === 0 ? (
            <p className="text-sm text-steel text-center py-8">Nincs elhelyezés adat</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-teal/8 text-steel/60 uppercase tracking-wider">
                  <th className="text-left px-4 py-2 font-medium">Elhelyezés</th>
                  <th className="text-center px-2 py-2 font-medium w-24">Típus</th>
                  <th className="text-right px-2 py-2 font-medium w-24">Megjelenítés</th>
                  <th className="text-right px-2 py-2 font-medium w-20">Kattintás</th>
                  <th className="text-right px-4 py-2 font-medium w-24">Költés</th>
                </tr>
              </thead>
              <tbody>
                {placements.map((p, i) => (
                  <tr key={i} className="border-b border-teal/5 hover:bg-surface-800/30">
                    <td className="px-4 py-2.5">
                      <p className="text-cream truncate max-w-[300px]" title={p.display_name || ''}>{p.display_name || '–'}</p>
                      {p.target_url && <p className="text-[10px] text-steel/40 truncate max-w-[300px]">{p.target_url}</p>}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className="text-[10px] bg-surface-800 text-steel px-1.5 py-0.5 rounded">{p.placement_type || '–'}</span>
                    </td>
                    <td className="px-2 py-2.5 text-right text-steel">{p.impressions.toLocaleString('hu-HU')}</td>
                    <td className="px-2 py-2.5 text-right text-steel">{p.clicks.toLocaleString('hu-HU')}</td>
                    <td className="px-4 py-2.5 text-right text-steel">{formatMicros(p.cost_micros)} Ft</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function ChannelCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-900/40 border border-teal/8 rounded-xl p-3 text-center">
      <p className="text-[10px] text-steel/50 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-cream mt-1">{value}</p>
    </div>
  );
}

function MetricCell({ label, value, highlight }: { label: string; value: string; highlight?: 'green' | 'amber' | 'red' }) {
  const colorMap = { green: 'text-emerald-400', amber: 'text-amber-400', red: 'text-red-400' };
  return (
    <div className="text-center">
      <p className="text-[9px] text-steel/50 uppercase">{label}</p>
      <p className={`text-xs font-medium mt-0.5 ${highlight ? colorMap[highlight] : 'text-cream'}`}>{value}</p>
    </div>
  );
}

function AdStrengthBar({ strength }: { strength: string | null }) {
  const levels: Record<string, number> = { POOR: 1, AVERAGE: 2, GOOD: 3, EXCELLENT: 4 };
  const level = levels[strength || ''] || 0;
  const colors = ['bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-emerald-400'];
  return (
    <div className="flex gap-0.5">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className={`w-4 h-1.5 rounded-full ${i < level ? colors[level - 1] : 'bg-surface-700'}`} />
      ))}
    </div>
  );
}

function formatFieldType(type: string): string {
  const labels: Record<string, string> = {
    HEADLINE: 'Címsorok',
    DESCRIPTION: 'Leírások',
    LONG_HEADLINE: 'Hosszú címsor',
    MARKETING_IMAGE: 'Marketing képek',
    SQUARE_MARKETING_IMAGE: 'Négyzet képek',
    LOGO: 'Logók',
    LANDSCAPE_LOGO: 'Fekvő logó',
    YOUTUBE_VIDEO: 'YouTube videók',
    CALL_TO_ACTION_SELECTION: 'CTA választás',
    BUSINESS_NAME: 'Cégnév',
  };
  return labels[type] || type.replace(/_/g, ' ');
}
