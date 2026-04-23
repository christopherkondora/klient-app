import { useEffect, useState, useRef, useCallback, type RefObject } from 'react';
import {
  X, Sparkles, BarChart3, Wallet, Search, AlertTriangle, FileText,
  Loader2, Send, History, BookOpen, Plus, Pencil, Trash2, ChevronRight,
} from 'lucide-react';

const ANALYSIS_TYPES = [
  { key: 'performance', label: 'Teljesítmény', desc: 'Kampány és konverziós KPI-k elemzése', icon: BarChart3, color: 'text-emerald-400 bg-emerald-400/10' },
  { key: 'budget', label: 'Budget', desc: 'Büdzsé elosztás és optimalizáció', icon: Wallet, color: 'text-orange-400 bg-orange-400/10' },
  { key: 'keywords', label: 'Kulcsszavak', desc: 'Quality Score és kulcsszó teljesítmény', icon: Search, color: 'text-cyan-400 bg-cyan-400/10' },
  { key: 'anomaly', label: 'Anomáliák', desc: 'Szokatlan változások felismerése', icon: AlertTriangle, color: 'text-amber-400 bg-amber-400/10' },
  { key: 'report', label: 'Riport', desc: 'Átfogó havi jelentés generálás', icon: FileText, color: 'text-violet-400 bg-violet-400/10' },
] as const;

type Tab = 'analysis' | 'history' | 'kb';

interface Props {
  accountId: string;
  onClose: () => void;
  initialType?: string;
  anchorRef?: RefObject<HTMLButtonElement | null>;
}

/* ─────────────────────────────────────────────────────────────
   Markdown → HTML with proper table support (document view)
   ───────────────────────────────────────────────────────────── */
function renderMarkdown(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
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
    .replace(/^### (.+)$/gm, '<h3 class="text-[15px] font-semibold text-cream mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-cream mt-8 mb-3 pb-2 border-b border-teal/10">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-cream mt-8 mb-4 pb-2 border-b border-teal/15">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-cream font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-steel/80">$1</em>')
    .replace(/^- (.+)$/gm, '<li class="ml-5 list-disc text-steel/90 text-[13px] leading-relaxed mb-1">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-5 list-decimal text-steel/90 text-[13px] leading-relaxed mb-1">$2</li>')
    .replace(/`([^`]+)`/g, '<code class="bg-surface-800 text-teal/80 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>')
    .replace(/\n{2,}/g, '</p><p class="text-[13px] text-steel/90 leading-[1.8] mb-3">')
    .replace(/\n/g, '<br/>');
}

function parseTable(lines: string[]): string {
  const parseCells = (row: string) => row.split('|').slice(1, -1).map(c => c.trim());
  const dataRows = lines.filter(l => !/^\|[\s\-:|]+\|$/.test(l));
  if (dataRows.length === 0) return '';
  const header = parseCells(dataRows[0]);
  const body = dataRows.slice(1).map(parseCells);
  let html = '<div class="my-4 overflow-x-auto rounded-lg border border-teal/10"><table class="w-full text-[11px] border-collapse">';
  html += '<thead><tr class="bg-surface-800/60">';
  for (const h of header) html += `<th class="px-2.5 py-2 text-left font-semibold text-cream/80 border-b border-teal/10 whitespace-nowrap">${h}</th>`;
  html += '</tr></thead><tbody>';
  for (let r = 0; r < body.length; r++) {
    const stripe = r % 2 === 1 ? ' bg-surface-800/20' : '';
    html += `<tr class="border-b border-teal/5 hover:bg-teal/5 transition-colors${stripe}">`;
    for (let c = 0; c < body[r].length; c++) {
      const cls = c === 0 ? 'px-2.5 py-1.5 text-cream/90 font-medium' : 'px-2.5 py-1.5 text-steel/80 tabular-nums';
      html += `<td class="${cls} whitespace-nowrap">${body[r][c]}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

export default function AdsAiPanel({ accountId, onClose, initialType, anchorRef }: Props) {
  const [tab, setTab] = useState<Tab>('analysis');
  const [selectedType, setSelectedType] = useState<string>(initialType || '');
  const [customPrompt, setCustomPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [resultMeta, setResultMeta] = useState<{ type: string; date?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Dropdown position from anchor button
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  // History
  const [analyses, setAnalyses] = useState<AdsAnalysisRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Knowledge base
  const [kbEntries, setKbEntries] = useState<AdsKnowledgeBaseRow[]>([]);
  const [loadingKb, setLoadingKb] = useState(false);
  const [kbEditId, setKbEditId] = useState<string | null>(null);
  const [kbTitle, setKbTitle] = useState('');
  const [kbContent, setKbContent] = useState('');
  const [kbCategory, setKbCategory] = useState('');
  const [kbSaving, setKbSaving] = useState(false);

  // Document viewer
  const [showDocument, setShowDocument] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab === 'history') loadHistory();
    if (tab === 'kb') loadKb();
  }, [tab]);

  // Calculate position from anchor button
  useEffect(() => {
    if (anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [anchorRef]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showDocument) setShowDocument(false);
        else onClose();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, showDocument]);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const res = await window.electronAPI.adsGetAnalyses(accountId, 50);
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

  async function runAnalysis() {
    if (!selectedType) return;
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const res = await window.electronAPI.adsRunAnalysis(accountId, selectedType, customPrompt || undefined);
      if (res.success && res.data) {
        const typeLabel = ANALYSIS_TYPES.find(t => t.key === selectedType)?.label || selectedType;
        setResult(res.data.content);
        setResultMeta({ type: typeLabel });
        setShowDocument(true);
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
    setShowDocument(true);
  }

  const closeDocument = useCallback(() => setShowDocument(false), []);

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

  const TABS: { key: Tab; label: string; icon: typeof Sparkles }[] = [
    { key: 'analysis', label: 'Elemzés', icon: Sparkles },
    { key: 'history', label: 'Előzmények', icon: History },
    { key: 'kb', label: 'Tudásbázis', icon: BookOpen },
  ];

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════
          DROPDOWN — floats below the AI button, like Share Hub
         ═══════════════════════════════════════════════════════════ */}
      {/* Invisible backdrop to catch outside clicks */}
      <div className="fixed inset-0 z-50" onClick={onClose} />

      <div
        ref={dropdownRef}
        className="fixed z-50 w-[420px] rounded-xl overflow-hidden border border-teal/15"
        style={{
          top: pos?.top ?? 60,
          right: pos?.right ?? 16,
          animation: 'fadeSlideDown 150ms ease-out',
          backgroundColor: 'var(--color-surface-900)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.05)',
        }}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-teal/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal" />
            <span className="text-sm font-bold text-cream">AI Elemzés</span>
          </div>
          <button onClick={onClose} className="p-1 text-steel hover:text-cream transition-colors rounded-md hover:bg-steel/10">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-teal/10 px-4">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-b-2 transition-colors -mb-px ${
                tab === t.key
                  ? 'border-teal text-cream'
                  : 'border-transparent text-steel hover:text-cream'
              }`}
            >
              <t.icon className="w-3 h-3" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable content — max height so it doesn't overflow the screen */}
        <div className="max-h-[420px] overflow-y-auto p-4 space-y-3">
          {/* ── Analysis Tab ── */}
          {tab === 'analysis' && (
            <>
              {/* Type selector — compact grid */}
              <div className="grid grid-cols-5 gap-1.5">
                {ANALYSIS_TYPES.map(t => (
                  <button
                    key={t.key}
                    onClick={() => { setSelectedType(t.key); setError(null); }}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all text-center ${
                      selectedType === t.key
                        ? 'border-teal/40 bg-teal/10'
                        : 'border-teal/8 bg-surface-800 hover:border-teal/20'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center ${t.color}`}>
                      <t.icon className="w-3 h-3" />
                    </div>
                    <span className="text-[10px] text-cream font-medium leading-tight">{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Custom prompt */}
              <textarea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="Egyedi kérdés (opcionális)..."
                rows={2}
                className="w-full bg-surface-800 border border-teal/10 rounded-lg px-3 py-2 text-xs text-cream placeholder-steel/40 resize-none focus:outline-none focus:border-teal/30 transition-colors"
              />

              {/* Run button */}
              <button
                onClick={runAnalysis}
                disabled={!selectedType || running}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal/15 text-cream text-xs font-medium rounded-lg hover:bg-teal/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {running ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Elemzés folyamatban...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Elemzés futtatása
                  </>
                )}
              </button>

              {/* Error */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-400">
                  {error}
                </div>
              )}
            </>
          )}

          {/* ── History Tab ── */}
          {tab === 'history' && (
            <>
              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-teal" />
                </div>
              ) : analyses.length === 0 ? (
                <div className="py-8 text-center text-xs text-steel italic">
                  Még nincs korábbi elemzés.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {analyses.map(a => {
                    const typeInfo = ANALYSIS_TYPES.find(t => t.key === a.analysis_type);
                    return (
                      <button
                        key={a.id}
                        onClick={() => viewHistoryItem(a)}
                        className="w-full text-left bg-surface-800 border border-teal/8 rounded-lg p-2.5 hover:border-teal/20 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {typeInfo && <typeInfo.icon className="w-3 h-3 text-teal" />}
                            <span className="text-xs font-medium text-cream">{typeInfo?.label || a.analysis_type}</span>
                            <span className="text-[10px] text-steel/40">
                              {new Date(a.created_at + 'Z').toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <ChevronRight className="w-3 h-3 text-steel/30 group-hover:text-teal transition-colors" />
                        </div>
                        {a.prompt_summary && (
                          <p className="text-[11px] text-steel/60 truncate mt-0.5 ml-5">{a.prompt_summary}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Knowledge Base Tab ── */}
          {tab === 'kb' && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-steel/70">
                  Egyedi kontextus az AI elemzésekhez.
                </p>
                <button
                  onClick={startNewKb}
                  className="flex items-center gap-1 px-2 py-1 bg-teal/15 text-cream text-[11px] font-medium rounded-md hover:bg-teal/25 transition-colors shrink-0"
                >
                  <Plus className="w-3 h-3" />
                  Új
                </button>
              </div>

              {/* Edit form */}
              {kbEditId && (
                <div className="bg-surface-800 border border-teal/15 rounded-lg p-3 space-y-2">
                  <input
                    value={kbTitle}
                    onChange={e => setKbTitle(e.target.value)}
                    placeholder="Cím"
                    className="w-full bg-surface-900 border border-teal/10 rounded-lg px-3 py-1.5 text-xs text-cream placeholder-steel/40 focus:outline-none focus:border-teal/30"
                  />
                  <textarea
                    value={kbContent}
                    onChange={e => setKbContent(e.target.value)}
                    placeholder="Tartalom..."
                    rows={3}
                    className="w-full bg-surface-900 border border-teal/10 rounded-lg px-3 py-1.5 text-xs text-cream placeholder-steel/40 resize-none focus:outline-none focus:border-teal/30"
                  />
                  <input
                    value={kbCategory}
                    onChange={e => setKbCategory(e.target.value)}
                    placeholder="Kategória (opcionális)"
                    className="w-full bg-surface-900 border border-teal/10 rounded-lg px-3 py-1.5 text-xs text-cream placeholder-steel/40 focus:outline-none focus:border-teal/30"
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => setKbEditId(null)} className="px-2.5 py-1 text-[11px] text-steel hover:text-cream transition-colors">
                      Mégse
                    </button>
                    <button
                      onClick={saveKb}
                      disabled={kbSaving || !kbTitle.trim() || !kbContent.trim()}
                      className="px-2.5 py-1 bg-teal/15 text-cream text-[11px] font-medium rounded-md hover:bg-teal/25 disabled:opacity-40 transition-colors"
                    >
                      {kbSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Mentés'}
                    </button>
                  </div>
                </div>
              )}

              {loadingKb ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-4 h-4 animate-spin text-teal" />
                </div>
              ) : kbEntries.length === 0 && !kbEditId ? (
                <div className="py-6 text-center space-y-2">
                  <p className="text-xs text-steel italic">Még nincs tudásbázis bejegyzés.</p>
                  <p className="text-[11px] text-steel/50 leading-relaxed max-w-[280px] mx-auto">
                    Add hozzá a PPC stratégiádat, ügyfélspecifikus megjegyzéseidet vagy iparági benchmarkjaidat — az AI figyelembe veszi az elemzéseknél.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {kbEntries.map(entry => (
                    <div key={entry.id} className="bg-surface-800 border border-teal/8 rounded-lg p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-medium text-cream truncate">{entry.title}</h4>
                          {entry.category && (
                            <span className="text-[10px] text-teal/60 bg-teal/5 px-1 py-0.5 rounded mt-0.5 inline-block">
                              {entry.category}
                            </span>
                          )}
                          <p className="text-[11px] text-steel/60 mt-1 line-clamp-2 leading-relaxed">{entry.content}</p>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button onClick={() => editKb(entry)} className="p-1 text-steel/40 hover:text-cream transition-colors">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={() => deleteKb(entry.id)} className="p-1 text-steel/40 hover:text-red-400 transition-colors">
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

      {/* CSS animation for the dropdown */}
      <style>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════
          DOCUMENT VIEWER — A5-ratio centered overlay
          A5 = 148×210mm ≈ 1:1.414 aspect ratio
         ═══════════════════════════════════════════════════════════ */}
      {showDocument && result && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeDocument} />

          {/* A5 Document */}
          <div
            className="relative bg-surface-900 rounded-2xl ring-1 ring-inset ring-teal/15 shadow-2xl flex flex-col overflow-hidden"
            style={{
              width: 'min(580px, 90vw)',
              height: 'min(820px, 90vh)',
            }}
          >
            {/* Document title bar */}
            <div className="flex items-center justify-between px-8 py-4 border-b border-teal/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-teal/10 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-teal" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-cream">
                    {resultMeta?.type || 'AI Elemzés'}
                  </h2>
                  <p className="text-[11px] text-steel/50">
                    {resultMeta?.date
                      ? new Date(resultMeta.date + 'Z').toLocaleString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : new Date().toLocaleString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    }
                  </p>
                </div>
              </div>
              <button
                onClick={closeDocument}
                className="p-1.5 text-steel hover:text-cream hover:bg-steel/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Document body — scrollable */}
            <div className="flex-1 overflow-y-auto px-10 py-8">
              <div
                className="text-[13px] text-steel/90 leading-[1.8]"
                dangerouslySetInnerHTML={{ __html: `<p class="text-[13px] text-steel/90 leading-[1.8] mb-3">${renderMarkdown(result)}</p>` }}
              />
            </div>

            {/* Document footer */}
            <div className="flex items-center justify-between px-8 py-3 border-t border-teal/10 shrink-0">
              <span className="text-[10px] text-steel/30 tracking-wide">AI ELEMZÉS • KLIENT</span>
              <button
                onClick={closeDocument}
                className="px-3 py-1.5 text-xs text-steel hover:text-cream bg-surface-800/50 border border-teal/10 rounded-lg hover:border-teal/20 transition-colors"
              >
                Bezárás
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
