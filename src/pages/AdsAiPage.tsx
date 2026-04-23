import { useEffect, useState, useRef } from 'react';
import { useAds } from '../contexts/AdsContext';
import {
  Sparkles, BarChart3, Wallet, Search, AlertTriangle, FileText,
  Loader2, Send, Plus, Pencil, Trash2,
  Megaphone, Clock, BookOpen,
} from 'lucide-react';

/* ── Analysis types ────────────────────────────────────── */

const ANALYSIS_TYPES = [
  { key: 'performance', label: 'Teljesítmény', desc: 'Kampány és konverziós KPI-k elemzése', icon: BarChart3, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/25' },
  { key: 'budget', label: 'Budget', desc: 'Büdzsé elosztás és optimalizáció', icon: Wallet, color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/25' },
  { key: 'keywords', label: 'Kulcsszavak', desc: 'Quality Score és kulcsszó teljesítmény', icon: Search, color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/25' },
  { key: 'anomaly', label: 'Anomáliák', desc: 'Szokatlan változások felismerése', icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/25' },
  { key: 'report', label: 'Riport', desc: 'Átfogó havi jelentés generálás', icon: FileText, color: 'text-violet-400', bg: 'bg-violet-400/10', border: 'border-violet-400/25' },
] as const;

/* ── Markdown → HTML with proper table support ─────── */

function renderMarkdown(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Detect table block: consecutive lines starting with |
    if (line.trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      out.push(parseTable(tableLines));
      continue;
    }

    out.push(line);
    i++;
  }

  return out.join('\n')
    .replace(/^### (.+)$/gm, '<h3 class="text-[15px] font-semibold text-cream mt-8 mb-3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-cream mt-10 mb-4 pb-2 border-b border-teal/10">$2 $1</h2>'
      .replace('$2 ', ''))
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-cream mt-10 mb-5 pb-3 border-b border-teal/15">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-cream font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-steel/80">$1</em>')
    .replace(/^- (.+)$/gm, '<li class="ml-5 list-disc text-steel/90 text-[13.5px] leading-relaxed mb-1.5">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-5 list-decimal text-steel/90 text-[13.5px] leading-relaxed mb-1.5">$2</li>')
    .replace(/`([^`]+)`/g, '<code class="bg-surface-800 text-teal/80 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>')
    .replace(/\n{2,}/g, '</p><p class="text-[13.5px] text-steel/80 leading-[1.85] mb-4">')
    .replace(/\n/g, '<br/>');
}

function parseTable(lines: string[]): string {
  const parseCells = (row: string) =>
    row.split('|').slice(1, -1).map(c => c.trim());

  // Filter out separator rows (|---|---|...)
  const dataRows = lines.filter(l => !/^\|[\s\-:|]+\|$/.test(l));
  if (dataRows.length === 0) return '';

  const header = parseCells(dataRows[0]);
  const body = dataRows.slice(1).map(parseCells);

  let html = '<div class="my-5 overflow-x-auto rounded-xl border border-teal/10">';
  html += '<table class="w-full text-[12.5px] border-collapse">';

  // thead
  html += '<thead><tr class="bg-surface-800/60">';
  for (const h of header) {
    html += `<th class="px-3.5 py-2.5 text-left font-semibold text-cream/80 border-b border-teal/10 whitespace-nowrap">${formatCellContent(h)}</th>`;
  }
  html += '</tr></thead>';

  // tbody
  html += '<tbody>';
  for (let r = 0; r < body.length; r++) {
    const stripe = r % 2 === 1 ? ' bg-surface-800/20' : '';
    html += `<tr class="border-b border-teal/5 hover:bg-teal/5 transition-colors${stripe}">`;
    for (let c = 0; c < body[r].length; c++) {
      const isFirstCol = c === 0;
      const cls = isFirstCol
        ? 'px-3.5 py-2 text-cream/90 font-medium'
        : 'px-3.5 py-2 text-steel/80 tabular-nums';
      html += `<td class="${cls} whitespace-nowrap">${formatCellContent(body[r][c])}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

function formatCellContent(cell: string): string {
  return cell
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-cream font-semibold">$1</strong>')
    .replace(/⚠️|⚠/g, '<span class="text-amber-400">⚠️</span>')
    .replace(/✅/g, '<span class="text-emerald-400">✅</span>')
    .replace(/🔴/g, '<span class="text-red-400">🔴</span>')
    .replace(/🟡/g, '<span class="text-amber-400">🟡</span>')
    .replace(/🟢/g, '<span class="text-emerald-400">🟢</span>')
    .replace(/Kiváló/g, '<span class="text-emerald-400 font-medium">Kiváló</span>')
    .replace(/Alacsony/g, '<span class="text-amber-400 font-medium">Alacsony</span>')
    .replace(/Kritikus/g, '<span class="text-red-400 font-medium">Kritikus</span>')
    .replace(/Sok inaktív/g, '<span class="text-amber-400 font-medium">Sok inaktív</span>');
}

/* ── Page component ────────────────────────────────────── */

type SubTab = 'history' | 'kb';

function AdsAiPageContent() {
  const { selectedAccount } = useAds();

  /* Analysis state */
  const [selectedType, setSelectedType] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [resultMeta, setResultMeta] = useState<{ type: string; date?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* History */
  const [analyses, setAnalyses] = useState<AdsAnalysisRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  /* Knowledge base */
  const [kbEntries, setKbEntries] = useState<AdsKnowledgeBaseRow[]>([]);
  const [loadingKb, setLoadingKb] = useState(false);
  const [kbEditId, setKbEditId] = useState<string | null>(null);
  const [kbTitle, setKbTitle] = useState('');
  const [kbContent, setKbContent] = useState('');
  const [kbCategory, setKbCategory] = useState('');
  const [kbSaving, setKbSaving] = useState(false);

  /* Sub-tab for bottom section */
  const [subTab, setSubTab] = useState<SubTab>('history');

  const resultPanelRef = useRef<HTMLDivElement>(null);

  /* ── Data loading ── */

  useEffect(() => {
    if (selectedAccount) {
      loadHistory();
      loadKb();
    }
  }, [selectedAccount?.id]);

  async function loadHistory() {
    if (!selectedAccount) return;
    setLoadingHistory(true);
    try {
      const res = await window.electronAPI.adsGetAnalyses(selectedAccount.id, 50);
      if (res.success && res.data) setAnalyses(res.data);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function loadKb() {
    setLoadingKb(true);
    try {
      const res = await window.electronAPI.adsKbGetAll();
      if (res.success && res.data) setKbEntries(res.data);
    } finally {
      setLoadingKb(false);
    }
  }

  /* ── Actions ── */

  async function runAnalysis() {
    if (!selectedType || !selectedAccount) return;
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const res = await window.electronAPI.adsRunAnalysis(selectedAccount.id, selectedType, customPrompt || undefined);
      if (res.success && res.data) {
        const typeLabel = ANALYSIS_TYPES.find(t => t.key === selectedType)?.label || selectedType;
        setResult(res.data.content);
        setResultMeta({ type: typeLabel });
        resultPanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        loadHistory();
      } else {
        setError(res.error || 'Ismeretlen hiba történt.');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Hiba az elemzés során.');
    } finally {
      setRunning(false);
    }
  }

  function viewHistoryItem(item: AdsAnalysisRow) {
    const typeLabel = ANALYSIS_TYPES.find(t => t.key === item.analysis_type)?.label || item.analysis_type;
    setResult(item.response_text);
    setResultMeta({ type: typeLabel, date: item.created_at });
    resultPanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startNewKb() {
    setKbEditId('new');
    setKbTitle('');
    setKbContent('');
    setKbCategory('');
  }

  function editKb(entry: AdsKnowledgeBaseRow) {
    setKbEditId(entry.id);
    setKbTitle(entry.title);
    setKbContent(entry.content);
    setKbCategory(entry.category || '');
  }

  async function saveKb() {
    if (!kbTitle.trim() || !kbContent.trim()) return;
    setKbSaving(true);
    try {
      if (kbEditId === 'new') {
        await window.electronAPI.adsKbCreate(kbTitle, kbContent, kbCategory || undefined);
      } else if (kbEditId) {
        await window.electronAPI.adsKbUpdate(kbEditId, kbTitle, kbContent, kbCategory || undefined);
      }
      setKbEditId(null);
      await loadKb();
    } finally {
      setKbSaving(false);
    }
  }

  async function deleteKb(id: string) {
    await window.electronAPI.adsKbDelete(id);
    await loadKb();
  }

  /* ── No account guard ── */

  if (!selectedAccount) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <Megaphone className="w-8 h-8 text-steel/20 mx-auto mb-3" />
          <p className="text-sm text-steel/60 italic">
            Nincs összekapcsolt fiók. Menj a beállításokba a fiók hozzáadásához.
          </p>
        </div>
      </div>
    );
  }

  /* ── Render ── */

  const activeType = ANALYSIS_TYPES.find(t => t.key === selectedType);

  return (
    <div className="h-full flex flex-col -m-8 -mb-24">

      {/* ── Page header ── */}
      <div className="shrink-0 px-8 pt-8 pb-5">
        <h1 className="font-pixel text-xl text-cream">AI Elemzés</h1>
        <p className="text-steel text-sm mt-1">Kampányok mesterséges intelligenciával támogatott elemzése</p>
      </div>

      {/* ── Two-panel layout ── */}
      <div className="flex-1 flex min-h-0 px-8 pb-8 gap-6">

        {/* ━━━ Left panel ━━━ */}
        <div className="w-[340px] shrink-0 flex flex-col min-h-0">

          {/* Analysis type selector */}
          <div className="space-y-1.5 shrink-0">
            {ANALYSIS_TYPES.map(t => {
              const selected = selectedType === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => { setSelectedType(t.key); setError(null); }}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl border transition-all duration-150 text-left group ${
                    selected
                      ? `${t.border} bg-surface-800/70`
                      : 'border-transparent hover:bg-surface-800/30'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-150 ${
                    selected ? t.bg : 'bg-surface-800/50 group-hover:bg-surface-800'
                  }`}>
                    <t.icon className={`w-4 h-4 transition-colors duration-150 ${selected ? t.color : 'text-steel/40 group-hover:text-steel/70'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] font-medium transition-colors duration-150 ${selected ? 'text-cream' : 'text-steel/70 group-hover:text-cream'}`}>
                      {t.label}
                    </p>
                    <p className="text-[11px] text-steel/40 leading-snug truncate">{t.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom prompt + run */}
          <div className="mt-4 space-y-3 shrink-0">
            <textarea
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              placeholder="Egyedi kérdés vagy fókuszpont (opcionális)…"
              rows={2}
              className="w-full bg-surface-800/40 border border-teal/10 rounded-xl px-4 py-2.5 text-sm text-cream placeholder-steel/30 resize-none focus:outline-none focus:border-teal/25 transition-colors"
            />
            <button
              onClick={runAnalysis}
              disabled={!selectedType || running}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 disabled:opacity-25 disabled:cursor-not-allowed bg-teal/15 text-cream hover:bg-teal/25 active:scale-[0.98]"
            >
              {running ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Elemzés folyamatban…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Elemzés futtatása
                </>
              )}
            </button>
            {error && (
              <div className="bg-red-500/8 border border-red-500/15 rounded-xl px-4 py-2.5 text-xs text-red-400">
                {error}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-teal/8 shrink-0" />

          {/* Sub-tab toggle: Előzmények | Tudásbázis */}
          <div className="flex items-center gap-1 p-1 bg-surface-800/25 rounded-lg shrink-0 mb-3">
            {([
              { key: 'history' as SubTab, label: 'Előzmények', icon: Clock },
              { key: 'kb' as SubTab, label: 'Tudásbázis', icon: BookOpen },
            ]).map(t => (
              <button
                key={t.key}
                onClick={() => setSubTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 ${
                  subTab === t.key
                    ? 'bg-surface-800 text-cream shadow-sm'
                    : 'text-steel/50 hover:text-cream'
                }`}
              >
                <t.icon className="w-3 h-3" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Scrollable sub-tab content */}
          <div className="flex-1 overflow-y-auto min-h-0">

            {/* ── History ── */}
            {subTab === 'history' && (
              loadingHistory ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-4 h-4 animate-spin text-teal/40" />
                </div>
              ) : analyses.length === 0 ? (
                <div className="py-10 text-center">
                  <Clock className="w-5 h-5 text-steel/15 mx-auto mb-2" />
                  <p className="text-xs text-steel/40">Még nincs korábbi elemzés.</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {analyses.map(a => {
                    const typeInfo = ANALYSIS_TYPES.find(t => t.key === a.analysis_type);
                    return (
                      <button
                        key={a.id}
                        onClick={() => viewHistoryItem(a)}
                        className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-surface-800/40 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5">
                          {typeInfo && (
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${typeInfo.bg}`}>
                              <typeInfo.icon className={`w-3 h-3 ${typeInfo.color}`} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-medium text-cream/80 group-hover:text-cream truncate transition-colors">
                                {typeInfo?.label || a.analysis_type}
                              </p>
                              <span className="text-[10px] text-steel/25 shrink-0">
                                {new Date(a.created_at + 'Z').toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {a.prompt_summary && (
                              <p className="text-[11px] text-steel/30 truncate mt-0.5">{a.prompt_summary}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            )}

            {/* ── Knowledge Base ── */}
            {subTab === 'kb' && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] text-steel/40">Egyedi kontextus az AI elemzésekhez</p>
                  <button
                    onClick={startNewKb}
                    className="flex items-center gap-1 px-2.5 py-1 bg-teal/10 text-cream text-[11px] font-medium rounded-lg hover:bg-teal/20 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Új
                  </button>
                </div>

                {kbEditId && (
                  <div className="bg-surface-800/40 border border-teal/12 rounded-xl p-3.5 space-y-2 mb-3">
                    <input
                      value={kbTitle}
                      onChange={e => setKbTitle(e.target.value)}
                      placeholder="Cím"
                      className="w-full bg-surface-900/50 border border-teal/10 rounded-lg px-3 py-1.5 text-xs text-cream placeholder-steel/30 focus:outline-none focus:border-teal/25"
                    />
                    <textarea
                      value={kbContent}
                      onChange={e => setKbContent(e.target.value)}
                      placeholder="Tartalom…"
                      rows={3}
                      className="w-full bg-surface-900/50 border border-teal/10 rounded-lg px-3 py-1.5 text-xs text-cream placeholder-steel/30 resize-none focus:outline-none focus:border-teal/25"
                    />
                    <input
                      value={kbCategory}
                      onChange={e => setKbCategory(e.target.value)}
                      placeholder="Kategória (opcionális)"
                      className="w-full bg-surface-900/50 border border-teal/10 rounded-lg px-3 py-1.5 text-xs text-cream placeholder-steel/30 focus:outline-none focus:border-teal/25"
                    />
                    <div className="flex items-center gap-2 justify-end pt-1">
                      <button onClick={() => setKbEditId(null)} className="px-3 py-1 text-[11px] text-steel/50 hover:text-cream transition-colors">
                        Mégse
                      </button>
                      <button
                        onClick={saveKb}
                        disabled={kbSaving || !kbTitle.trim() || !kbContent.trim()}
                        className="px-3 py-1 bg-teal/15 text-cream text-[11px] font-medium rounded-lg hover:bg-teal/25 disabled:opacity-40 transition-colors"
                      >
                        {kbSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Mentés'}
                      </button>
                    </div>
                  </div>
                )}

                {loadingKb ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-4 h-4 animate-spin text-teal/40" />
                  </div>
                ) : kbEntries.length === 0 && !kbEditId ? (
                  <div className="py-8 text-center">
                    <BookOpen className="w-5 h-5 text-steel/15 mx-auto mb-2" />
                    <p className="text-xs text-steel/40">Még nincs tudásbázis bejegyzés.</p>
                    <p className="text-[11px] text-steel/25 mt-1.5 leading-relaxed max-w-[260px] mx-auto">
                      Add hozzá a PPC stratégiádat, ügyfélspecifikus megjegyzéseidet vagy iparági benchmarkjaidat.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {kbEntries.map(entry => (
                      <div key={entry.id} className="bg-surface-800/30 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-medium text-cream truncate">{entry.title}</h4>
                            {entry.category && (
                              <span className="text-[10px] text-teal/50 bg-teal/5 px-1.5 py-0.5 rounded mt-1 inline-block">
                                {entry.category}
                              </span>
                            )}
                            <p className="text-[11px] text-steel/40 mt-1 line-clamp-2 leading-relaxed">{entry.content}</p>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button onClick={() => editKb(entry)} className="p-1 text-steel/25 hover:text-cream transition-colors">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={() => deleteKb(entry.id)} className="p-1 text-steel/25 hover:text-red-400 transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ━━━ Right panel — Result viewer ━━━ */}
        <div className="flex-1 min-h-0 rounded-2xl border border-teal/8 bg-surface-800/15 flex flex-col overflow-hidden">

          {running ? (
            /* ── Loading state ── */
            <div className="flex-1 flex flex-col items-center justify-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-teal/8 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-teal animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-cream/90">Elemzés folyamatban</p>
                <p className="text-xs text-steel/40 mt-1.5">Kampányadatok feldolgozása és AI elemzés…</p>
              </div>
              <div className="w-48 h-1 bg-surface-800/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal/30 rounded-full"
                  style={{ animation: 'aiProgress 1.8s ease-in-out infinite' }}
                />
              </div>
            </div>

          ) : result ? (
            /* ── Result document ── */
            <>
              <div className="shrink-0 flex items-center gap-3.5 px-8 py-4 border-b border-teal/8">
                {activeType ? (
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${activeType.bg}`}>
                    <activeType.icon className={`w-4 h-4 ${activeType.color}`} />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-teal/10 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-teal" />
                  </div>
                )}
                <div>
                  <h2 className="text-sm font-bold text-cream">{resultMeta?.type || 'AI Elemzés'}</h2>
                  <p className="text-[11px] text-steel/35">
                    {resultMeta?.date
                      ? new Date(resultMeta.date + 'Z').toLocaleString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : new Date().toLocaleString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    }
                  </p>
                </div>
              </div>

              <div ref={resultPanelRef} className="flex-1 overflow-y-auto px-10 py-8">
                <div
                  className="text-[13.5px] text-steel/80 leading-[1.85] max-w-none ai-report"
                  dangerouslySetInnerHTML={{
                    __html: `<p class="text-[13.5px] text-steel/80 leading-[1.85] mb-4">${renderMarkdown(result)}</p>`,
                  }}
                />
              </div>

              <div className="shrink-0 px-8 py-3 border-t border-teal/8">
                <span className="text-[10px] text-steel/20 tracking-wider font-medium">AI ELEMZÉS • KLIENT</span>
              </div>
            </>

          ) : (
            /* ── Empty state ── */
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
              <div className="w-16 h-16 rounded-2xl bg-surface-800/40 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-steel/15" />
              </div>
              <div className="text-center max-w-[300px]">
                <p className="text-sm font-medium text-steel/35">Válassz elemzés típust</p>
                <p className="text-xs text-steel/20 mt-1.5 leading-relaxed">
                  Válaszd ki a kívánt elemzést a bal panelről, opcionálisan adj hozzá egyedi kérdést, majd futtasd.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes aiProgress {
          0%   { width: 0%; margin-left: 0; }
          50%  { width: 55%; margin-left: 25%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}

export default function AdsAiPage() {
  return <AdsAiPageContent />;
}
