import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, Receipt, Coins, Upload, Check, AlertTriangle, Clock, X, Loader2, Search, Trash2, ChevronDown, TrendingUp, FileText, Plus, Target, Users, CreditCard, ArrowUpRight, ArrowDownRight, Minus, Edit2, Monitor, Megaphone, Building, Server, ShieldCheck, Truck, GraduationCap, Wrench, MoreHorizontal, CalendarClock } from 'lucide-react';
import { format, parseISO, differenceInDays, startOfMonth, subMonths } from 'date-fns';
import { hu } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import InvoiceUploadModal from '../components/InvoiceUploadModal';
import InvoicePdfViewer from '../components/InvoicePdfViewer';
import ManualRevenueModal from '../components/ManualRevenueModal';
import ExpenseModal from '../components/ExpenseModal';
import TaxSection from '../components/TaxSection';
import PageHeader from '../components/PageHeader';
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
  berkoltseg: { label: 'Bérköltség', icon: Users, color: 'text-violet-400 bg-violet-500/10', chartColor: '#a78bfa' },
  alvallalkozo: { label: 'Alvállalkozó', icon: Users, color: 'text-indigo-400 bg-indigo-500/10', chartColor: '#818cf8' },
  other: { label: 'Egyéb', icon: MoreHorizontal, color: 'text-steel bg-steel/10', chartColor: '#598392' },
};

export default function Finances() {
  const { user } = useAuth();
  const tc = useThemedColor();
  const isBusiness = user?.is_business !== 0;
  // Számlázás csak vállalkozói módban és csak ha be van állítva platform.
  const hasInvoicing = isBusiness && !!user?.invoice_platform && user.invoice_platform !== 'none';
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
  const [invoicePage, setInvoicePage] = useState(1);
  const INVOICES_PER_PAGE = 10;
  const [revenuePeriod, setRevenuePeriod] = useState<7 | 30 | 365>(30);
  const [showExpectedTooltip, setShowExpectedTooltip] = useState(false);
  const expectedCardRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);

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
    // Update local DB first
    await window.electronAPI.updateInvoice(id, { status: 'paid' });
    // If the invoice has a provider + provider_invoice_id, also sync to billing provider
    const invoice = invoices.find(i => i.id === id);
    if (invoice?.provider && invoice.provider_invoice_id) {
      try {
        const res = await window.electronAPI.billingMarkInvoicePaid(
          invoice.provider_invoice_id,
          invoice.provider,
          invoice.amount,
        );
        if (!res.success) {
          console.error('[Finances] Failed to mark invoice paid on provider:', res.error);
        }
      } catch (err) {
        console.error('[Finances] Provider mark-paid sync error:', err);
      }
    }
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

  async function handleOpenInvoicePdf(invoice: Invoice) {
    const client = clients.find(item => item.id === invoice.client_id);
    const result = await window.electronAPI.ensureInvoicePdf({
      invoiceId: invoice.id,
      filePath: invoice.file_path,
      provider: invoice.provider,
      providerInvoiceId: invoice.provider_invoice_id,
      clientName: client?.name ?? invoice.client_name,
      invoiceNumber: invoice.invoice_number,
    });

    if (result.success && result.filePath) {
      setViewingInvoice({ ...invoice, file_path: result.filePath });
      if (result.filePath !== invoice.file_path) loadData();
    } else {
      console.warn('[Finances] Could not open invoice PDF:', result.error);
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

  // Period revenue stat (last 7 / 30 / 365 days vs previous same-length window)
  // Pénzforgalmi szemlélet: paid_date + paid_amount_huf (beérkezéskori árfolyam).
  // Fallback régi rekordokra: issue_date + amount_huf.
  const periodRevenueStat = useMemo(() => {
    const now = new Date();
    const msPerDay = 86_400_000;
    const paidInvoices = invoices.filter(i => i.status === 'paid');
    const currentStart = new Date(now.getTime() - revenuePeriod * msPerDay);
    const previousStart = new Date(now.getTime() - 2 * revenuePeriod * msPerDay);
    const dateOf = (i: Invoice) => i.paid_date || i.issue_date;
    const hufOf = (i: Invoice) => i.paid_amount_huf ?? i.amount_huf ?? i.amount;
    const current = paidInvoices
      .filter(i => dateOf(i) && new Date(dateOf(i) as string) >= currentStart)
      .reduce((sum, i) => sum + hufOf(i), 0);
    const previous = paidInvoices
      .filter(i => {
        const d = dateOf(i);
        if (!d) return false;
        const dt = new Date(d);
        return dt >= previousStart && dt < currentStart;
      })
      .reduce((sum, i) => sum + hufOf(i), 0);
    const pct = previous > 0
      ? Math.round(((current - previous) / previous) * 100)
      : current > 0 ? 100 : null;
    return { current, previous, pct };
  }, [invoices, revenuePeriod]);

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

  const salaryCostItems = enhanced?.employeeSalaryItems ?? [];
  const contractorCostItems = enhanced?.teamCostItems ?? [];
  const visibleCostCount = expenses.length + salaryCostItems.length + contractorCostItems.length;
  const personnelCostCount = salaryCostItems.length + contractorCostItems.length;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Pénzügyek"
        subtitle={!isBusiness ? 'Bevételi és költségnyilvántartás' : (hasInvoicing ? 'Cash flow és számlakezelés' : 'Bevételi nyilvántartás')}
        actions={(
          <>
            <button
              onClick={() => setShowManualModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors duration-150 ease-out bg-steel/20 text-cream hover:bg-steel/30"
            >
              <Plus width={16} height={16} />
              Egyéb bevétel
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
          </>
        )}
      />

      {/* ══════════════════════════════════════════════════════════
          HERO — Nettó árbevétel (ÁFA-mentes) + Cumulative Sparkline
         ══════════════════════════════════════════════════════════ */}
      <div className="relative bg-surface-800/50 rounded-2xl border-l-[3px] border-teal p-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-teal/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <p className="text-xs text-steel tracking-[0.15em] font-medium">
                {revenuePeriod === 365
                  ? (enhanced?.vatStatus === 'standard' ? 'NETTÓ ÁRBEVÉTEL' : 'ÉVES ÁRBEVÉTEL') + ' • ' + new Date().getFullYear()
                  : revenuePeriod === 30 ? 'ÁRBEVÉTEL • ELMÚLT 30 NAP'
                  : 'ÁRBEVÉTEL • ELMÚLT 7 NAP'}
              </p>
              <div className="flex items-center gap-0.5 bg-surface-900/40 rounded-lg p-0.5">
                {([7, 30, 365] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setRevenuePeriod(p)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-medium cursor-pointer transition-colors duration-150 ease-out ${
                      revenuePeriod === p ? 'bg-teal/20 text-teal' : 'text-steel/50 hover:text-steel'
                    }`}
                  >
                    {p === 7 ? 'Heti' : p === 30 ? 'Havi' : 'Éves'}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-5xl font-bold text-cream tracking-tight">
              {revenuePeriod === 365
                ? formatCurrency(
                    enhanced?.vatStatus === 'standard'
                      ? (enhanced?.yearlyNetRevenue ?? enhanced?.yearlyRevenue ?? 0)
                      : (enhanced?.yearlyRevenue ?? 0)
                  )
                : formatCurrency(periodRevenueStat.current)}
            </p>
            {revenuePeriod === 365 && enhanced ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
                {enhanced.vatStatus === 'standard' && (
                  <span className="text-steel/60">
                    Bruttó: <span className="text-steel">{formatCurrency(enhanced.yearlyRevenue)}</span>
                  </span>
                )}
                <span className="text-steel/60">
                  Költség: <span className="text-steel">{formatCurrency(enhanced.yearlyExpenses)}</span>
                </span>
                {(() => {
                  const net = enhanced.vatStatus === 'standard'
                    ? (enhanced.yearlyNetRevenue ?? enhanced.yearlyRevenue)
                    : enhanced.yearlyRevenue;
                  const profit = net - enhanced.yearlyExpenses;
                  const margin = net > 0 ? Math.round((profit / net) * 100) : 0;
                  return (
                    <>
                      <span className="text-steel/60">
                        Nyereség: <span className={profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatCurrency(profit)}</span>
                      </span>
                      <span className="text-steel/60">
                        Árrés: <span className={margin >= 0 ? 'text-cream' : 'text-red-400'}>{margin}%</span>
                      </span>
                    </>
                  );
                })()}
                {enhanced.vatStatus === 'standard' && typeof enhanced.vatBalance === 'number' && (
                  <span className="text-steel/60">
                    ÁFA egyenleg: <span className={enhanced.vatBalance > 0 ? 'text-cream' : 'text-emerald-400'}>{formatCurrency(enhanced.vatBalance)}</span>
                  </span>
                )}
              </div>
            ) : revenuePeriod !== 365 ? (
              <div className="mt-3 flex items-center gap-4 text-xs">
                <span className="text-steel/60">
                  Előző {revenuePeriod === 7 ? '7 nap' : 'hónap'}: <span className="text-steel">{formatCurrency(periodRevenueStat.previous)}</span>
                </span>
                {periodRevenueStat.pct !== null && periodRevenueStat.previous > 0 && (
                  <span className={`font-medium px-2 py-0.5 rounded flex items-center gap-0.5 ${
                    periodRevenueStat.pct > 0 ? 'bg-emerald-500/10 text-emerald-400' :
                    periodRevenueStat.pct < 0 ? 'bg-red-500/10 text-red-400' :
                    'bg-steel/10 text-steel'
                  }`}>
                    {periodRevenueStat.pct > 0 ? <ArrowUpRight width={12} height={12} /> :
                     periodRevenueStat.pct < 0 ? <ArrowDownRight width={12} height={12} /> :
                     <Minus width={12} height={12} />}
                    {periodRevenueStat.pct > 0 ? '+' : ''}{periodRevenueStat.pct}%
                  </span>
                )}
              </div>
            ) : null}
          </div>

          {/* Cumulative sparkline — only on yearly view */}
          {revenuePeriod === 365 && cumulativeTrend && cumulativeTrend.length >= 2 && (
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
      </div>

      {/* ══════════════════════════════════════════════════════════
          ADÓZÁS — ÁFA státusz + becsült adók (csak vállalkozói módban)
         ══════════════════════════════════════════════════════════ */}
      {isBusiness && (
        <TaxSection
          yearlyRevenue={enhanced?.yearlyRevenue ?? 0}
          yearlyNetRevenue={enhanced?.yearlyNetRevenue}
          vatPayable={enhanced?.vatPayable}
          vatDeductible={enhanced?.vatDeductible}
          vatBalance={enhanced?.vatBalance}
          vatStatus={enhanced?.vatStatus}
          onVatChanged={loadData}
        />
      )}
      {/* ══════════════════════════════════════════════════════════
          ROW 2 — Havi bevétel · Várható · Függő
         ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">

        {/* Havi bevétel — left 6 cols */}
        <div className="md:col-span-6 bg-surface-800/50 rounded-xl border-l-[3px] border-teal p-6 flex flex-col gap-4">
          <div>
            <p className="text-[10px] text-steel/60 tracking-[0.15em] uppercase mb-3">Havi bevétel</p>
            <div className="flex items-end gap-3">
              <p className="text-4xl font-bold text-cream tracking-tight">{formatCurrency(financeStats?.paidThisMonth ?? 0)}</p>
              {monthlyDelta && monthlyDelta.prev > 0 && (
                <span className={`text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-0.5 mb-1 ${
                  monthlyDelta.pct > 0 ? 'bg-emerald-500/10 text-emerald-400' :
                  monthlyDelta.pct < 0 ? 'bg-red-500/10 text-red-400' :
                  'bg-steel/10 text-steel'
                }`}>
                  {monthlyDelta.pct > 0 ? <ArrowUpRight width={12} height={12} /> :
                   monthlyDelta.pct < 0 ? <ArrowDownRight width={12} height={12} /> :
                   <Minus width={12} height={12} />}
                  {monthlyDelta.pct > 0 ? '+' : ''}{monthlyDelta.pct}%
                </span>
              )}
            </div>
          </div>
          <div className="mt-auto pt-4 border-t border-teal/8 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-steel/40 tracking-wider uppercase mb-1">Előző hónap</p>
              <p className="text-sm font-medium text-steel">{formatCurrency(enhanced?.paidLastMonth ?? 0)}</p>
            </div>
            <div>
              <p className="text-[10px] text-steel/40 tracking-wider uppercase mb-1">Átl. óradíj</p>
              <p className="text-sm font-medium text-steel">{formatCurrency(financeStats?.avgHourlyRate ?? 0)}<span className="text-steel/40">/óra</span></p>
            </div>
          </div>
        </div>

        {/* Várható — middle 3 cols */}
        <div
          ref={expectedCardRef}
          className="md:col-span-3 bg-surface-800/50 rounded-xl border-l-[3px] border-teal/40 p-6 flex flex-col gap-3 cursor-default"
          onMouseEnter={() => handleExpectedHover(true)}
          onMouseLeave={() => handleExpectedHover(false)}
        >
          <div className="flex items-center gap-2">
            <TrendingUp width={13} height={13} className="text-teal/70" />
            <p className="text-[10px] text-steel/60 tracking-[0.15em] uppercase">Várható</p>
          </div>
          <p className="text-3xl font-bold text-cream tracking-tight">{formatCurrency(financeStats?.expectedRevenue ?? 0)}</p>
          <p className="text-xs text-steel/40 mt-auto">Folyamatban lévő projektek becsült bevétele</p>
        </div>

        {/* Függő — right 3 cols */}
        <div className="md:col-span-3 bg-surface-800/50 rounded-xl border-l-[3px] border-amber-400/50 p-6 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Clock width={13} height={13} className="text-amber-400/70" />
            <p className="text-[10px] text-steel/60 tracking-[0.15em] uppercase">Függő</p>
          </div>
          <p className="text-3xl font-bold text-amber-400 tracking-tight">{formatCurrency(financeStats?.pendingTotal ?? 0)}</p>
          <p className="text-xs text-steel/40 mt-auto">Kiállított, de még ki nem fizetett számlák</p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          ROW 3 — Költségek (full width, 2-column)
         ══════════════════════════════════════════════════════════ */}
      <div className="grid md:grid-cols-12 gap-4">

        {/* ── LEFT: Expense list ── */}
        <div className="md:col-span-7 bg-surface-800/50 rounded-xl border border-teal/10 p-5 flex flex-col min-h-[420px] md:h-[520px] md:max-h-[calc(100vh-260px)] overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-steel tracking-[0.15em] font-medium flex items-center gap-1.5">
              <CreditCard width={12} height={12} className="text-rose-400" /> KÖLTSÉGEK
              {visibleCostCount > 0 && <span className="text-steel/40 font-normal">({visibleCostCount})</span>}
            </p>
            <button
              onClick={() => { setEditingExpense(null); setShowExpenseModal(true); }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors duration-150 ease-out bg-steel/10 text-steel hover:bg-steel/20 hover:text-cream"
            >
              <Plus width={13} height={13} /> Hozzáadás
            </button>
          </div>
          {visibleCostCount > 0 && (
            <div className="flex-1 min-h-0 flex flex-col gap-3">
              {expenses.length > 0 && (
                <section className={`min-h-0 flex flex-col ${personnelCostCount > 0 ? 'basis-1/2' : 'flex-1'}`}>
                  <div className="flex items-center justify-between pb-2">
                    <p className="text-[10px] text-steel/55 tracking-[0.14em] uppercase font-medium">Eszközök és szolgáltatások</p>
                    <span className="text-[10px] text-steel/35">{expenses.length} tétel</span>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto pr-1 space-y-1.5">
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
                </section>
              )}

              {personnelCostCount > 0 && (
                <section className={`min-h-0 flex flex-col ${expenses.length > 0 ? 'basis-1/2 pt-3 border-t border-teal/8' : 'flex-1'}`}>
                  <div className="flex items-center justify-between pb-2">
                    <p className="text-[10px] text-steel/55 tracking-[0.14em] uppercase font-medium">Személyi jellegű költségek</p>
                    <span className="text-[10px] text-steel/35">{personnelCostCount} tétel</span>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto pr-1 space-y-1.5">
                    {salaryCostItems.map(employee => {
                      const salaryAmount = employee.salary_huf ?? employee.monthly_salary;
                      const salaryCurrency = employee.salary_huf ? 'HUF' : employee.salary_currency || 'HUF';
                      return (
                        <div key={employee.id} className="flex items-center gap-3 p-3 bg-surface-900/30 rounded-lg">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-violet-500/10">
                            <Users width={14} height={14} className="text-violet-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-cream truncate font-medium">{employee.name}</p>
                              <span className="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 text-violet-400 bg-violet-500/10">Bérköltség</span>
                            </div>
                            <p className="text-[10px] text-steel/50 mt-0.5">{employee.role || 'Alkalmazott'} • havi</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-sm font-bold text-cream block">{formatCurrency(salaryAmount, salaryCurrency)}</span>
                            <span className="text-[10px] text-steel/40">havi</span>
                          </div>
                        </div>
                      );
                    })}

                    {contractorCostItems.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-surface-900/30 rounded-lg">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-indigo-500/10">
                          <Users width={14} height={14} className="text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-cream truncate font-medium">{item.member_name}</p>
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 text-indigo-400 bg-indigo-500/10">
                              {item.employment_type === 'contractor' ? 'Alvállalkozó' : 'Megbízott'}
                            </span>
                          </div>
                          <p className="text-[10px] text-steel/50 mt-0.5">{item.project_name}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-bold text-cream block">{formatCurrency(item.fee_huf ?? item.fee, item.fee_huf ? 'HUF' : item.fee_currency)}</span>
                          <span className="text-[10px] text-steel/40">egyszeri</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Empty state */}
          {visibleCostCount === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center py-8">
              <CreditCard width={28} height={28} className="text-steel/20 mb-2" />
              <p className="text-xs text-steel/40 italic">Még nincsenek költségek rögzítve.</p>
              <p className="text-[10px] text-steel/25 mt-1">Kattints a &quot;Hozzáadás&quot; gombra az első költség rögzítéséhez.</p>
            </div>
          )}

          {/* Summary footer */}
          {enhanced && enhanced.yearlyExpenses > 0 && (
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-teal/8">
              <span className="text-[10px] text-steel/40">Összesítés</span>
              <div className="flex items-center gap-4">
                <span className="text-[11px] text-steel/60">Havi: <span className="font-bold text-cream">{formatCurrency(enhanced.monthlyExpenses)}</span></span>
                <span className="text-[11px] text-steel/60">Éves: <span className="font-bold text-cream">{formatCurrency(enhanced.yearlyExpenses)}</span></span>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Donut chart + combined trend ── */}
        <div className="md:col-span-5 flex flex-col gap-4">

          {/* Donut chart — category breakdown */}
          <div className="bg-surface-800/50 rounded-xl border border-teal/10 p-5">
            <p className="text-xs text-steel tracking-[0.15em] font-medium mb-4">KÖLTSÉGMEGOSZLÁS</p>
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

          {/* Revenue + expense trend */}
          <div className="bg-surface-800/50 rounded-xl border border-teal/10 p-5 flex-1 min-h-0 flex flex-col">
            <p className="text-xs text-steel tracking-[0.15em] font-medium mb-3 flex items-center gap-1.5">
              <TrendingUp width={12} height={12} className="text-emerald-400" /> BEVÉTEL ÉS KÖLTSÉG
            </p>
            {(() => {
              const expenseTrend = enhanced?.monthlyExpensesTrend ?? [];
              const revenueBars = chartData?.bars ?? [];
              const expensesByMonth = new Map(expenseTrend.map(item => [item.month, item.total]));
              const revenueByMonth = new Map(revenueBars.map(item => [item.month, item]));
              const months = [...new Set([...revenueBars.map(item => item.month), ...expenseTrend.map(item => item.month)])].sort();
              if (months.length < 2) {
                return (
                  <div className="flex-1 flex flex-col items-center justify-center py-8">
                    <BarChart3 width={28} height={28} className="text-steel/25 mb-2" />
                    <p className="text-[11px] text-steel/35 italic text-center">
                      {hasInvoicing
                        ? 'Az első lezárt számlád után a grafikon automatikusan elindul.'
                        : 'Az első bevétel rögzítése után a grafikon automatikusan elindul.'}
                    </p>
                  </div>
                );
              }

              const maxVal = Math.max(
                ...months.map(month => Math.max(revenueByMonth.get(month)?.total ?? 0, expensesByMonth.get(month) ?? 0)),
                1
              );
              const w = 100;
              const h = 100;
              const padX = 3;
              const padY = 8;
              const points = months.map((month, i) => {
                const expense = expensesByMonth.get(month) ?? 0;
                return {
                  x: months.length === 1 ? 50 : padX + ((w - padX * 2) * i) / (months.length - 1),
                  y: padY + (h - padY * 2) * (1 - expense / maxVal),
                  expense,
                  month,
                };
              });
              const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
              const areaPath = `${linePath} L${points[points.length - 1].x},${h - padY} L${points[0].x},${h - padY} Z`;
              const totals = revenueBars.map(bar => bar.total);
              const recent = totals.slice(-3).reduce((s, v) => s + v, 0) / Math.min(totals.length, 3);
              const older = totals.slice(0, -3).reduce((s, v) => s + v, 0) / Math.max(totals.length - 3, 1);
              const pct = older > 0 ? ((recent - older) / older * 100).toFixed(0) : null;
              return (
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="relative flex-1 min-h-44 mb-2">
                    <div className="absolute inset-0 flex items-end gap-2 pr-1">
                      {months.map(month => {
                        const bar = revenueByMonth.get(month);
                        const revenue = bar?.total ?? 0;
                        const expense = expensesByMonth.get(month) ?? 0;
                        return (
                          <div key={month} className="flex-1 h-full flex flex-col justify-end relative group">
                            <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-surface-900 border border-teal/15 rounded px-2 py-1 text-[10px] text-cream whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-out z-10 pointer-events-none">
                              Bevétel: {formatCurrency(revenue)} · Költség: {formatCurrency(expense)}
                            </div>
                            {bar && revenue > 0 && (
                              <div className="flex flex-col justify-end w-full rounded-t-sm overflow-hidden opacity-90" style={{ height: `${Math.max((revenue / maxVal) * 100, 2)}%` }}>
                                {bar.segments.filter(segment => segment.amount > 0).map(segment => {
                                  const info = chartData?.clientMap.get(segment.clientId);
                                  return (
                                    <div
                                      key={segment.clientId}
                                      className="w-full"
                                      style={{
                                        height: `${(segment.amount / revenue) * 100}%`,
                                        backgroundColor: tc(info?.color),
                                        minHeight: '2px',
                                      }}
                                    />
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                    <defs>
                      <linearGradient id="combinedExpTrendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb7185" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={areaPath} fill="url(#combinedExpTrendGrad)" />
                    <path d={linePath} fill="none" stroke="#fb7185" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  </svg>
                  {points.map((p, i) => (
                    <span
                      key={i}
                      className="absolute w-3 h-3 rounded-full bg-rose-400 pointer-events-none"
                      style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)' }}
                    />
                  ))}
                  </div>
                  <div className="flex gap-2 mb-3">
                    {months.map((month, i) => (
                      <span key={month} className="flex-1 text-[9px] text-steel/35 text-center truncate">
                        {i === 0 || i === months.length - 1 || months.length <= 6 ? format(parseISO(month + '-01'), 'MMM', { locale: hu }) : ''}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[10px] text-steel/60">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-teal" />Bevétel</span>
                      <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0.5 rounded-full bg-rose-400" />Költség</span>
                    </div>
                    {pct ? <span>{Number(pct) >= 0 ? '+' : ''}{pct}% / 3 hó</span> : <span>Kezd épülni a trend</span>}
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
                    <span className="text-sm text-steel/60">Költség</span>
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
              onChange={e => { setStatusFilter(e.target.value as typeof statusFilter); setInvoicePage(1); }}
              className="text-xs px-2 py-1 bg-surface-900 border border-teal/10 rounded-md text-steel focus:outline-none focus:ring-1 focus:ring-teal/30"
            >
              <option value="all">Mind</option>
              <option value="paid">Fizetve</option>
              <option value="pending">Függő</option>
              <option value="overdue">Lejárt</option>
            </select>
            <select
              value={clientFilter}
              onChange={e => { setClientFilter(e.target.value); setInvoicePage(1); }}
              className="text-xs px-2 py-1 bg-surface-900 border border-teal/10 rounded-md text-steel focus:outline-none focus:ring-1 focus:ring-teal/30"
            >
              <option value="">Minden ügyfél</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              value={dateRange}
              onChange={e => { setDateRange(e.target.value as typeof dateRange); setInvoicePage(1); }}
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
              ? (hasInvoicing ? 'Még nincsenek számlák. Használd a "Számla beolvasása" gombot!' : 'Még nincsenek bevételek. Rögzíts egyet az "Egyéb bevétel" gombbal!')
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
                {filteredInvoices.slice((invoicePage - 1) * INVOICES_PER_PAGE, invoicePage * INVOICES_PER_PAGE).map(invoice => (
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
                        {(invoice.file_path || (invoice.provider === 'billingo' && invoice.provider_invoice_id)) && (
                          <button
                            onClick={() => handleOpenInvoicePdf(invoice)}
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

        {/* Pagination */}
        {filteredInvoices.length > INVOICES_PER_PAGE && (() => {
          const totalPages = Math.ceil(filteredInvoices.length / INVOICES_PER_PAGE);
          return (
            <div className="flex items-center justify-between pt-4 mt-2 border-t border-teal/5">
              <span className="text-xs text-steel/60">
                {(invoicePage - 1) * INVOICES_PER_PAGE + 1}–{Math.min(invoicePage * INVOICES_PER_PAGE, filteredInvoices.length)} / {filteredInvoices.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setInvoicePage(1)}
                  disabled={invoicePage === 1}
                  className="px-2 py-1 text-xs text-steel/60 hover:text-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  «
                </button>
                <button
                  onClick={() => setInvoicePage(p => p - 1)}
                  disabled={invoicePage === 1}
                  className="px-2.5 py-1 text-xs text-steel/60 hover:text-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - invoicePage) <= 1)
                  .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '...' ? (
                      <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-steel/40">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setInvoicePage(p as number)}
                        className={`min-w-[28px] px-2 py-1 text-xs rounded transition-colors ${
                          invoicePage === p
                            ? 'bg-teal/20 text-cream font-medium'
                            : 'text-steel/60 hover:text-cream hover:bg-teal/10'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )
                }
                <button
                  onClick={() => setInvoicePage(p => p + 1)}
                  disabled={invoicePage === totalPages}
                  className="px-2.5 py-1 text-xs text-steel/60 hover:text-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ›
                </button>
                <button
                  onClick={() => setInvoicePage(totalPages)}
                  disabled={invoicePage === totalPages}
                  className="px-2 py-1 text-xs text-steel/60 hover:text-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  »
                </button>
              </div>
            </div>
          );
        })()}
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
