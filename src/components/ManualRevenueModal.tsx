import { useState } from 'react';
import { X, User, Briefcase, Coins, Calendar, CheckCircle2, FileText } from 'lucide-react';
import { fmtNum, parseNum } from '../utils/numberFormat';

interface ManualRevenueModalProps {
  clients: Client[];
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
  defaultClientId?: string;
  defaultProjectId?: string;
  defaultAmount?: string;
  defaultCurrency?: string;
}

export default function ManualRevenueModal({ clients, projects, onClose, onSaved, defaultClientId, defaultProjectId, defaultAmount, defaultCurrency }: ManualRevenueModalProps) {
  const [fields, setFields] = useState({
    client_id: defaultClientId || '',
    project_id: defaultProjectId || '',
    amount: defaultAmount || '',
    currency: defaultCurrency || 'HUF',
    issue_date: new Date().toISOString().slice(0, 10),
    notes: '',
    status: 'paid' as 'paid' | 'pending',
  });

  const filteredProjects = fields.client_id
    ? projects.filter(p => p.client_id === fields.client_id)
    : projects;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fields.amount || !fields.client_id) return;
    try {
      const nextNumber = await window.electronAPI.getNextInvoiceNumber();
      await window.electronAPI.createInvoice({
        project_id: fields.project_id || null,
        client_id: fields.client_id,
        file_path: null,
        invoice_number: nextNumber,
        amount: parseFloat(fields.amount),
        currency: fields.currency,
        issue_date: fields.issue_date,
        due_date: fields.issue_date,
        status: fields.status,
        notes: fields.notes || null,
        type: 'manual',
      });
      onSaved();
    } catch (err) {
      console.error('Failed to create manual revenue:', err);
    }
  }

  const labelClass = "text-[10px] text-steel tracking-wider uppercase mb-1 block";
  const underlineWrap = "flex items-center gap-2 border-b border-teal/8 py-1.5 focus-within:border-teal/25 transition-colors";
  const underlineInput = "flex-1 min-w-0 bg-transparent text-sm text-cream focus:outline-none placeholder:text-steel/40";
  const underlineSelect = "w-full px-0 py-1.5 bg-transparent border-b border-teal/8 text-sm text-cream focus:outline-none focus:border-teal/25 transition-colors cursor-pointer";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onDoubleClick={onClose}>
      <div
        className="bg-surface-800 rounded-2xl ring-1 ring-inset ring-teal/15 w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onDoubleClick={e => e.stopPropagation()}
      >
        {/* Accent strip */}
        <div className="h-1 bg-teal shrink-0" />

        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden min-h-0">

          {/* Static header */}
          <div className="px-5 pt-5 pb-4 shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="font-pixel text-[14px] text-cream">Egyéb bevétel rögzítése</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream cursor-pointer transition-colors duration-150 ease-out"
              >
                <X width={14} height={14} />
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="px-5 overflow-y-auto flex-1 min-h-0 space-y-4 pb-2">

            {/* Ügyfél */}
            <div>
              <span className={labelClass}>Ügyfél <span className="text-red-400">*</span></span>
              <div className={underlineWrap}>
                <User width={12} height={12} className="text-steel/60 shrink-0" />
                <select
                  value={fields.client_id}
                  onChange={e => {
                    const clientId = e.target.value;
                    const selected = clients.find(c => c.id === clientId);
                    setFields(f => ({
                      ...f,
                      client_id: clientId,
                      project_id: '',
                      currency: selected?.preferred_currency || f.currency,
                    }));
                  }}
                  className={`${underlineInput} cursor-pointer`}
                  required
                >
                  <option value="" className="bg-surface-800">Válassz ügyfelet…</option>
                  {clients.map(c => <option key={c.id} value={c.id} className="bg-surface-800">{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Projekt — csak ha van választható */}
            {filteredProjects.length > 0 && (
              <div>
                <span className={labelClass}>Projekt</span>
                <div className={underlineWrap}>
                  <Briefcase width={12} height={12} className="text-steel/60 shrink-0" />
                  <select
                    value={fields.project_id}
                    onChange={e => setFields(f => ({ ...f, project_id: e.target.value }))}
                    className={`${underlineInput} cursor-pointer`}
                  >
                    <option value="" className="bg-surface-800">Nincs projekthez csatolva</option>
                    {filteredProjects.map(p => (
                      <option key={p.id} value={p.id} className="bg-surface-800">{p.name}{p.client_name ? ` — ${p.client_name}` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Összeg + Pénznem */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <span className={labelClass}>Összeg <span className="text-red-400">*</span></span>
                <div className={underlineWrap}>
                  <Coins width={12} height={12} className="text-steel/60 shrink-0" />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={fmtNum(fields.amount)}
                    onChange={e => setFields(f => ({ ...f, amount: parseNum(e.target.value) }))}
                    className={underlineInput}
                    placeholder="0"
                    required
                  />
                </div>
              </div>
              <div>
                <span className={labelClass}>Pénznem</span>
                <select
                  value={fields.currency}
                  onChange={e => setFields(f => ({ ...f, currency: e.target.value }))}
                  className={underlineSelect}
                >
                  <option value="HUF" className="bg-surface-800">HUF</option>
                  <option value="EUR" className="bg-surface-800">EUR</option>
                  <option value="USD" className="bg-surface-800">USD</option>
                  <option value="GBP" className="bg-surface-800">GBP</option>
                  <option value="CHF" className="bg-surface-800">CHF</option>
                </select>
              </div>
            </div>

            {/* Dátum + Státusz */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className={labelClass}>Dátum</span>
                <div className={underlineWrap}>
                  <Calendar width={12} height={12} className="text-steel/60 shrink-0" />
                  <input
                    type="date"
                    value={fields.issue_date}
                    onChange={e => setFields(f => ({ ...f, issue_date: e.target.value }))}
                    className={underlineInput}
                  />
                </div>
              </div>
              <div>
                <span className={labelClass}>Státusz</span>
                <div className={underlineWrap}>
                  <CheckCircle2 width={12} height={12} className="text-steel/60 shrink-0" />
                  <select
                    value={fields.status}
                    onChange={e => setFields(f => ({ ...f, status: e.target.value as 'paid' | 'pending' }))}
                    className={`${underlineInput} cursor-pointer`}
                  >
                    <option value="paid" className="bg-surface-800">Fizetve</option>
                    <option value="pending" className="bg-surface-800">Függő</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Megjegyzés */}
            <div className="pb-1">
              <span className={labelClass}>Megjegyzés</span>
              <div className={underlineWrap}>
                <FileText width={12} height={12} className="text-steel/60 shrink-0" />
                <input
                  type="text"
                  value={fields.notes}
                  onChange={e => setFields(f => ({ ...f, notes: e.target.value }))}
                  className={underlineInput}
                  placeholder="Opcionális megjegyzés…"
                />
              </div>
            </div>
          </div>

          {/* Footer — fixed */}
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-teal/8 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-steel hover:text-cream transition-colors duration-150 ease-out cursor-pointer"
            >
              Mégse
            </button>
            <button
              type="submit"
              disabled={!fields.amount || !fields.client_id}
              className={`px-5 py-2 text-xs rounded-lg font-medium transition-colors duration-150 ease-out cursor-pointer ${
                fields.amount && fields.client_id
                  ? 'bg-teal text-cream hover:bg-teal/80'
                  : 'bg-teal/20 text-steel/40 cursor-not-allowed'
              }`}
            >
              Bevétel mentése
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
