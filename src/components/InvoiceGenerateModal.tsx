import { useState, useMemo, useEffect } from 'react';
import { X, Loader2, Receipt } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';

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

/** Alanyi adómentes záradék — Áfa tv. XIII. fejezet (187-188. §) */
const AAM_ZARADEK = 'A számla adómentes értékesítést tartalmaz. Alanyi adómentesség — Áfa tv. XIII. fejezet (187-188. §).';

export default function InvoiceGenerateModal({ project, client, onClose, onSuccess, onSwitchToUpload }: InvoiceGenerateModalProps) {
  const { user } = useAuth();
  const isAam = user?.vat_status === 'exempt';
  const userDefaultRate = (user?.vat_rate_default as 27 | 18 | 5 | 0) ?? 27;

  const today = format(new Date(), 'yyyy-MM-dd');
  const defaultDue = format(addDays(new Date(), 8), 'yyyy-MM-dd');

  const [fulfillmentDate, setFulfillmentDate] = useState(today);
  const [dueDate, setDueDate] = useState(defaultDue);
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cash' | 'bankcard'>('bank_transfer');
  const [itemName, setItemName] = useState(project.name);
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('db');
  const [netUnitPrice, setNetUnitPrice] = useState<number | ''>('');
  const [vatRate, setVatRate] = useState<27 | 18 | 5 | 0>(isAam ? 0 : userDefaultRate);
  const [comment, setComment] = useState<string>(isAam ? AAM_ZARADEK : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // AAM váltás követése (ritka, de ha a user közben beállítja)
  useEffect(() => {
    if (isAam) {
      setVatRate(0);
      setComment(prev => (prev && prev !== AAM_ZARADEK ? prev : AAM_ZARADEK));
    }
  }, [isAam]);

  const totals = useMemo(() => {
    const price = typeof netUnitPrice === 'number' ? netUnitPrice : 0;
    const netTotal = price * quantity;
    const vatAmount = Math.round(netTotal * (vatRate / 100));
    const grossTotal = netTotal + vatAmount;
    return { netTotal, vatAmount, grossTotal };
  }, [netUnitPrice, quantity, vatRate]);

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-surface-800 border border-teal/10 text-sm text-cream focus:outline-none focus:border-teal/40';
  const labelClass = 'block text-xs font-medium text-steel mb-1.5';

  async function handleSubmit() {
    if (!netUnitPrice || netUnitPrice <= 0) {
      setError('Add meg a nettó egységárat');
      return;
    }
    if (!client) {
      setError('Nincs ügyfél hozzárendelve a projekthez');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await window.electronAPI.billingCreateInvoice({
        externalId: project.id,
        clientName: client.name,
        clientAddress: {
          postCode: client.postal_code || '',
          city: client.city || '',
          address: client.street || client.address || '',
        },
        clientEmail: client.email || undefined,
        clientTaxNumber: client.tax_number || undefined,
        clientId: client.id,
        items: [{
          name: itemName,
          quantity,
          unit,
          netUnitPrice: netUnitPrice as number,
          vatRate,
          ...(isAam ? { vatCode: 'AAM' as const } : {}),
        }],
        fulfillmentDate,
        dueDate,
        paymentMethod,
        currency: 'HUF',
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });

      if (!res.success) {
        setError(res.error || 'Ismeretlen hiba');
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
          currency: 'HUF',
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
      <div className="bg-surface-800 rounded-xl border border-teal/15 p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-teal" />
            <h2 className="font-pixel text-[14px] text-cream">Számla generálása</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-teal/10 text-steel hover:text-cream transition-colors">
            <X width={14} height={14} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Client info (readonly) */}
          <div className="bg-teal/5 rounded-lg p-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-steel">Ügyfél</span>
                <p className="text-sm text-cream font-medium">{client?.name || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] text-steel">Email</span>
                <p className="text-sm text-cream">{client?.email || '—'}</p>
              </div>
            </div>
          </div>

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

          {/* Item section */}
          <div className="border border-teal/10 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-ash">Tétel</p>
            <div>
              <label className={labelClass}>Megnevezés</label>
              <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} className={inputClass} />
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className={labelClass}>Mennyiség</label>
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
                <input
                  type="number"
                  min={0}
                  value={netUnitPrice}
                  onChange={e => setNetUnitPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className={inputClass}
                  placeholder="0 Ft"
                />
              </div>
              <div>
                <label className={labelClass}>ÁFA kulcs</label>
                {isAam ? (
                  <div className={`${inputClass} flex items-center gap-2 bg-amber-500/10 border-amber-400/30`}>
                    <span className="text-[10px] font-semibold text-amber-300 px-1.5 py-0.5 rounded bg-amber-500/20">AAM</span>
                    <span className="text-xs text-cream">Alanyi adómentes (0%)</span>
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

          {/* Megjegyzés / záradék */}
          <div>
            <label className={labelClass}>
              Megjegyzés {isAam && <span className="text-amber-300">(AAM záradék kötelező)</span>}
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={isAam ? 2 : 1}
              placeholder={isAam ? AAM_ZARADEK : 'Opcionális megjegyzés a számlán'}
              className={`${inputClass} resize-none ${isAam ? 'border-amber-400/20' : ''}`}
            />
            {isAam && comment.trim() !== AAM_ZARADEK && (
              <button
                type="button"
                onClick={() => setComment(AAM_ZARADEK)}
                className="mt-1 text-[10px] text-amber-300 hover:text-amber-200 underline decoration-amber-400/40"
              >
                Alap AAM záradék visszaállítása
              </button>
            )}
          </div>

          {/* Totals */}
          <div className="bg-teal/5 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-4 text-xs text-steel">
                  <span>Nettó: {totals.netTotal.toLocaleString('hu-HU')} Ft</span>
                  <span>ÁFA ({vatRate}%): {totals.vatAmount.toLocaleString('hu-HU')} Ft</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-steel">Bruttó végösszeg</p>
                <p className="text-lg font-bold text-cream">{totals.grossTotal.toLocaleString('hu-HU')} Ft</p>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 px-1">{error}</p>
          )}

          {/* Upload link */}
          {onSwitchToUpload && (
            <button
              type="button"
              onClick={onSwitchToUpload}
              className="text-xs text-steel hover:text-cream underline underline-offset-2 decoration-steel/30 hover:decoration-cream/50 transition-colors cursor-pointer"
            >
              Már van számlád és feltöltenéd?
            </button>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-steel hover:bg-teal/10 rounded-lg transition-colors"
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
