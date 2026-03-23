import { useState, useEffect } from 'react';
import { X, Receipt, Coins, RefreshCw, Loader2, Monitor, Megaphone, Building, Server, ShieldCheck, Truck, GraduationCap, Wrench, MoreHorizontal } from 'lucide-react';

interface ExpenseModalProps {
  expense: Expense | null;
  onClose: () => void;
  onSaved: () => void;
}

const CURRENCIES = [
  { code: 'HUF', symbol: 'Ft' },
  { code: 'EUR', symbol: '€' },
  { code: 'USD', symbol: '$' },
];

const CATEGORIES = [
  { value: 'software', label: 'Szoftver', icon: Monitor, color: 'text-blue-400 bg-blue-500/10' },
  { value: 'marketing', label: 'Marketing', icon: Megaphone, color: 'text-amber-400 bg-amber-500/10' },
  { value: 'office', label: 'Iroda', icon: Building, color: 'text-emerald-400 bg-emerald-500/10' },
  { value: 'hosting', label: 'Hosting', icon: Server, color: 'text-cyan-400 bg-cyan-500/10' },
  { value: 'insurance', label: 'Biztosítás', icon: ShieldCheck, color: 'text-teal-400 bg-teal-500/10' },
  { value: 'transport', label: 'Szállítás', icon: Truck, color: 'text-orange-400 bg-orange-500/10' },
  { value: 'education', label: 'Képzés', icon: GraduationCap, color: 'text-purple-400 bg-purple-500/10' },
  { value: 'equipment', label: 'Eszközök', icon: Wrench, color: 'text-rose-400 bg-rose-500/10' },
  { value: 'other', label: 'Egyéb', icon: MoreHorizontal, color: 'text-steel bg-steel/10' },
] as const;

const TYPES = [
  { value: 'subscription', label: 'Előfizetés', icon: Receipt, color: 'text-rose-400 bg-rose-500/10' },
  { value: 'investment', label: 'Beruházás', icon: Coins, color: 'text-violet-400 bg-violet-500/10' },
] as const;

const FREQUENCIES = [
  { value: 'monthly', label: 'Havi' },
  { value: 'yearly', label: 'Éves' },
  { value: 'one-time', label: 'Egyszeri' },
] as const;

export default function ExpenseModal({ expense, onClose, onSaved }: ExpenseModalProps) {
  const [fields, setFields] = useState({
    name: expense?.name ?? '',
    amount: expense?.amount ? String(expense.amount) : '',
    currency: expense?.currency ?? 'HUF',
    category: expense?.category ?? 'other',
    type: expense?.type ?? 'subscription' as 'subscription' | 'investment',
    frequency: expense?.frequency ?? 'monthly' as 'monthly' | 'yearly' | 'one-time',
    start_date: expense?.start_date ?? new Date().toISOString().slice(0, 10),
    end_date: expense?.end_date ?? '',
    notes: expense?.notes ?? '',
  });

  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);

  // Fetch exchange rate when currency changes to non-HUF
  useEffect(() => {
    if (fields.currency === 'HUF') {
      setExchangeRate(null);
      return;
    }
    let cancelled = false;
    setLoadingRate(true);
    window.electronAPI.getExchangeRate(fields.currency, 'HUF')
      .then(rate => { if (!cancelled) setExchangeRate(rate); })
      .catch(() => { if (!cancelled) setExchangeRate(null); })
      .finally(() => { if (!cancelled) setLoadingRate(false); });
    return () => { cancelled = true; };
  }, [fields.currency]);

  const hufAmount = fields.currency !== 'HUF' && exchangeRate && fields.amount
    ? Math.round(parseFloat(fields.amount) * exchangeRate)
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fields.name || !fields.amount) return;
    try {
      const data: Record<string, unknown> = {
        name: fields.name,
        amount: parseFloat(fields.amount),
        currency: fields.currency,
        amount_huf: fields.currency === 'HUF'
          ? parseFloat(fields.amount)
          : hufAmount ?? parseFloat(fields.amount),
        category: fields.category,
        type: fields.type,
        frequency: fields.frequency,
        start_date: fields.start_date,
        end_date: fields.end_date || null,
        notes: fields.notes || null,
      };
      if (expense) {
        await window.electronAPI.updateExpense(expense.id, data);
      } else {
        await window.electronAPI.createExpense(data);
      }
      onSaved();
    } catch (err) {
      console.error('Failed to save expense:', err);
    }
  }

  const selectedCurrency = CURRENCIES.find(c => c.code === fields.currency)!;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onDoubleClick={onClose}>
      <div className="bg-surface-800 rounded-2xl border border-teal/15 w-full max-w-sm shadow-2xl overflow-hidden" onDoubleClick={e => e.stopPropagation()}>

        {/* Header accent */}
        <div className="h-1 bg-gradient-to-r from-teal via-steel to-teal/30" />

        <form onSubmit={handleSubmit} className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-pixel text-[14px] text-cream">{expense ? 'Kiadás szerkesztése' : 'Új kiadás'}</h2>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream cursor-pointer transition-colors duration-150 ease-out">
              <X width={14} height={14} />
            </button>
          </div>

          {/* Name */}
          <input
            type="text"
            value={fields.name}
            onChange={e => setFields(f => ({ ...f, name: e.target.value }))}
            className="w-full px-0 py-2 bg-transparent border-b border-teal/15 text-cream text-lg font-medium focus:outline-none focus:border-teal/40 placeholder:text-steel/30 transition-colors"
            placeholder="Megnevezés..."
            required
            autoFocus
          />

          {/* Amount + Currency row */}
          <div className="mt-5 flex items-end gap-3">
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <input
                  type="number"
                  value={fields.amount}
                  onChange={e => setFields(f => ({ ...f, amount: e.target.value }))}
                  className="w-full px-0 py-1 bg-transparent border-none text-3xl font-bold text-cream focus:outline-none placeholder:text-steel/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                  min="0"
                  step="any"
                  required
                />
                <span className="text-lg text-steel/40 font-medium shrink-0">{selectedCurrency.symbol}</span>
              </div>
              <div className="h-px bg-teal/15 mt-1" />
            </div>
            {/* Currency pills */}
            <div className="flex gap-1 pb-1">
              {CURRENCIES.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setFields(f => ({ ...f, currency: c.code }))}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition-all duration-150 ease-out cursor-pointer ${
                    fields.currency === c.code
                      ? 'bg-teal/20 text-cream'
                      : 'text-steel/40 hover:text-steel hover:bg-surface-900/50'
                  }`}
                >
                  {c.code}
                </button>
              ))}
            </div>
          </div>

          {/* HUF conversion hint */}
          {fields.currency !== 'HUF' && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-steel/50">
              {loadingRate ? (
                <><Loader2 width={10} height={10} className="animate-spin" /> Árfolyam lekérése...</>
              ) : exchangeRate && fields.amount ? (
                <><RefreshCw width={9} height={9} /> ≈ {hufAmount?.toLocaleString('hu-HU')} Ft (1 {fields.currency} = {exchangeRate.toLocaleString('hu-HU')} Ft)</>
              ) : exchangeRate ? (
                <><RefreshCw width={9} height={9} /> 1 {fields.currency} = {exchangeRate.toLocaleString('hu-HU')} Ft</>
              ) : null}
            </div>
          )}

          {/* Type + Frequency chips */}
          <div className="mt-5 space-y-3">
            {/* Category selector */}
            <div>
              <span className="text-[10px] text-steel/40 tracking-wider uppercase mb-1.5 block">Kategória</span>
              <div className="flex flex-wrap gap-1">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setFields(f => ({ ...f, category: cat.value }))}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all duration-150 ease-out cursor-pointer ${
                        fields.category === cat.value
                          ? cat.color
                          : 'text-steel/40 hover:text-steel bg-surface-900/30 hover:bg-surface-900/60'
                      }`}
                    >
                      <Icon width={10} height={10} />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-steel/40 tracking-wider uppercase mb-1.5 block">Típus</span>
              <div className="flex gap-1.5">
                {TYPES.map(t => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setFields(f => ({ ...f, type: t.value }))}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ease-out cursor-pointer ${
                        fields.type === t.value
                          ? t.color
                          : 'text-steel/40 hover:text-steel bg-surface-900/30 hover:bg-surface-900/60'
                      }`}
                    >
                      <Icon width={11} height={11} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-steel/40 tracking-wider uppercase mb-1.5 block">Gyakoriság</span>
              <div className="flex gap-1">
                {FREQUENCIES.map(f => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFields(fi => ({ ...fi, frequency: f.value }))}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ease-out cursor-pointer ${
                      fields.frequency === f.value
                        ? 'bg-teal/15 text-cream'
                        : 'text-steel/40 hover:text-steel bg-surface-900/30 hover:bg-surface-900/60'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dates row */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-steel/40 tracking-wider uppercase mb-1 block">Kezdés</span>
              <input
                type="date"
                value={fields.start_date}
                onChange={e => setFields(f => ({ ...f, start_date: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-surface-900/40 border border-teal/8 rounded-lg text-xs text-cream focus:outline-none focus:border-teal/25 transition-colors"
              />
            </div>
            <div>
              <span className="text-[10px] text-steel/40 tracking-wider uppercase mb-1 block">Lejárat</span>
              <input
                type="date"
                value={fields.end_date}
                onChange={e => setFields(f => ({ ...f, end_date: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-surface-900/40 border border-teal/8 rounded-lg text-xs text-cream focus:outline-none focus:border-teal/25 transition-colors"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="mt-4">
            <input
              type="text"
              value={fields.notes}
              onChange={e => setFields(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-0 py-1.5 bg-transparent border-b border-teal/8 text-xs text-cream focus:outline-none focus:border-teal/25 placeholder:text-steel/25 transition-colors"
              placeholder="Megjegyzés (opcionális)"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-steel hover:text-cream transition-colors duration-150 ease-out cursor-pointer">
              Mégsem
            </button>
            <button type="submit" className="px-5 py-2 bg-teal text-cream rounded-lg text-xs font-medium hover:bg-teal/80 transition-colors duration-150 ease-out cursor-pointer">
              {expense ? 'Mentés' : 'Hozzáadás'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
