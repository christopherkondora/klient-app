import { useState } from 'react';
import { X } from 'lucide-react';

interface ManualRevenueModalProps {
  clients: Client[];
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
}

export default function ManualRevenueModal({ clients, projects, onClose, onSaved }: ManualRevenueModalProps) {
  const [fields, setFields] = useState({
    client_id: '',
    project_id: '',
    amount: '',
    currency: 'HUF',
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

  const inputClass = "w-full px-3 py-2 bg-surface-900 border border-teal/10 rounded-lg text-sm text-cream focus:outline-none focus:ring-2 focus:ring-teal/30";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onDoubleClick={onClose}>
      <div className="bg-surface-800 rounded-xl border border-teal/15 p-6 w-full max-w-md shadow-2xl" onDoubleClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-pixel text-[14px] text-cream">Bevétel rögzítése</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-teal/10 text-steel hover:text-cream cursor-pointer">
            <X width={14} height={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-steel mb-1">Ügyfél *</label>
            <select
              value={fields.client_id}
              onChange={e => setFields(f => ({ ...f, client_id: e.target.value, project_id: '' }))}
              className={inputClass}
              required
            >
              <option value="">Válassz ügyfelet...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {filteredProjects.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-steel mb-1">Projekt</label>
              <select
                value={fields.project_id}
                onChange={e => setFields(f => ({ ...f, project_id: e.target.value }))}
                className={inputClass}
              >
                <option value="">Nincs projekthez csatolva</option>
                {filteredProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}{p.client_name ? ` — ${p.client_name}` : ''}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-steel mb-1">Összeg *</label>
              <input
                type="number"
                value={fields.amount}
                onChange={e => setFields(f => ({ ...f, amount: e.target.value }))}
                className={inputClass}
                placeholder="0"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-steel mb-1">Pénznem</label>
              <select value={fields.currency} onChange={e => setFields(f => ({ ...f, currency: e.target.value }))} className={inputClass}>
                <option value="HUF">HUF</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-steel mb-1">Dátum</label>
              <input
                type="date"
                value={fields.issue_date}
                onChange={e => setFields(f => ({ ...f, issue_date: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-steel mb-1">Státusz</label>
              <select value={fields.status} onChange={e => setFields(f => ({ ...f, status: e.target.value as 'paid' | 'pending' }))} className={inputClass}>
                <option value="paid">Fizetve</option>
                <option value="pending">Függő</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-steel mb-1">Megjegyzés</label>
            <input
              type="text"
              value={fields.notes}
              onChange={e => setFields(f => ({ ...f, notes: e.target.value }))}
              className={inputClass}
              placeholder="Opcionális megjegyzés..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-steel hover:bg-teal/10 rounded-lg cursor-pointer">
              Mégse
            </button>
            <button
              type="submit"
              disabled={!fields.amount || !fields.client_id}
              className={`px-4 py-2 text-sm rounded-lg font-medium cursor-pointer ${
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
