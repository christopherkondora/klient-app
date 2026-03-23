import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, Receipt, Coins, Upload, Check, AlertTriangle, Clock, X, Loader2, Search, Trash2, ChevronDown, TrendingUp, FileText, Plus, Target, Users, Zap, CreditCard, ArrowUpRight, ArrowDownRight, Minus, Edit2, DollarSign, Quote, Monitor, Megaphone, Building, Server, ShieldCheck, Truck, GraduationCap, Wrench, MoreHorizontal, CalendarClock } from 'lucide-react';
import { format, parseISO, differenceInDays, startOfMonth, subMonths } from 'date-fns';
import { hu } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import InvoiceUploadModal from '../components/InvoiceUploadModal';
import InvoicePdfViewer from '../components/InvoicePdfViewer';
import ManualRevenueModal from '../components/ManualRevenueModal';
import ExpenseModal from '../components/ExpenseModal';
import { useThemedColor } from '../utils/colors';

const CATEGORY_META: Record<string, { label: string; icon: typeof Monitor; color: string; chartColor: string }> = {
  software: { label: 'Szoftver', icon: Monitor, color: 'text-blue-400 bg-blue-500/10', chartColor: '#60a5fa' },
  marketing: { label: 'Marketing', icon: Megaphone, color: 'text-amber-400 bg-amber-500/10', chartColor: '#fbbf24' },
  office: { label: 'Iroda', icon: Building, color: 'text-emerald-400 bg-emerald-500/10', chartColor: '#34d399' },
  hosting: { label: 'Hosting', icon: Server, color: 'text-cyan-400 bg-cyan-500/10', chartColor: '#22d3ee' },
  insurance: { label: 'Biztosítás', icon: ShieldCheck, color: 'text-teal-400 bg-teal-500/10', chartColor: '#2dd4bf' },
  transport: { label: 'Szállítás', icon: Truck, color: 'text-orange-400 bg-orange-500/10', chartColor: '#fb923c' },
  education: { label: 'Képzés', icon: GraduationCap, color: 'text-purple-400 bg-purple-500/10', chartColor: '#a78bfa' },
  equipment: { label: 'Eszközök', icon: Wrench, color: 'text-rose-400 bg-rose-500/10', chartColor: '#fb7185' },
  other: { label: 'Egyéb', icon: MoreHorizontal, color: 'text-steel bg-steel/10', chartColor: '#598392' },
};

const MOTIVATIONAL_QUOTES = [
  { text: 'A siker nem a végcél, hanem az utazás maga.', author: 'Winston Churchill' },
  { text: 'Minden nagy eredmény apró lépésekkel kezdődik.', author: 'Lao-ce' },
  { text: 'A legjobb befektetés, amit tehetsz, a saját fejlődésedbe való befektetés.', author: 'Warren Buffett' },
  { text: 'A munka gyümölcse a legédesebb jutalom.', author: 'Magyar közmondás' },
  { text: 'Ne azt számold, mennyi van hátra – nézd, mennyit értél el.', author: 'Ismeretlen' },
  { text: 'A kitartás az, ami a lehetetlent lehetségessé teszi.', author: 'Nelson Mandela' },
  { text: 'Tervezz úgy, mintha örökké élnél. Dolgozz úgy, mintha holnap meghalnál.', author: 'Andy Warhol' },
  { text: 'A kreativitás intelligencia, ami jól szórakozik.', author: 'Albert Einstein' },
  { text: 'Nem az számít, milyen lassan haladsz, amíg meg nem állsz.', author: 'Confucius' },
  { text: 'A pénz nem boldogít, de a nyugalom, amit ad, felbecsülhetetlen.', author: 'Ismeretlen' },
  { text: 'A fegyelem híd a célok és a megvalósítás között.', author: 'Jim Rohn' },
  { text: 'Az egyetlen korlát az, amit magadnak állítasz.', author: 'Ismeretlen' },
];

export default function Finances() {
  const { user } = useAuth();
  const tc = useThemedColor();
  const hasInvoicing = user?.invoice_platform && user.invoice_platform !== 'none';
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [financeStats, setFinanceStats] = useState<FinanceStats | null>(null);
  const [enhanced, setEnhanced] = useState<EnhancedFinanceStats | null>(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenueRow[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  // Table filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');
  const [clientFilter, setClientFilter] = useState('');
  const [dateRange, setDateRange] = useState<'all' | '30' | '90' | '365'>('all');
  const [showExpectedTooltip, setShowExpectedTooltip] = useState(false);
  const expectedCardRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);

  // Revenue goal editing
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  function handleExpectedHover(show: boolean) {
    setShowExpectedTooltip(show);
    if (show && expectedCardRef.current) {
      const rect = expectedCardRef.current.getBoundingClientRect();
      const tooltipW = 300;
      const tooltipH = 250;
      let left = rect.right + 8;
      let top = rect.top;
      if (left + tooltipW > window.innerWidth - 16) left = rect.left - tooltipW - 8;
      if (top + tooltipH > window.innerHeight - 16) top = window.innerHeight - tooltipH - 16;
      if (top < 16) top = 16;
      setTooltipPos({ top, left });
    }
  }

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [invoicesData, clientsData, stats, revenue, projectsData, enhancedStats, expensesData] = await Promise.all([
        window.electronAPI.getInvoices(),
        window.electronAPI.getClients(),
        window.electronAPI.getFinanceStats(),
        window.electronAPI.getMonthlyRevenue(),
        window.electronAPI.getProjects(),
        window.electronAPI.getEnhancedFinanceStats(),
        window.electronAPI.getExpenses(),
      ]);
      setInvoices(invoicesData);
      setClients(clientsData);
      setProjects(projectsData);
      setFinanceStats(stats);
      setMonthlyRevenue(revenue);
      setEnhanced(enhancedStats);
      setExpenses(expensesData);
    } catch (err) {
      console.error('Failed to load finance data:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount: number, currency = 'HUF') {
    return new Intl.NumberFormat('hu-HU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  }

  function formatCompact(amount: number) {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `${Math.round(amount / 1_000)}K`;
    return String(amount);
  }

  async function handleMarkPaid(id: string) {
    await window.electronAPI.updateInvoice(id, { status: 'paid' });
    loadData();
  }

  async function handleDeleteInvoice(id: string) {
    await window.electronAPI.deleteInvoice(id);
    loadData();
  }

  async function handleDeleteExpense(id: string) {
    await window.electronAPI.deleteExpense(id);
    loadData();
  }

  async function saveRevenueGoal() {
    const val = parseInt(goalInput, 10);
    if (user && !isNaN(val) && val >= 0) {
      await window.electronAPI.updateUser(user.id, { revenue_goal_yearly: val });
      setEditingGoal(false);
      loadData();
    }
  }

  // Pending invoices sorted by urgency
  const pendingInvoices = useMemo(() => {
    const now = new Date();
    return invoices
      .filter(i => i.status === 'pending' || i.status === 'overdue')
      .map(i => {
        const dueDate = i.due_date ? parseISO(i.due_date) : null;
        const daysUntilDue = dueDate ? differenceInDays(dueDate, now) : 999;
        let urgency: 'overdue' | 'soon' | 'normal' = 'normal';
        if (daysUntilDue < 0) urgency = 'overdue';
        else if (daysUntilDue <= 3) urgency = 'soon';
        return { ...i, daysUntilDue, urgency };
      })
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }, [invoices]);

  // Filtered invoices for table
  const filteredInvoices = useMemo(() => {
    let filtered = [...invoices];
    if (statusFilter !== 'all') filtered = filtered.filter(i => i.status === statusFilter);
    if (clientFilter) filtered = filtered.filter(i => i.client_id === clientFilter);
    if (dateRange !== 'all') {
      const cutoff = format(subMonths(new Date(), parseInt(dateRange) / 30), 'yyyy-MM-dd');
      filtered = filtered.filter(i => i.issue_date && i.issue_date >= cutoff);
    }
    return filtered;
  }, [invoices, statusFilter, clientFilter, dateRange]);

  // Chart data — stacked bar (monthly by client)
  const chartData = useMemo(() => {
    if (monthlyRevenue.length === 0) return null;
    const months = [...new Set(monthlyRevenue.map(r => r.month))].sort();
    if (months.length < 2) return null;
    const clientIds = [...new Set(monthlyRevenue.map(r => r.client_id))];
    const clientMap = new Map(monthlyRevenue.map(r => [r.client_id, { name: r.client_name, color: r.client_color }]));
    const bars = months.map(month => {
      const segments = clientIds.map(cid => {
        const row = monthlyRevenue.find(r => r.month === month && r.client_id === cid);
        return { clientId: cid, amount: row?.total || 0 };
      });
      const total = segments.reduce((s, seg) => s + seg.amount, 0);
      return { month, segments, total };
    });
    const maxTotal = Math.max(...bars.map(b => b.total), 1);
    return { bars, maxTotal, clientMap, months };
  }, [monthlyRevenue]);

  // Monthly delta
  const monthlyDelta = useMemo(() => {
    if (!financeStats || !enhanced) return null;
    const current = financeStats.paidThisMonth;
    const prev = enhanced.paidLastMonth;
    if (prev === 0 && current === 0) return null;
    const pct = prev > 0 ? Math.round(((current - prev) / prev) * 100) : (current > 0 ? 100 : 0);
    return { current, prev, pct };
  }, [financeStats, enhanced]);

  // Revenue goal progress
  const goalProgress = useMemo(() => {
    if (!enhanced || !enhanced.revenueGoal || enhanced.revenueGoal <= 0) return null;
    const pct = Math.min(Math.round((enhanced.yearlyRevenue / enhanced.revenueGoal) * 100), 100);
    return { target: enhanced.revenueGoal, current: enhanced.yearlyRevenue, pct };
  }, [enhanced]);

  // Daily motivational quote (rotates each day)
  const dailyQuote = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
    return MOTIVATIONAL_QUOTES[dayOfYear % MOTIVATIONAL_QUOTES.length];
  }, []);

  // Yearly cumulative trend for sparkline
  const cumulativeTrend = useMemo(() => {
    if (!enhanced?.yearlyMonthly || enhanced.yearlyMonthly.length === 0) return null;
    let running = 0;
    return enhanced.yearlyMonthly.map(m => {
      running += m.total;
      return { month: m.month, cumulative: running, monthly: m.total };
    });
  }, [enhanced]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-steel"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-pixel text-xl text-cream">Pénzügyek</h1>
          <p className="text-steel text-sm mt-1">{hasInvoicing ? 'Cash flow és számlakezelés' : 'Bevételi nyilvántartás'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowManualModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors duration-150 ease-out bg-steel/20 text-cream hover:bg-steel/30"
          >
            <Plus width={16} height={16} />
            Bevétel
          </button>
          {hasInvoicing && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors duration-150 ease-out bg-teal text-cream hover:bg-teal/80"
            >
              <FileText width={16} height={16} />
              Számla beolvasása
            </button>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          HERO — Yearly Revenue + Cumulative Sparkline
         ══════════════════════════════════════════════════════════ */}
      <div className="relative bg-surface-800/50 rounded-2xl border-l-[3px] border-teal p-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-teal/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-steel tracking-[0.15em] font-medium mb-1">ÉVES BEVÉTEL • {new Date().getFullYear()}</p>
            <p className="text-4xl font-bold text-cream tracking-tight">{formatCurrency(enhanced?.yearlyRevenue ?? 0)}</p>
            {enhanced && enhanced.yearlyExpenses > 0 && (
              <p className="text-xs text-steel/60 mt-1">
                Kiadások: {formatCurrency(enhanced.yearlyExpenses)} • Profit: <span className="text-emerald-400">{formatCurrency((enhanced.yearlyRevenue) - enhanced.yearlyExpenses)}</span>
              </p>
            )}
            {/* Revenue goal bar */}
            {goalProgress ? (
              <div className="mt-4 max-w-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-steel/60 flex items-center gap-1">
                    <Target width={11} height={11} />
                    Éves cél: {formatCurrency(goalProgress.target)}
                  </span>
                  <span className="text-xs font-bold text-cream">{goalProgress.pct}%</span>
                </div>
                <div className="h-2 bg-surface-900/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-200 ease-out"
                    style={{
                      width: `${goalProgress.pct}%`,
                      background: goalProgress.pct >= 100
                        ? 'linear-gradient(90deg, #10b981, #34d399)'
                        : goalProgress.pct >= 60
                        ? 'linear-gradient(90deg, #124559, #598392)'
                        : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                    }}
                  />
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setEditingGoal(true); setGoalInput(String(enhanced?.revenueGoal || '')); }}
                className="mt-3 text-xs text-steel/40 hover:text-steel transition-colors duration-150 ease-out cursor-pointer flex items-center gap-1"
              >
                <Target width={11} height={11} /> Éves cél beállítása
              </button>
            )}
            {goalProgress && (
              <button
                onClick={() => { setEditingGoal(true); setGoalInput(String(goalProgress.target)); }}
                className="mt-1 text-[10px] text-steel/30 hover:text-steel/50 transition-colors duration-150 ease-out cursor-pointer"
              >
                Cél módosítása
              </button>
            )}
          </div>

          {/* Cumulative sparkline */}
          {cumulativeTrend && cumulativeTrend.length >= 2 && (
            <div className="w-72 h-28 flex-shrink-0 ml-6">
              <svg viewBox="0 0 280 100" className="w-full h-full">
                {/* Area fill */}
                <path
                  d={(() => {
                    const maxVal = Math.max(...cumulativeTrend.map(p => p.cumulative), 1);
                    const points = cumulativeTrend.map((p, i) => ({
                      x: (i / (cumulativeTrend.length - 1)) * 260 + 10,
                      y: 88 - (p.cumulative / maxVal) * 78,
                    }));
                    return `M${points[0].x},88 ${points.map(p => `L${p.x},${p.y}`).join(' ')} L${points[points.length - 1].x},88 Z`;
                  })()}
                  fill="url(#sparkGrad)"
                  opacity="0.3"
                />
                {/* Line */}
                <path
                  d={(() => {
                    const maxVal = Math.max(...cumulativeTrend.map(p => p.cumulative), 1);
                    const points = cumulativeTrend.map((p, i) => ({
                      x: (i / (cumulativeTrend.length - 1)) * 260 + 10,
                      y: 88 - (p.cumulative / maxVal) * 78,
                    }));
                    return `M${points.map(p => `${p.x},${p.y}`).join(' L')}`;
                  })()}
                  fill="none"
                  stroke="#598392"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Dots */}
                {cumulativeTrend.map((p, i) => {
                  const maxVal = Math.max(...cumulativeTrend.map(pt => pt.cumulative), 1);
                  const x = (i / (cumulativeTrend.length - 1)) * 260 + 10;
                  const y = 88 - (p.cumulative / maxVal) * 78;
                  return <circle key={i} cx={x} cy={y} r="3" fill="#598392" />;
                })}
                {/* Month labels */}
                {cumulativeTrend.map((p, i) => {
                  const x = (i / (cumulativeTrend.length - 1)) * 260 + 10;
                  return (
                    <text key={i} x={x} y="99" textAnchor="middle" className="fill-steel/40 text-[9px]">
                      {format(parseISO(p.month + '-01'), 'LLL', { locale: hu })}
                    </text>
                  );
                })}
                <defs>
                  <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#598392" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#598392" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          )}
        </div>

        {/* Revenue goal inline editor */}
        {editingGoal && (
          <div className="mt-3 flex items-center gap-2 max-w-xs">
            <input
              type="number"
              value={goalInput}
              onChange={e => setGoalInput(e.target.value)}
              placeholder="Éves cél (Ft)"
              className="flex-1 px-3 py-1.5 text-sm bg-surface-900 border border-teal/15 rounded-lg text-cream focus:outline-none focus:ring-1 focus:ring-teal/40"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') saveRevenueGoal(); if (e.key === 'Escape') setEditingGoal(false); }}
            />
            <button onClick={saveRevenueGoal} className="px-3 py-1.5 text-xs bg-teal text-cream rounded-lg hover:bg-teal/80 cursor-pointer">Mentés</button>
            <button onClick={() => setEditingGoal(false)} className="px-2 py-1.5 text-xs text-steel hover:text-cream cursor-pointer">Mégsem</button>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          ROW 2 — Monthly comparison · Várható/Függő · Mutatók
         ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Monthly revenue — left 5 cols */}
        <div className="md:col-span-5 bg-surface-800/50 rounded-xl border-l-[3px] border-teal p-5 flex flex-col justify-center">
          <p className="text-xs text-steel tracking-[0.1em] mb-3">HAVI BEVÉTEL</p>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-extrabold text-cream">{formatCurrency(financeStats?.paidThisMonth ?? 0)}</p>
            {monthlyDelta && monthlyDelta.prev > 0 && (
              <span className={`text-sm font-medium px-2 py-0.5 rounded flex items-center gap-0.5 mb-1 ${
                monthlyDelta.pct > 0 ? 'bg-emerald-500/10 text-emerald-400' :
                monthlyDelta.pct < 0 ? 'bg-red-500/10 text-red-400' :
                'bg-steel/10 text-steel'
              }`}>
                {monthlyDelta.pct > 0 ? <ArrowUpRight width={14} height={14} /> :
                 monthlyDelta.pct < 0 ? <ArrowDownRight width={14} height={14} /> :
                 <Minus width={14} height={14} />}
                {monthlyDelta.pct > 0 ? '+' : ''}{monthlyDelta.pct}%
              </span>
            )}
          </div>
          <p className="text-sm text-steel/40 mt-2">
            Előző hónap: {formatCurrency(enhanced?.paidLastMonth ?? 0)}
          </p>
          <div className="mt-3 pt-3 border-t border-teal/10 flex items-start gap-2">
            <Quote width={13} height={13} className="text-teal/30 shrink-0 mt-0.5" />
            <p className="text-xs text-steel/40 italic leading-relaxed">
              {dailyQuote.text} <span className="text-steel/25 not-italic">— {dailyQuote.author}</span>
            </p>
          </div>
        </div>

        {/* Várható + Függő stacked — middle 3 cols */}
        <div className="md:col-span-3 flex flex-col gap-4">
          <div
            ref={expectedCardRef}
            className="bg-surface-800/50 rounded-xl border border-teal/10 p-4 flex-1 cursor-default"
            onMouseEnter={() => handleExpectedHover(true)}
            onMouseLeave={() => handleExpectedHover(false)}
          >
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp width={14} height={14} className="text-teal" />
              <span className="text-xs text-steel tracking-[0.1em]">VÁRHATÓ</span>
            </div>
            <p className="text-xl font-bold text-cream">{formatCurrency(financeStats?.expectedRevenue ?? 0)}</p>
          </div>
          <div className="bg-surface-800/50 rounded-xl border border-teal/10 p-4 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Clock width={14} height={14} className="text-amber-400" />
              <span className="text-xs text-steel tracking-[0.1em]">FÜGGŐ</span>
            </div>
            <p className="text-xl font-bold text-amber-400">{formatCurrency(financeStats?.pendingTotal ?? 0)}</p>
          </div>
        </div>

        {/* Mutatók — right 4 cols */}
        <div className="md:col-span-4 bg-surface-800/50 rounded-xl border border-teal/10 p-5 flex flex-col justify-between">
          <p className="text-xs text-steel tracking-[0.1em]">MUTATÓK</p>
          <div className="border-b border-teal/10 mt-2 mb-4" />
          <div className="space-y-4 flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-between">
              <span className="text-[15px] text-steel/60 flex items-center gap-2"><Zap width={15} height={15} className="text-amber-400" /> Átl. fizetési idő</span>
              <span className="text-[15px] font-bold text-cream">{enhanced?.avgPaymentDays ?? 0} nap</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[15px] text-steel/60 flex items-center gap-2"><CreditCard width={15} height={15} className="text-rose-400" /> Havi kiadás</span>
              <span className="text-[15px] font-bold text-cream">{formatCurrency(enhanced?.monthlyExpenses ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[15px] text-steel/60 flex items-center gap-2"><DollarSign width={15} height={15} className="text-emerald-400" /> Átl. óradíj</span>
              <span className="text-[15px] font-bold text-cream">{formatCurrency(financeStats?.avgHourlyRate ?? 0)}/óra</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          ROW 3 — Kiadások (full width, 2-column)
         ══════════════════════════════════════════════════════════ */}
      <div className="grid md:grid-cols-12 gap-4">

        {/* ── LEFT: Expense list ── */}
        <div className="md:col-span-7 bg-surface-800/50 rounded-xl border border-teal/10 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-steel tracking-[0.15em] font-medium flex items-center gap-1.5">
              <CreditCard width={12} height={12} className="text-rose-400" /> KIADÁSOK
              {expenses.length > 0 && <span className="text-steel/40 font-normal">({expenses.length})</span>}
            </p>
            <button
              onClick={() => { setEditingExpense(null); setShowExpenseModal(true); }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors duration-150 ease-out bg-steel/10 text-steel hover:bg-steel/20 hover:text-cream"
            >
              <Plus width={13} height={13} /> Hozzáadás
            </button>
          </div>
          {expenses.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8">
              <CreditCard width={28} height={28} className="text-steel/20 mb-2" />
              <p className="text-xs text-steel/40 italic">Még nincsenek kiadások rögzítve.</p>
              <p className="text-[10px] text-steel/25 mt-1">Kattints a &quot;Hozzáadás&quot; gombra az első kiadás rögzítéséhez.</p>
            </div>
          ) : (
            <div className="space-y-1.5 overflow-auto flex-1">
              {expenses.map(exp => {
                const catMeta = CATEGORY_META[exp.category] || CATEGORY_META.other;
                const CatIcon = catMeta.icon;
                const freqLabel = exp.frequency === 'monthly' ? 'havi' : exp.frequency === 'yearly' ? 'éves' : 'egyszeri';
                const monthlyHuf = exp.frequency === 'monthly'
                  ? (exp.amount_huf ?? exp.amount)
                  : exp.frequency === 'yearly'
                    ? Math.round((exp.amount_huf ?? exp.amount) / 12)
                    : null;

                // Next payment date calculation for recurring expenses
                let nextPayment: string | null = null;
                if (exp.frequency !== 'one-time' && (!exp.end_date || exp.end_date >= new Date().toISOString().slice(0, 10))) {
                  const start = new Date(exp.start_date);
                  const now = new Date();
                  const next = new Date(start);
                  if (exp.frequency === 'monthly') {
                    while (next <= now) next.setMonth(next.getMonth() + 1);
                  } else {
                    while (next <= now) next.setFullYear(next.getFullYear() + 1);
                  }
                  const diffDays = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  nextPayment = diffDays <= 0 ? 'ma' : diffDays === 1 ? 'holnap' : `${diffDays} nap múlva`;
                }

                return (
                  <div key={exp.id} className="flex items-center gap-3 p-3 bg-surface-900/30 rounded-lg group transition-colors duration-150 ease-out hover:bg-surface-900/50">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${catMeta.color.split(' ')[1]}`}>
                      <CatIcon width={14} height={14} className={catMeta.color.split(' ')[0]} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-cream truncate font-medium">{exp.name}</p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${catMeta.color}`}>{catMeta.label}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-steel/50">
                          {exp.type === 'subscription' ? 'Előfizetés' : 'Beruházás'} • {freqLabel}
                        </p>
                        {nextPayment && (
                          <span className="text-[10px] text-steel/40 flex items-center gap-0.5">
                            <CalendarClock width={8} height={8} /> {nextPayment}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold text-cream block">{formatCurrency(exp.amount, exp.currency)}</span>
                      {monthlyHuf !== null && exp.frequency !== 'monthly' && (
                        <span className="text-[10px] text-steel/40">~{formatCurrency(monthlyHuf)}/hó</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-out shrink-0">
                      <button
                        onClick={() => { setEditingExpense(exp); setShowExpenseModal(true); }}
                        className="p-1 rounded hover:bg-teal/10 text-steel/40 hover:text-cream transition-colors duration-150 ease-out cursor-pointer"
                      >
                        <Edit2 width={11} height={11} />
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="p-1 rounded hover:bg-red-500/10 text-steel/40 hover:text-red-400 transition-colors duration-150 ease-out cursor-pointer"
                      >
                        <Trash2 width={11} height={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* Summary footer */}
          {expenses.length > 0 && enhanced && enhanced.monthlyExpenses > 0 && (
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-teal/8">
              <span className="text-[10px] text-steel/40">Összesítés</span>
              <div className="flex items-center gap-4">
                <span className="text-[11px] text-steel/60">Havi: <span className="font-bold text-cream">{formatCurrency(enhanced.monthlyExpenses)}</span></span>
                <span className="text-[11px] text-steel/60">Éves: <span className="font-bold text-cream">{formatCurrency(enhanced.yearlyExpenses)}</span></span>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Donut chart + Trend ── */}
        <div className="md:col-span-5 flex flex-col gap-4">

          {/* Donut chart — category breakdown */}
          <div className="bg-surface-800/50 rounded-xl border border-teal/10 p-5 flex-1">
            <p className="text-xs text-steel tracking-[0.15em] font-medium mb-4">KATEGÓRIA MEGOSZLÁS</p>
            {(() => {
              const cats = enhanced?.expensesByCategory ?? [];
              if (cats.length === 0) return <p className="text-[11px] text-steel/30 italic text-center py-6">Nincs adat</p>;
              const total = cats.reduce((s, c) => s + c.total, 0);
              // SVG donut chart
              const size = 120;
              const cx = size / 2, cy = size / 2, r = 44, stroke = 12;
              const circumference = 2 * Math.PI * r;
              let offset = 0;
              return (
                <div className="flex items-center gap-5">
                  <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
                    {cats.map((cat, i) => {
                      const meta = CATEGORY_META[cat.category] || CATEGORY_META.other;
                      const pct = cat.total / total;
                      const dashLen = pct * circumference;
                      const dashOffset = -offset;
                      offset += dashLen;
                      return (
                        <circle
                          key={cat.category || i}
                          cx={cx} cy={cy} r={r}
                          fill="none"
                          stroke={meta.chartColor}
                          strokeWidth={stroke}
                          strokeDasharray={`${dashLen} ${circumference - dashLen}`}
                          strokeDashoffset={dashOffset}
                          transform={`rotate(-90 ${cx} ${cy})`}
                          className="transition-all duration-300"
                        />
                      );
                    })}
                    <text x={cx} y={cy - 4} textAnchor="middle" className="fill-cream text-sm font-bold">{formatCompact(total)}</text>
                    <text x={cx} y={cy + 10} textAnchor="middle" className="fill-steel text-[9px]">Ft/év</text>
                  </svg>
                  <div className="flex-1 space-y-1.5">
                    {cats.map((cat, i) => {
                      const meta = CATEGORY_META[cat.category] || CATEGORY_META.other;
                      const pct = Math.round((cat.total / total) * 100);
                      return (
                        <div key={cat.category || i} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.chartColor }} />
                          <span className="text-[11px] text-steel flex-1 truncate">{meta.label}</span>
                          <span className="text-[11px] text-steel/50 shrink-0">{pct}%</span>
                          <span className="text-[11px] font-medium text-cream shrink-0 w-16 text-right">{formatCompact(Math.round(cat.total))}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Expense trend sparkline */}
          <div className="bg-surface-800/50 rounded-xl border border-teal/10 p-5">
            <p className="text-xs text-steel tracking-[0.15em] font-medium mb-3 flex items-center gap-1.5">
              <TrendingUp width={12} height={12} className="text-rose-400" /> KIADÁS TREND
            </p>
            {(() => {
              const trend = enhanced?.monthlyExpensesTrend ?? [];
              if (trend.length < 2) return <p className="text-[11px] text-steel/30 italic text-center py-4">Legalább 2 hónapnyi adat szükséges</p>;
              const maxVal = Math.max(...trend.map(t => t.total), 1);
              const w = 280, h = 80;
              const padX = 0, padY = 8;
              const stepX = (w - padX * 2) / (trend.length - 1);
              const points = trend.map((t, i) => ({
                x: padX + i * stepX,
                y: padY + (h - padY * 2) * (1 - t.total / maxVal),
                total: t.total,
                month: t.month,
              }));
              const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
              const areaPath = `${linePath} L${points[points.length - 1].x},${h} L${points[0].x},${h} Z`;
              return (
                <div>
                  <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20">
                    <defs>
                      <linearGradient id="expTrendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb7185" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={areaPath} fill="url(#expTrendGrad)" />
                    <path d={linePath} fill="none" stroke="#fb7185" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    {points.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#fb7185" stroke="#01161E" strokeWidth="1" />
                    ))}
                  </svg>
                  <div className="flex justify-between mt-1">
                    {trend.map((t, i) => (
                      <span key={i} className="text-[8px] text-steel/30" style={{ width: i === 0 ? 'auto' : i === trend.length - 1 ? 'auto' : '0', textAlign: i === 0 ? 'left' : i === trend.length - 1 ? 'right' : 'center', flex: i === 0 || i === trend.length - 1 ? 'none' : '1' }}>
                        {i === 0 || i === trend.length - 1 ? t.month.slice(5) : ''}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Expected revenue hover tooltip — portal */}
      {showExpectedTooltip && financeStats && tooltipPos && createPortal(
        <div
          className="fixed z-[9999] bg-surface-900 border border-teal/15 rounded-xl shadow-2xl p-4 w-[300px]"
          style={{ top: tooltipPos.top, left: tooltipPos.left }}
          onMouseEnter={() => setShowExpectedTooltip(true)}
          onMouseLeave={() => handleExpectedHover(false)}
        >
          <p className="text-xs text-steel/70 mb-2">
            Átl. óradíj (fizetett számlákból): <span className="text-ash font-bold">{formatCurrency(financeStats.avgHourlyRate)}/óra</span>
          </p>
          {financeStats.expectedBreakdown.length > 0 ? (
            <div className="space-y-1">
              {financeStats.expectedBreakdown.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="text-cream truncate flex-1">{item.projectName}</span>
                  {item.isCompleted && (
                    <span className="shrink-0 text-[9px] px-1 py-0.5 rounded text-amber-400 bg-amber-400/10">kész</span>
                  )}
                  <span className={`shrink-0 text-[9px] px-1 py-0.5 rounded ${item.isInvoiced ? 'text-emerald-400 bg-emerald-400/10' : 'text-steel/50'}`}>
                    {item.isInvoiced ? 'számlázott' : `${item.hours}h × óradíj`}
                  </span>
                  <span className="text-cream font-medium shrink-0 text-right w-20">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-steel/40 italic">Nincs nem kifizetett projekt</p>
          )}
          <div className="border-t border-teal/10 mt-2 pt-1.5 flex items-center justify-between">
            <span className="text-xs text-steel/50">Σ nem kifizetett projektek</span>
            <span className="text-xs font-bold text-cream">{formatCurrency(financeStats.expectedRevenue)}</span>
          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════════════════════════
          PENDING INVOICES
         ══════════════════════════════════════════════════════════ */}
      {pendingInvoices.length > 0 && (
        <div className="bg-surface-800/50 rounded-xl border border-teal/10 p-5">
          <h2 className="font-pixel text-sm text-cream mb-4">
            {hasInvoicing ? 'Függő számlák' : 'Függő bevételek'}
            <span className="ml-2 text-xs text-steel font-sans">({pendingInvoices.length})</span>
          </h2>
          <div className="space-y-2">
            {pendingInvoices.map(invoice => {
              const borderColor = invoice.urgency === 'overdue' ? 'border-l-red-500' :
                invoice.urgency === 'soon' ? 'border-l-amber-500' : 'border-l-steel/20';
              const bgColor = invoice.urgency === 'overdue' ? 'bg-red-500/5' :
                invoice.urgency === 'soon' ? 'bg-amber-500/5' : 'bg-surface-900/30';
              return (
                <div key={invoice.id} className={`flex items-center justify-between p-3.5 rounded-lg border-l-[3px] ${borderColor} ${bgColor}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-cream truncate">{invoice.client_name || 'Ismeretlen'}</h3>
                      {invoice.urgency === 'overdue' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-medium shrink-0">
                          Lejárt {Math.abs(invoice.daysUntilDue)} napja
                        </span>
                      )}
                      {invoice.urgency === 'soon' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-medium shrink-0">
                          {invoice.daysUntilDue === 0 ? 'Ma esedékes' : `${invoice.daysUntilDue} nap`}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-steel mt-0.5">
                      {invoice.invoice_number || 'Automatikus'} • {invoice.due_date ? format(parseISO(invoice.due_date), 'yyyy. MM. dd.') : '-'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-lg font-bold ${
                      invoice.urgency === 'overdue' ? 'text-red-400' :
                      invoice.urgency === 'soon' ? 'text-amber-400' : 'text-cream'
                    }`}>
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </span>
                    <button
                      onClick={() => handleMarkPaid(invoice.id)}
                      className="px-3 py-1.5 text-xs font-medium bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors duration-150 ease-out cursor-pointer"
                    >
                      Megérkezett
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          REVENUE CHART
         ══════════════════════════════════════════════════════════ */}
      <div className="bg-surface-800/50 rounded-xl border border-teal/10 p-5">
        <h2 className="font-pixel text-sm text-cream mb-4">Bevételi grafikon</h2>
        {!chartData ? (
          <div className="text-center py-12">
            <BarChart3 width={32} height={32} className="text-steel/30 mx-auto mb-3" />
            <p className="text-sm text-steel/60 italic">
              {hasInvoicing
                ? 'Az első lezárt számlád után a bevételi grafikon automatikusan elindul.'
                : 'Az első bevétel rögzítése után a grafikon automatikusan elindul.'
              }
            </p>
          </div>
        ) : (
          <div>
            {/* Stacked bar chart */}
            <div className="flex items-end gap-2 h-48 mb-3">
              {chartData.bars.map((bar) => (
                <div key={bar.month} className="flex-1 flex flex-col items-stretch justify-end h-full relative group">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface-900 border border-teal/15 rounded px-2 py-1 text-[10px] text-cream whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-out z-10 pointer-events-none">
                    {formatCurrency(bar.total)}
                  </div>
                  <div className="flex flex-col justify-end" style={{ height: `${(bar.total / chartData.maxTotal) * 100}%` }}>
                    {bar.segments.filter(s => s.amount > 0).map((seg, i) => {
                      const info = chartData.clientMap.get(seg.clientId);
                      return (
                        <div
                          key={seg.clientId}
                          className={`w-full ${i === 0 ? 'rounded-t' : ''}`}
                          style={{
                            height: `${(seg.amount / bar.total) * 100}%`,
                            backgroundColor: tc(info?.color),
                            minHeight: '2px',
                          }}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-steel/50 text-center mt-1.5">
                    {format(parseISO(bar.month + '-01'), 'MMM', { locale: hu })}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-steel/60">
              <TrendingUp width={12} height={12} />
              {(() => {
                const totals = chartData.bars.map(b => b.total);
                const recent = totals.slice(-3).reduce((s, v) => s + v, 0) / Math.min(totals.length, 3);
                const older = totals.slice(0, -3).reduce((s, v) => s + v, 0) / Math.max(totals.length - 3, 1);
                if (older === 0) return <span>Kezd épülni a trend...</span>;
                const pct = ((recent - older) / older * 100).toFixed(0);
                return <span>{Number(pct) >= 0 ? '+' : ''}{pct}% az elmúlt 3 hónapban</span>;
              })()}
            </div>
            <div className="flex flex-wrap gap-3 mt-3">
              {[...chartData.clientMap.entries()].map(([id, info]) => (
                <div key={id} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tc(info.color) }} />
                  <span className="text-xs text-steel">{info.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          ROW — Top ügyfelek · Havi profit
         ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Top ügyfelek — left 5 cols */}
        <div className="md:col-span-5 bg-surface-800/50 rounded-xl border border-teal/10 p-5 flex flex-col">
          <p className="text-xs text-steel tracking-[0.15em] font-medium flex items-center gap-1.5"><Users width={12} height={12} /> TOP ÜGYFELEK</p>
          <div className="border-b border-teal/10 mt-2 mb-3" />
          {enhanced && enhanced.topClients.length > 0 ? (
            <div className="flex-1 flex flex-col justify-between">
              {enhanced.topClients.map((client) => {
                const maxTotal = enhanced.topClients[0].total;
                const pct = maxTotal > 0 ? (client.total / maxTotal) * 100 : 0;
                return (
                  <div key={client.id}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tc(client.color) }} />
                      <span className="text-sm text-cream flex-1 truncate">{client.name}</span>
                      <span className="text-sm font-bold text-cream">{formatCurrency(client.total)}</span>
                    </div>
                    <div className="ml-4 h-1 bg-surface-900/60 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-200 ease-out"
                        style={{ width: `${pct}%`, backgroundColor: tc(client.color), opacity: 0.6 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4">
              <Users width={20} height={20} className="text-steel/20 mx-auto mb-1" />
              <p className="text-xs text-steel/40 italic">Még nincsenek fizetett számlák</p>
            </div>
          )}
        </div>

        {/* Havi profit — right 7 cols */}
        <div className="md:col-span-7 bg-surface-800/50 rounded-xl border-l-[3px] border-teal p-5 flex flex-col">
          <p className="text-xs text-steel tracking-[0.15em] font-medium flex items-center gap-1.5 mb-4">
            <BarChart3 width={12} height={12} className="text-emerald-400" /> HAVI PROFIT
          </p>
          {(() => {
            const revenue = financeStats?.paidThisMonth ?? 0;
            const expense = enhanced?.monthlyExpenses ?? 0;
            const profit = revenue - expense;
            const maxBar = Math.max(revenue, expense, 1);
            return (
              <div className="flex-1 flex flex-col justify-between">
                {/* Revenue bar */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-steel/60">Bevétel</span>
                    <span className="text-sm font-bold text-cream">{formatCurrency(revenue)}</span>
                  </div>
                  <div className="h-1.5 bg-surface-900/60 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-200 ease-out"
                      style={{ width: `${(revenue / maxBar) * 100}%`, background: 'linear-gradient(90deg, #124559, #598392)' }}
                    />
                  </div>
                </div>
                {/* Expense bar */}
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-steel/60">Kiadás</span>
                    <span className="text-sm font-bold text-cream">{formatCurrency(expense)}</span>
                  </div>
                  <div className="h-1.5 bg-surface-900/60 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-200 ease-out"
                      style={{ width: `${(expense / maxBar) * 100}%`, background: 'linear-gradient(90deg, #e11d48, #fb7185)' }}
                    />
                  </div>
                </div>
                {/* Profit line */}
                <div className="border-t border-teal/10 pt-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-steel/70">Profit</span>
                  <span className={`text-sm font-extrabold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
                  </span>
                </div>
                {/* Margin */}
                {revenue > 0 && (
                  <div className="flex items-center justify-between text-xs text-steel/40">
                    <span>Profit margin</span>
                    <span className={`font-medium ${profit >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                      {Math.round((profit / revenue) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          INVOICES TABLE
         ══════════════════════════════════════════════════════════ */}
      <div className="bg-surface-800/50 rounded-xl border border-teal/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-pixel text-sm text-cream">
            {hasInvoicing ? 'Összes számla' : 'Bevételi nyilvántartás'}
            <span className="ml-2 text-xs text-steel font-sans">({filteredInvoices.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
              className="text-xs px-2 py-1 bg-surface-900 border border-teal/10 rounded-md text-steel focus:outline-none focus:ring-1 focus:ring-teal/30"
            >
              <option value="all">Mind</option>
              <option value="paid">Fizetve</option>
              <option value="pending">Függő</option>
              <option value="overdue">Lejárt</option>
            </select>
            <select
              value={clientFilter}
              onChange={e => setClientFilter(e.target.value)}
              className="text-xs px-2 py-1 bg-surface-900 border border-teal/10 rounded-md text-steel focus:outline-none focus:ring-1 focus:ring-teal/30"
            >
              <option value="">Minden ügyfél</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value as typeof dateRange)}
              className="text-xs px-2 py-1 bg-surface-900 border border-teal/10 rounded-md text-steel focus:outline-none focus:ring-1 focus:ring-teal/30"
            >
              <option value="all">Minden idő</option>
              <option value="30">30 nap</option>
              <option value="90">90 nap</option>
              <option value="365">1 év</option>
            </select>
          </div>
        </div>
        {filteredInvoices.length === 0 ? (
          <p className="text-sm text-steel/60 italic text-center py-8">
            {invoices.length === 0
              ? (hasInvoicing ? 'Még nincsenek számlák. Használd a "Számla beolvasása" gombot!' : 'Még nincsenek bevételek. Rögzíts egyet a "Bevétel rögzítése" gombbal!')
              : (hasInvoicing ? 'Nincs a szűrésnek megfelelő számla.' : 'Nincs a szűrésnek megfelelő bevétel.')
            }
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-teal/10">
                  <th className="text-left py-2 px-3 text-xs font-medium text-steel/60">{hasInvoicing ? 'Számla' : 'Azon.'}</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-steel/60">Ügyfél</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-steel/60">{hasInvoicing ? 'Kiállítás' : 'Dátum'}</th>
                  {hasInvoicing && <th className="text-left py-2 px-3 text-xs font-medium text-steel/60">Határidő</th>}
                  <th className="text-left py-2 px-3 text-xs font-medium text-steel/60">Státusz</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-steel/60">Összeg</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-steel/60"></th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(invoice => (
                  <tr key={invoice.id} className="border-b border-teal/5 hover:bg-teal/5 transition-colors duration-150 ease-out">
                    <td className="py-2.5 px-3 font-medium text-cream">
                      {invoice.invoice_number || <span className="text-steel/30 italic text-xs">Automatikus</span>}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        {invoice.client_color && <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tc(invoice.client_color) }} />}
                        <span className="text-steel">{invoice.client_name || '-'}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-steel/60">
                      {invoice.issue_date ? format(parseISO(invoice.issue_date), 'yyyy. MM. dd.') : '-'}
                    </td>
                    {hasInvoicing && (
                      <td className="py-2.5 px-3 text-steel/60">
                        {invoice.due_date ? format(parseISO(invoice.due_date), 'yyyy. MM. dd.') : '-'}
                      </td>
                    )}
                    <td className="py-2.5 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        invoice.status === 'paid' ? 'bg-emerald-500/15 text-emerald-400' :
                        invoice.status === 'overdue' ? 'bg-red-500/15 text-red-400' :
                        'bg-amber-500/15 text-amber-400'
                      }`}>
                        {invoice.status === 'paid' ? 'Fizetve' : invoice.status === 'overdue' ? 'Lejárt' : 'Függő'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-cream">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {invoice.file_path && (
                          <button
                            onClick={() => setViewingInvoice(invoice)}
                            className="p-1 rounded hover:bg-teal/10 text-steel/40 hover:text-cream transition-colors duration-150 ease-out cursor-pointer"
                            title="PDF megnyitása"
                          >
                            <FileText width={13} height={13} />
                          </button>
                        )}
                        {invoice.status === 'pending' && (
                          <button
                            onClick={() => handleMarkPaid(invoice.id)}
                            className="p-1 rounded hover:bg-emerald-500/10 text-steel/40 hover:text-emerald-400 transition-colors duration-150 ease-out cursor-pointer"
                            title="Megérkezett"
                          >
                            <Check width={13} height={13} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteInvoice(invoice.id)}
                          className="p-1 rounded hover:bg-red-500/10 text-steel/40 hover:text-red-400 transition-colors duration-150 ease-out cursor-pointer"
                          title="Törlés"
                        >
                          <Trash2 width={13} height={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showUploadModal && hasInvoicing && (
        <InvoiceUploadModal
          clients={clients}
          projects={projects}
          onClose={() => setShowUploadModal(false)}
          onSaved={() => { setShowUploadModal(false); loadData(); }}
        />
      )}
      {showManualModal && (
        <ManualRevenueModal
          clients={clients}
          projects={projects}
          onClose={() => setShowManualModal(false)}
          onSaved={() => { setShowManualModal(false); loadData(); }}
        />
      )}
      {viewingInvoice && viewingInvoice.file_path && (
        <InvoicePdfViewer invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} />
      )}
      {showExpenseModal && (
        <ExpenseModal
          expense={editingExpense}
          onClose={() => { setShowExpenseModal(false); setEditingExpense(null); }}
          onSaved={() => { setShowExpenseModal(false); setEditingExpense(null); loadData(); }}
        />
      )}
    </div>
  );
}
