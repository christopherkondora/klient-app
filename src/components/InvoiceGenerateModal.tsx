import { useState, useMemo, useEffect, useRef } from 'react';
import { X, Loader2, Receipt, Info, Globe } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { currencySymbol, formatAmount } from '../utils/vat';
import {
  resolveInvoiceScenario,
  AAM_COMMENT,
  type DomesticVatRate,
  type InvoiceLanguage,
} from '../../shared/invoice-scenario';

interface InvoiceGenerateModalProps {
  project: Project;
  client: Client | null;
  onClose: () => void;
  onSuccess: (invoiceNumber: string) => void;
  onSwitchToUpload?: () => void;
}

const VAT_OPTIONS = [
  { value: 27, label: '27%' },
  { value: 18, label: '18%' },
  { value: 5, label: '5%' },
  { value: 0, label: '0% (Mentes)' },
];

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Átutalás' },
  { value: 'cash', label: 'Készpénz' },
  { value: 'bankcard', label: 'Bankkártya' },
];

export default function InvoiceGenerateModal({ project, client, onClose, onSuccess, onSwitchToUpload }: InvoiceGenerateModalProps) {
  const { user } = useAuth();
  const isAam = user?.vat_status === 'exempt';
  const userDefaultRate = (user?.vat_rate_default as DomesticVatRate) ?? 27;
  const [aamTooltipVisible, setAamTooltipVisible] = useState(false);
  const aamTooltipRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clientCountry = (client?.country_code || 'HU').toUpperCase();
  const invoiceLanguage: InvoiceLanguage =
    (client?.invoice_language as InvoiceLanguage) || (clientCountry === 'HU' ? 'hu' : 'en');

  const scenario = useMemo(() => resolveInvoiceScenario({
    buyerCountryCode: client?.country_code,
    buyerEuVatNumber: client?.eu_vat_number,
    sellerVatStatus: isAam ? 'exempt' : 'standard',
    defaultDomesticRate: userDefaultRate,
    invoiceLanguage,
  }), [client?.country_code, client?.eu_vat_number, isAam, userDefaultRate, invoiceLanguage]);

  const isHuDomestic = scenario.kind === 'hu-domestic-standard' || scenario.kind === 'hu-domestic-aam';
  const isForeignClient = !isHuDomestic;

  const today = format(new Date(), 'yyyy-MM-dd');
  const defaultDue = format(addDays(new Date(), 8), 'yyyy-MM-dd');

  const [fulfillmentDate, setFulfillmentDate] = useState(today);
  const [dueDate, setDueDate] = useState(defaultDue);
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cash' | 'bankcard'>('bank_transfer');
  const [billingName, setBillingName] = useState(client?.name || '');
  const [itemName, setItemName] = useState(project.name);
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('db');
  const [netUnitPrice, setNetUnitPrice] = useState<number | ''>('');
  const [vatRate, setVatRate] = useState<DomesticVatRate>(scenario.vatRate);
  const [currency, setCurrency] = useState<string>(client?.preferred_currency || 'HUF');
  const [comment, setComment] = useState<string>(scenario.comment);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Ha a szcenárió változik (pl. user közben AAM-ra vált, vagy más kliens jön),
  // igazítsuk a `vatRate`-et és üres megjegyzés esetén a záradékot is.
  useEffect(() => {
    setVatRate(scenario.vatRate);
    setComment(prev => (prev.trim() === '' || prev === AAM_COMMENT ? scenario.comment : prev));
  }, [scenario.kind, scenario.vatRate, scenario.comment]);

  useEffect(() => {
    setBillingName(client?.name || '');
  }, [client?.id, client?.name]);

  const totals = useMemo(() => {
    const price = typeof netUnitPrice === 'number' ? netUnitPrice : 0;
    const netTotal = price * quantity;
    const vatAmount = Math.round(netTotal * (vatRate / 100));
    const grossTotal = netTotal + vatAmount;
    return { netTotal, vatAmount, grossTotal };
  }, [netUnitPrice, quantity, vatRate]);

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-surface-800 border border-teal/10 text-sm text-cream focus:outline-none focus:border-teal/40';
  const labelClass = 'block text-xs font-medium text-steel mb-1.5';

  const sym = currencySymbol(currency);
  const formatCur = (n: number) => formatAmount(n, currency);

  async function handleSubmit() {
    if (!netUnitPrice || netUnitPrice <= 0) {
      setError('Add meg a nettó egységárat');
      return;
    }
    if (!client) {
      setError('Nincs ügyfél hozzárendelve a projekthez');
      return;
    }
    if (!billingName.trim()) {
      setError('Add meg a számlázási nevet');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const vatCode = scenario.vatCode;

      const res = await window.electronAPI.billingCreateInvoice({
        externalId: `${project.id}-${Date.now()}`,
        clientName: billingName.trim(),
        clientAddress: {
          postCode: client.postal_code || '',
          city: client.city || '',
          address: client.street || client.address || '',
        },
        clientEmail: client.email || undefined,
        clientTaxNumber: client.tax_number || undefined,
        clientCountryCode: clientCountry,
        clientEuVatNumber: client.eu_vat_number || undefined,
        language: invoiceLanguage,
        clientId: client.id,
        items: [{
          name: itemName,
          quantity,
          unit,
          netUnitPrice: netUnitPrice as number,
          vatRate,
          ...(vatCode ? { vatCode } : {}),
        }],
        fulfillmentDate,
        dueDate,
        paymentMethod,
        currency,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });

      if (!res.success) {
        const errMsg = typeof res.error === 'string' ? res.error : JSON.stringify(res.error);
        console.error('[InvoiceGenerate] Billing error:', res.error);
        setError(errMsg || 'Ismeretlen hiba');
        setLoading(false);
        return;
      }

      // Save PDF to client/Számlák folder if available
      let savedFilePath: string | undefined;
      if (res.data?.pdfBase64 && client.name) {
        try {
          const fileName = `${res.data.invoiceNumber.replace(/\//g, '-')}.pdf`;
          const result = await window.electronAPI.filesSaveToClientInvoices(client.name, fileName, res.data.pdfBase64);
          savedFilePath = result.absolutePath;
        } catch (err) {
          console.warn('Could not save PDF to client invoices folder:', err);
        }
      }

      // Create a local invoice record
      try {
        await window.electronAPI.createInvoice({
          project_id: project.id,
          client_id: client.id,
          invoice_number: res.data!.invoiceNumber,
          amount: res.data!.grossTotal,
          currency,
          issue_date: fulfillmentDate,
          due_date: dueDate,
          status: 'pending',
          type: 'invoice',
          provider: res.data!.provider,
          provider_invoice_id: res.data!.providerInvoiceId,
          provider_synced_at: new Date().toISOString(),
          file_path: savedFilePath || null,
        });
      } catch (err) {
        console.warn('Could not create local invoice record:', err);
      }

      onSuccess(res.data!.invoiceNumber);
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface-900 rounded-2xl border border-teal/15 shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-teal/10 bg-surface-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-teal/15 flex items-center justify-center">
              <Receipt className="w-3.5 h-3.5 text-teal" />
            </div>
            <h2 className="font-pixel text-[13px] text-cream">Számla generálása</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream transition-colors cursor-pointer">
            <X width={14} height={14} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[80vh]">
          {/* Client info */}
          <div className="flex items-center gap-4 bg-teal/5 border border-teal/10 rounded-xl px-4 py-3">
            <div className="flex-1 min-w-0">
              <label className="text-[10px] text-steel tracking-[0.1em] uppercase mb-1 block">Számlázási név</label>
              <input
                type="text"
                value={billingName}
                onChange={e => setBillingName(e.target.value)}
                className="w-full bg-transparent border-b border-teal/15 pb-1 text-sm text-cream font-semibold focus:outline-none focus:border-teal/40 placeholder:text-steel/40"
                placeholder="Cégnév / számlázási név"
              />
            </div>
            <div className="w-px h-8 bg-teal/10" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-steel tracking-[0.1em] uppercase mb-0.5">Email</p>
              <p className="text-sm text-cream truncate">{client?.email || '—'}</p>
            </div>
          </div>

          {/* International scenario banner */}
          {isForeignClient && (
            <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 border ${
              scenario.kind === 'eu-b2b' ? 'bg-emerald-500/5 border-emerald-500/20' :
              scenario.kind === 'eu-b2c' ? 'bg-amber-500/5 border-amber-500/20' :
              'bg-blue-500/5 border-blue-500/20'
            }`}>
              <Globe className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                scenario.kind === 'eu-b2b' ? 'text-emerald-300' :
                scenario.kind === 'eu-b2c' ? 'text-amber-300' :
                'text-blue-300'
              }`} />
              <div className="flex-1 text-[11px] leading-relaxed">
                <p className="text-cream font-semibold mb-0.5">
                  {scenario.kind === 'eu-b2b' && `EU B2B számla — ${clientCountry} · fordított adózás`}
                  {scenario.kind === 'eu-b2c' && `EU magánszemély — ${clientCountry} · HU ÁFA-val`}
                  {scenario.kind === 'third-country' && `Harmadik országbeli export — ${clientCountry} · ÁFA körön kívül`}
                </p>
                <p className="text-steel/80">
                  {scenario.kind === 'eu-b2b' && 'A számla 0% ÁFÁ-val készül, a vevő számolja el az ÁFÁ-t a saját országában (EU vatCode).'}
                  {scenario.kind === 'eu-b2c' && `EU magánszemély — nincs EU ÁFA szám, ezért a magyar ${scenario.vatRate}% ÁFA kulcs kerül a számlára (a teljesítés helye HU).`}
                  {scenario.kind === 'third-country' && 'EU-n kívüli vevő — EUK (EU-n kívül) kóddal, ÁFA-mentes export szolgáltatásként könyvelődik.'}
                </p>
              </div>
            </div>
          )}

          {/* Dates & payment */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Teljesítés dátuma</label>
              <input type="date" value={fulfillmentDate} onChange={e => setFulfillmentDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Fizetési határidő</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Fizetési mód</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)} className={inputClass}>
                {PAYMENT_METHODS.map(pm => (
                  <option key={pm.value} value={pm.value}>{pm.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Currency selector — only for foreign clients */}
          {isForeignClient && (
            <div>
              <label className={labelClass}>Deviza</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputClass}>
                {['HUF', 'EUR', 'USD', 'GBP', 'CHF'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {/* Item section */}
          <div className="border border-teal/10 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-teal/5 border-b border-teal/10">
              <p className="text-[10px] font-semibold text-steel tracking-[0.12em] uppercase">Tétel</p>
            </div>
            <div className="px-4 py-4 space-y-3">
              <div>
                <label className={labelClass}>Megnevezés</label>
                <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} className={inputClass} />
              </div>
              <div className="grid grid-cols-4 gap-2.5">
                <div>
                  <label className={labelClass}>Menny.</label>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Egység</label>
                  <input type="text" value={unit} onChange={e => setUnit(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Nettó egységár</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={netUnitPrice}
                      onChange={e => setNetUnitPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className={`${inputClass} pr-8`}
                      placeholder="0"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-steel/60 pointer-events-none">{sym}</span>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>ÁFA kulcs</label>
                  {isForeignClient && scenario.vatCode ? (
                    <div className={`${inputClass} flex items-center gap-2 cursor-default bg-teal/8 border-teal/25`}>
                      <span className="text-[10px] font-bold text-teal px-1.5 py-0.5 rounded bg-teal/20 leading-none shrink-0">{scenario.vatCode}</span>
                      <span className="text-xs text-steel/60">{scenario.vatRate}%</span>
                    </div>
                  ) : isAam ? (
                    <div
                      className="relative"
                      onMouseEnter={() => {
                        if (aamTooltipRef.current) clearTimeout(aamTooltipRef.current);
                        setAamTooltipVisible(true);
                      }}
                      onMouseLeave={() => {
                        aamTooltipRef.current = setTimeout(() => setAamTooltipVisible(false), 150);
                      }}
                    >
                      <div
                        className={`${inputClass} flex items-center gap-2 cursor-default bg-amber-500/8 border-amber-400/25`}
                      >
                        <span className="text-[10px] font-bold text-amber-300 px-1.5 py-0.5 rounded bg-amber-500/20 leading-none shrink-0">AAM</span>
                        <span className="text-xs text-steel/60">0%</span>
                      </div>
                      {aamTooltipVisible && (
                        <div className="absolute bottom-full right-0 mb-2 z-30 w-64 max-w-[calc(100vw_-_3rem)] bg-surface-800 border border-amber-400/20 rounded-xl shadow-xl p-3">
                          <div className="flex items-start gap-2">
                            <Info width={13} height={13} className="text-amber-300 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[11px] font-semibold text-amber-200 mb-1">Alanyi adómentesség</p>
                              <p className="text-[10px] text-steel/80 leading-relaxed">Az ÁFA törvény XIII. fejezete (187–188. §) alapján alanyi mentes státuszban vagy, ezért ÁFÁ-t nem számíthatsz fel.</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <select value={vatRate} onChange={e => setVatRate(parseInt(e.target.value) as any)} className={inputClass}>
                      {VAT_OPTIONS.map(v => (
                        <option key={v.value} value={v.value}>{v.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Megjegyzés */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`${labelClass} !mb-0`}>
                Megjegyzés
                {isAam && (
                  <span className="ml-2 text-[10px] text-amber-300/80 font-normal normal-case tracking-normal">
                    · AAM záradék (törvényileg kötelező)
                  </span>
                )}
              </label>
              {isAam && comment.trim() !== AAM_COMMENT && (
                <button
                  type="button"
                  onClick={() => setComment(AAM_COMMENT)}
                  className="text-[10px] text-amber-300 hover:text-amber-200 underline decoration-amber-400/40 cursor-pointer"
                >
                  Visszaállítás
                </button>
              )}
            </div>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={isAam ? 2 : 1}
              placeholder={isAam ? AAM_COMMENT : 'Opcionális megjegyzés…'}
              className={`${inputClass} resize-none text-xs leading-relaxed ${isAam ? 'border-amber-400/20' : ''}`}
            />
          </div>

          {/* Totals */}
          <div className="bg-surface-800/60 border border-teal/10 rounded-xl px-4 py-3.5 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-steel/70">
                <span>Nettó</span>
                <span className="text-cream font-medium">{formatCur(totals.netTotal)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-steel/70">
                <span>ÁFA ({vatRate}%)</span>
                <span className="text-cream font-medium">{formatCur(totals.vatAmount)}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-steel tracking-[0.1em] uppercase mb-0.5">Bruttó végösszeg</p>
              <p className="text-2xl font-bold text-cream">
                {currency === 'HUF'
                  ? <>{Math.round(totals.grossTotal).toLocaleString('hu-HU')} <span className="text-base font-normal text-steel">Ft</span></>
                  : <>{totals.grossTotal.toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-base font-normal text-steel">{sym}</span></>
                }
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-teal/10 bg-surface-800/30 flex items-center justify-between gap-3">
          <div>
            {onSwitchToUpload && (
              <button
                type="button"
                onClick={onSwitchToUpload}
                className="text-xs text-steel hover:text-cream underline underline-offset-2 decoration-steel/30 hover:decoration-cream/50 transition-colors cursor-pointer"
              >
                Már van számlád és feltöltenéd?
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-steel hover:bg-teal/10 rounded-lg transition-colors cursor-pointer"
            >
              Mégse
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !netUnitPrice || !client}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-teal text-ink rounded-lg hover:bg-teal/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Receipt className="w-3.5 h-3.5" />}
              {loading ? 'Generálás...' : 'Számla generálása'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
