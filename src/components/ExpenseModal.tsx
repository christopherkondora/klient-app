import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Receipt, Coins, RefreshCw, Loader2, Monitor, Megaphone, Building, Server, ShieldCheck, Truck, GraduationCap, Wrench, MoreHorizontal, Upload, Sparkles, FileText, AlertCircle, Plus, ChevronDown } from 'lucide-react';
import { fmtNum, parseNum } from '../utils/numberFormat';

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
  const [step, setStep] = useState<'choose' | 'form'>(expense ? 'form' : 'choose');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [aiPrefilled, setAiPrefilled] = useState(false);
  const [subscriptionHint, setSubscriptionHint] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [showExtra, setShowExtra] = useState(!!expense?.extra_amount);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    extra_amount: expense?.extra_amount ? String(expense.extra_amount) : '',
    extra_description: expense?.extra_description ?? '',
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

  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) return;
    setUploading(true);
    setExtractError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Array.from(new Uint8Array(arrayBuffer));
      const filePath = await window.electronAPI.saveFile({ buffer, fileName: file.name, type: file.type });

      const result = await window.electronAPI.extractExpense(filePath);
      if (result.error) {
        console.error('extractExpense error:', result.error);
        setExtractError('Az AI feldolgozás sikertelen. Töltsd ki manuálisan.');
        setStep('form');
        return;
      }
      if (result.data) {
        const d = result.data;
        setFields(f => ({
          ...f,
          name: d.name || f.name,
          amount: d.amount != null ? String(d.amount) : f.amount,
          currency: d.currency || f.currency,
          category: d.category || f.category,
          type: d.type || f.type,
          frequency: d.frequency || f.frequency,
          start_date: d.date || f.start_date,
          notes: d.vendor ? `${d.vendor}${d.notes ? ' — ' + d.notes : ''}` : d.notes || f.notes,
          extra_amount: d.extra_amount != null ? String(d.extra_amount) : f.extra_amount,
          extra_description: d.extra_description || f.extra_description,
        }));
        setAiPrefilled(true);
        if (d.extra_amount) setShowExtra(true);
        // Show subscription detection hint
        if (d.subscription_hint) {
          setSubscriptionHint(d.subscription_hint);
        }
      } else {
        setExtractError('Az AI nem tudta értelmezni a dokumentumot. Töltsd ki manuálisan.');
      }
      setStep('form');
    } catch (err) {
      console.error('AI expense extraction failed:', err);
      setExtractError('Hiba történt a feltöltés során.');
      setStep('form');
    } finally {
      setUploading(false);
    }
  }, []);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

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
        extra_amount: fields.extra_amount ? parseFloat(fields.extra_amount) : null,
        extra_description: fields.extra_description || null,
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
      <div className="bg-surface-800 rounded-2xl ring-1 ring-inset ring-teal/15 w-full max-w-sm shadow-2xl overflow-hidden" onDoubleClick={e => e.stopPropagation()}>

        {/* Header accent */}
        <div className="h-1 bg-teal" />

        <div className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-pixel text-[14px] text-cream">{expense ? 'Kiadás szerkesztése' : 'Új kiadás'}</h2>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream cursor-pointer transition-colors duration-150 ease-out">
              <X width={14} height={14} />
            </button>
          </div>

          {step === 'choose' ? (
            <div className="space-y-3">
              {/* AI upload zone */}
              <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileInput} />
              <button
                type="button"
                onClick={() => !uploading && fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                disabled={uploading}
                className={`w-full rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200 cursor-pointer ${
                  dragOver
                    ? 'border-teal bg-teal/10'
                    : 'border-teal/20 hover:border-teal/40 hover:bg-teal/5'
                } ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 width={24} height={24} className="text-teal animate-spin" />
                    <span className="text-xs text-steel">AI elemzés folyamatban...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles width={18} height={18} className="text-teal" />
                      <Upload width={18} height={18} className="text-steel/60" />
                    </div>
                    <span className="text-sm text-cream font-medium">Számla feltöltése (PDF)</span>
                    <span className="text-[11px] text-steel/50">Húzd ide a PDF számlát vagy kattints</span>
                  </div>
                )}
              </button>

              {/* Manual entry option */}
              <button
                type="button"
                onClick={() => setStep('form')}
                className="w-full py-2.5 rounded-lg text-xs text-steel hover:text-cream hover:bg-surface-900/50 transition-colors duration-150 cursor-pointer"
              >
                Manuális kitöltés →
              </button>
            </div>
          ) : (
          <form onSubmit={handleSubmit}>

          {/* Extract error banner */}
          {extractError && (
            <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertCircle width={12} height={12} className="text-amber-400 shrink-0" />
              <span className="text-[11px] text-amber-400">{extractError}</span>
            </div>
          )}

          {/* AI prefill banner */}
          {aiPrefilled && (
            <div className="flex flex-col gap-1.5 px-3 py-2 mb-4 rounded-lg bg-teal/10 border border-teal/20">
              <div className="flex items-center gap-2">
                <Sparkles width={12} height={12} className="text-teal shrink-0" />
                <span className="text-[11px] text-teal">AI által kitöltve — ellenőrizd az adatokat</span>
              </div>
              {subscriptionHint && (
                <div className="flex items-center gap-2 pl-5">
                  <Receipt width={10} height={10} className="text-rose-400 shrink-0" />
                  <span className="text-[11px] text-rose-400">{subscriptionHint}</span>
                </div>
              )}
            </div>
          )}

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
                  type="text"
                  inputMode="numeric"
                  value={fmtNum(fields.amount)}
                  onChange={e => setFields(f => ({ ...f, amount: parseNum(e.target.value) }))}
                  className="w-full px-0 py-1 bg-transparent border-none text-3xl font-bold text-cream focus:outline-none placeholder:text-steel/20"
                  placeholder="0"
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

          {/* Extra usage cost (subscription only) */}
          {fields.type === 'subscription' && (
            <div className="mt-3">
              {!showExtra ? (
                <button
                  type="button"
                  onClick={() => setShowExtra(true)}
                  className="flex items-center gap-1.5 text-[11px] text-steel/30 hover:text-steel/60 transition-colors duration-150 cursor-pointer group"
                >
                  <div className="w-full h-px bg-teal/8 group-hover:bg-teal/15 transition-colors flex-1" />
                  <Plus width={10} height={10} />
                  <span>Extra költség</span>
                  <div className="w-full h-px bg-teal/8 group-hover:bg-teal/15 transition-colors flex-1" />
                </button>
              ) : (
                <div className="overflow-hidden animate-in slide-in-from-top-1 duration-200">
                  <button
                    type="button"
                    onClick={() => { setShowExtra(false); setFields(f => ({ ...f, extra_amount: '', extra_description: '' })); }}
                    className="flex items-center gap-1.5 text-[11px] text-steel/40 hover:text-steel/60 transition-colors duration-150 cursor-pointer mb-2 w-full"
                  >
                    <div className="w-full h-px bg-teal/8 flex-1" />
                    <ChevronDown width={10} height={10} className="rotate-180" />
                    <span>Extra költség</span>
                    <div className="w-full h-px bg-teal/8 flex-1" />
                  </button>
                  <div className="bg-surface-900/30 rounded-lg p-3 space-y-2 border border-teal/8">
                    <p className="text-[10px] text-steel/40 leading-relaxed">Előfizetésen felüli használat alapú költség (pl. API usage, extra tokenek, túlhasználat).</p>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={fmtNum(fields.extra_amount)}
                          onChange={e => setFields(f => ({ ...f, extra_amount: parseNum(e.target.value) }))}
                          className="w-full px-0 py-1 bg-transparent border-b border-teal/15 text-sm font-medium text-cream focus:outline-none focus:border-teal/30 placeholder:text-steel/20"
                          placeholder="0"
                        />
                      </div>
                      <span className="text-xs text-steel/30 pb-1">{selectedCurrency.symbol}</span>
                    </div>
                    <input
                      type="text"
                      value={fields.extra_description}
                      onChange={e => setFields(f => ({ ...f, extra_description: e.target.value }))}
                      className="w-full px-0 py-1 bg-transparent border-b border-teal/8 text-[11px] text-cream focus:outline-none focus:border-teal/20 placeholder:text-steel/20 transition-colors"
                      placeholder="Leírás (pl. Copilot Usage)"
                    />
                  </div>
                </div>
              )}
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
          )}
        </div>
      </div>
    </div>
  );
}
