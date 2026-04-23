import { useEffect, useState, useMemo, useRef } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import Pagination from './Pagination';

interface Props {
  accountId: string;
  campaignId: string;
}

type Tab = 'keywords' | 'ads' | 'search_terms' | 'negative';

const TABS: { key: Tab; label: string }[] = [
  { key: 'keywords', label: 'Kulcsszavak' },
  { key: 'ads', label: 'Hirdetésszövegek' },
  { key: 'search_terms', label: 'Keresési kifejezések' },
  { key: 'negative', label: 'Negatív kulcsszavak' },
];

const QS_COLORS: Record<string, string> = {
  ABOVE_AVERAGE: 'text-emerald-400',
  AVERAGE: 'text-amber-400',
  BELOW_AVERAGE: 'text-red-400',
};

const QS_LABELS: Record<string, string> = {
  ABOVE_AVERAGE: 'Átlag felett',
  AVERAGE: 'Átlagos',
  BELOW_AVERAGE: 'Átlag alatt',
};

const MATCH_TYPE_COLORS: Record<string, string> = {
  EXACT: 'bg-blue-500/15 text-blue-400',
  PHRASE: 'bg-purple-500/15 text-purple-400',
  BROAD: 'bg-amber-500/15 text-amber-400',
};

const MATCH_TYPE_LABELS: Record<string, string> = {
  EXACT: 'Pontos',
  PHRASE: 'Kifejezés',
  BROAD: 'Általános',
};

type KwSort = 'clicks' | 'cost_micros' | 'conversions' | 'quality_score';
type QsFilter = 'all' | 'good' | 'average' | 'poor';

function formatMicros(micros: number): string {
  return Math.round(micros / 1_000_000).toLocaleString('hu-HU');
}

export default function SearchCampaignDetail({ accountId, campaignId }: Props) {
  const [tab, setTab] = useState<Tab>('keywords');
  const [loading, setLoading] = useState(false);

  // Keywords state
  const [keywords, setKeywords] = useState<AdsKeywordWithMetricsRow[]>([]);
  const [kwSearch, setKwSearch] = useState('');
  const [kwMatchFilter, setKwMatchFilter] = useState<string>('all');
  const [kwQsFilter, setKwQsFilter] = useState<QsFilter>('all');
  const [kwSort, setKwSort] = useState<KwSort>('clicks');
  const [kwPage, setKwPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ads state
  const [ads, setAds] = useState<AdsAdGroupAdRow[]>([]);

  // Search terms state
  const [searchTerms, setSearchTerms] = useState<AdsSearchTermRow[]>([]);
  const [stSearch, setStSearch] = useState('');
  const [stPage, setStPage] = useState(1);

  // Negative keywords state
  const [negativeKws, setNegativeKws] = useState<AdsNegativeKeywordRow[]>([]);

  useEffect(() => {
    loadTabData(tab);
  }, [tab, accountId, campaignId]);

  async function loadTabData(t: Tab) {
    setLoading(true);
    try {
      if (t === 'keywords' && keywords.length === 0) {
        const res = await window.electronAPI.adsGetKeywordsWithMetrics(accountId, campaignId);
        if (res.success && res.data) setKeywords(res.data);
      } else if (t === 'ads' && ads.length === 0) {
        const res = await window.electronAPI.adsGetAdGroupAds(accountId, campaignId);
        if (res.success && res.data) setAds(res.data);
      } else if (t === 'search_terms' && searchTerms.length === 0) {
        const res = await window.electronAPI.adsGetSearchTerms(accountId, campaignId);
        if (res.success && res.data) setSearchTerms(res.data);
      } else if (t === 'negative' && negativeKws.length === 0) {
        const res = await window.electronAPI.adsGetNegativeKeywords(accountId, campaignId);
        if (res.success && res.data) setNegativeKws(res.data);
      }
    } finally {
      setLoading(false);
    }
  }

  // Debounced search
  function handleKwSearchChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setKwSearch(value);
      setKwPage(1);
    }, 300);
  }

  // Filtered & sorted keywords
  const filteredKeywords = useMemo(() => {
    let result = [...keywords];

    // Text filter
    if (kwSearch) {
      const q = kwSearch.toLowerCase();
      result = result.filter(kw => kw.keyword_text.toLowerCase().includes(q));
    }

    // Match type filter
    if (kwMatchFilter !== 'all') {
      result = result.filter(kw => kw.match_type === kwMatchFilter);
    }

    // QS filter
    if (kwQsFilter !== 'all') {
      result = result.filter(kw => {
        if (kw.quality_score == null) return false;
        if (kwQsFilter === 'good') return kw.quality_score >= 7;
        if (kwQsFilter === 'average') return kw.quality_score >= 5 && kw.quality_score <= 6;
        return kw.quality_score < 5;
      });
    }

    // Sort
    result.sort((a, b) => {
      if (kwSort === 'quality_score') return (b.quality_score ?? 0) - (a.quality_score ?? 0);
    return ((b[kwSort] as number) ?? 0) - ((a[kwSort] as number) ?? 0);
    });

    return result;
  }, [keywords, kwSearch, kwMatchFilter, kwQsFilter, kwSort]);

  const kwPageItems = filteredKeywords.slice((kwPage - 1) * 25, kwPage * 25);

  // Filtered search terms
  const filteredSearchTerms = useMemo(() => {
    if (!stSearch) return searchTerms;
    const q = stSearch.toLowerCase();
    return searchTerms.filter(st => st.search_term.toLowerCase().includes(q));
  }, [searchTerms, stSearch]);

  const stPageItems = filteredSearchTerms.slice((stPage - 1) * 25, stPage * 25);

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex bg-surface-900/40 border border-teal/8 rounded-xl overflow-hidden">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
              tab === t.key
                ? 'bg-teal/10 text-cream border-b-2 border-teal'
                : 'text-steel hover:text-cream hover:bg-surface-800/50'
            }`}
          >
            {t.label}
            {t.key === 'keywords' && keywords.length > 0 && (
              <span className="ml-1.5 text-steel/60">({keywords.length})</span>
            )}
            {t.key === 'negative' && negativeKws.length > 0 && (
              <span className="ml-1.5 text-steel/60">({negativeKws.length})</span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-teal" />
        </div>
      )}

      {/* Keywords tab */}
      {!loading && tab === 'keywords' && (
        <div className="bg-surface-900/40 border border-teal/8 rounded-xl overflow-hidden">
          {/* Filters */}
          <div className="px-4 py-3 border-b border-teal/8 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-[300px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-steel/50" />
              <input
                type="text"
                placeholder="Kulcsszó keresés..."
                onChange={e => handleKwSearchChange(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-[11px] bg-surface-900 border border-teal/10 rounded-lg text-cream placeholder:text-steel/40 focus:outline-none focus:border-teal/30"
              />
            </div>
            <select
              value={kwMatchFilter}
              onChange={e => { setKwMatchFilter(e.target.value); setKwPage(1); }}
              className="text-[11px] bg-surface-900 border border-teal/10 rounded-lg px-2.5 py-1.5 text-cream focus:outline-none focus:border-teal/30"
            >
              <option value="all">Minden egyezés</option>
              <option value="EXACT">Pontos</option>
              <option value="PHRASE">Kifejezés</option>
              <option value="BROAD">Általános</option>
            </select>
            <select
              value={kwQsFilter}
              onChange={e => { setKwQsFilter(e.target.value as QsFilter); setKwPage(1); }}
              className="text-[11px] bg-surface-900 border border-teal/10 rounded-lg px-2.5 py-1.5 text-cream focus:outline-none focus:border-teal/30"
            >
              <option value="all">Minden QS</option>
              <option value="good">Jó (7+)</option>
              <option value="average">Közepes (5-6)</option>
              <option value="poor">Gyenge (&lt;5)</option>
            </select>
            <select
              value={kwSort}
              onChange={e => setKwSort(e.target.value as KwSort)}
              className="text-[11px] bg-surface-900 border border-teal/10 rounded-lg px-2.5 py-1.5 text-cream focus:outline-none focus:border-teal/30"
            >
              <option value="clicks">Kattintás ↓</option>
              <option value="cost_micros">Költés ↓</option>
              <option value="conversions">Konverzió ↓</option>
              <option value="quality_score">QS ↓</option>
            </select>
          </div>

          {filteredKeywords.length === 0 ? (
            <p className="text-sm text-steel text-center py-8">Nincs találat</p>
          ) : (
            <>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-teal/8 text-steel/60 uppercase tracking-wider">
                    <th className="text-left px-4 py-2 font-medium">Kulcsszó</th>
                    <th className="text-center px-2 py-2 font-medium w-20">Egyezés</th>
                    <th className="text-center px-2 py-2 font-medium w-10">QS</th>
                    <th className="text-center px-2 py-2 font-medium w-24">CTR</th>
                    <th className="text-center px-2 py-2 font-medium w-24">Relevancia</th>
                    <th className="text-center px-2 py-2 font-medium w-24">Landing</th>
                    <th className="text-right px-2 py-2 font-medium w-20">Katt.</th>
                    <th className="text-right px-2 py-2 font-medium w-24">Költés</th>
                    <th className="text-right px-4 py-2 font-medium w-20">Konv.</th>
                  </tr>
                </thead>
                <tbody>
                  {kwPageItems.map(kw => (
                    <tr key={kw.id} className="border-b border-teal/5 hover:bg-surface-800/30">
                      <td className="px-4 py-2.5 text-cream font-medium">{kw.keyword_text}</td>
                      <td className="px-2 py-2.5 text-center">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${MATCH_TYPE_COLORS[kw.match_type || ''] || 'bg-surface-800 text-steel'}`}>
                          {MATCH_TYPE_LABELS[kw.match_type || ''] || kw.match_type || '–'}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        {kw.quality_score != null ? (
                          <span className={`font-bold ${kw.quality_score >= 7 ? 'text-emerald-400' : kw.quality_score >= 5 ? 'text-amber-400' : 'text-red-400'}`}>
                            {kw.quality_score}
                          </span>
                        ) : (
                          <span className="text-steel/40">–</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <QsDot value={kw.expected_ctr} />
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <QsDot value={kw.ad_relevance} />
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <QsDot value={kw.landing_page_experience} />
                      </td>
                      <td className="px-2 py-2.5 text-right text-steel">{kw.clicks.toLocaleString('hu-HU')}</td>
                      <td className="px-2 py-2.5 text-right text-steel">{formatMicros(kw.cost_micros)} Ft</td>
                      <td className="px-4 py-2.5 text-right text-steel">{kw.conversions.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                currentPage={kwPage}
                totalItems={filteredKeywords.length}
                itemsPerPage={25}
                onPageChange={setKwPage}
              />
            </>
          )}
        </div>
      )}

      {/* Ad texts tab */}
      {!loading && tab === 'ads' && (
        <div className="space-y-3">
          {ads.length === 0 ? (
            <div className="bg-surface-900/40 border border-teal/8 rounded-xl p-8 text-center">
              <p className="text-sm text-steel">Nincs hirdetésszöveg adat</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {ads.map(ad => {
                const headlines: string[] = (() => { try { return JSON.parse(ad.headlines || '[]'); } catch { return []; } })();
                const descriptions: string[] = (() => { try { return JSON.parse(ad.descriptions || '[]'); } catch { return []; } })();
                return (
                  <div key={ad.id} className="bg-surface-900/40 border border-teal/8 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${ad.status === 'ENABLED' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                        {ad.status === 'ENABLED' ? 'Aktív' : ad.status}
                      </span>
                      <span className="text-[10px] text-steel/50">{ad.ad_type}</span>
                    </div>
                    <div className="space-y-1">
                      {headlines.map((h, i) => (
                        <p key={i} className="text-sm text-blue-400 font-medium leading-tight">{h}</p>
                      ))}
                    </div>
                    <div className="space-y-1">
                      {descriptions.map((d, i) => (
                        <p key={i} className="text-[11px] text-steel leading-snug">{d}</p>
                      ))}
                    </div>
                    <div className="flex gap-4 pt-2 border-t border-teal/5 text-[10px] text-steel/60">
                      <span>Megj.: {ad.impressions.toLocaleString('hu-HU')}</span>
                      <span>Katt.: {ad.clicks.toLocaleString('hu-HU')}</span>
                      <span>CTR: {(ad.ctr * 100).toFixed(2)}%</span>
                      <span>Költés: {formatMicros(ad.cost_micros)} Ft</span>
                      <span>Konv.: {ad.conversions.toFixed(1)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Search terms tab */}
      {!loading && tab === 'search_terms' && (
        <div className="bg-surface-900/40 border border-teal/8 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-teal/8 flex items-center gap-3">
            <div className="relative flex-1 max-w-[300px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-steel/50" />
              <input
                type="text"
                placeholder="Kifejezés keresés..."
                value={stSearch}
                onChange={e => { setStSearch(e.target.value); setStPage(1); }}
                className="w-full pl-8 pr-3 py-1.5 text-[11px] bg-surface-900 border border-teal/10 rounded-lg text-cream placeholder:text-steel/40 focus:outline-none focus:border-teal/30"
              />
            </div>
            <span className="text-[11px] text-steel/50">
              Live API adat · Utolsó 30 nap · Top 100
            </span>
          </div>
          {filteredSearchTerms.length === 0 ? (
            <p className="text-sm text-steel text-center py-8">Nincs keresési kifejezés</p>
          ) : (
            <>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-teal/8 text-steel/60 uppercase tracking-wider">
                    <th className="text-left px-4 py-2 font-medium">Keresési kifejezés</th>
                    <th className="text-right px-2 py-2 font-medium w-24">Megjelenítés</th>
                    <th className="text-right px-2 py-2 font-medium w-20">Kattintás</th>
                    <th className="text-right px-2 py-2 font-medium w-24">Költés</th>
                    <th className="text-right px-4 py-2 font-medium w-20">Konverzió</th>
                  </tr>
                </thead>
                <tbody>
                  {stPageItems.map((st, i) => (
                    <tr key={i} className="border-b border-teal/5 hover:bg-surface-800/30">
                      <td className="px-4 py-2.5 text-cream">{st.search_term}</td>
                      <td className="px-2 py-2.5 text-right text-steel">{st.impressions.toLocaleString('hu-HU')}</td>
                      <td className="px-2 py-2.5 text-right text-steel">{st.clicks.toLocaleString('hu-HU')}</td>
                      <td className="px-2 py-2.5 text-right text-steel">{formatMicros(st.cost_micros)} Ft</td>
                      <td className="px-4 py-2.5 text-right text-steel">{st.conversions.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                currentPage={stPage}
                totalItems={filteredSearchTerms.length}
                itemsPerPage={25}
                onPageChange={setStPage}
              />
            </>
          )}
        </div>
      )}

      {/* Negative keywords tab */}
      {!loading && tab === 'negative' && (
        <div className="bg-surface-900/40 border border-teal/8 rounded-xl p-4">
          {negativeKws.length === 0 ? (
            <p className="text-sm text-steel text-center py-6">Nincsenek negatív kulcsszavak</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {negativeKws.map((nk, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-[11px] text-red-300"
                >
                  <X className="w-3 h-3 text-red-400/50" />
                  {nk.keyword_text}
                  <span className="text-red-400/40 text-[9px] uppercase">{MATCH_TYPE_LABELS[nk.match_type || ''] || nk.match_type}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QsDot({ value }: { value: string | null }) {
  if (!value) return <span className="text-steel/40">–</span>;
  const color = value === 'ABOVE_AVERAGE' ? 'bg-emerald-400' : value === 'AVERAGE' ? 'bg-amber-400' : 'bg-red-400';
  const label = QS_LABELS[value] || value;
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className={`text-[10px] ${QS_COLORS[value] || 'text-steel/40'}`}>{label}</span>
    </span>
  );
}
