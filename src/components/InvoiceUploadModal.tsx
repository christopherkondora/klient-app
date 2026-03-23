import { useState, useRef, useCallback } from 'react';
import { FileText, Upload, Loader2, X, Sparkles, ArrowLeft } from 'lucide-react';

interface InvoiceUploadModalProps {
  clients: Client[];
  projects?: Project[];
  onClose: () => void;
  onSaved: () => void;
  /** If provided, the invoice will be linked to this project */
  projectId?: string;
  /** If provided, pre-select this client */
  defaultClientId?: string;
}

export default function InvoiceUploadModal({ clients, projects, onClose, onSaved, projectId, defaultClientId }: InvoiceUploadModalProps) {
  const [step, setStep] = useState<'upload' | 'confirm'>('upload');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedInvoice | null>(null);
  const [confirmFields, setConfirmFields] = useState({
    invoice_number: '',
    client_id: defaultClientId || '',
    project_id: projectId || '',
    amount: '',
    currency: 'HUF',
    issue_date: '',
    due_date: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) return;
    setUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Array.from(new Uint8Array(arrayBuffer));
      const filePath = await window.electronAPI.saveFile({ buffer, fileName: file.name, type: file.type });
      setUploadedFilePath(filePath);

      const result = await window.electronAPI.extractInvoice(filePath);
      if (result.data) {
        setExtractedData(result.data);
        let matchedClientId = defaultClientId || '';
        if (!matchedClientId && result.data.client_name) {
          const lower = result.data.client_name.toLowerCase();
          const match = clients.find(c =>
            c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()) ||
            (c.company && (c.company.toLowerCase().includes(lower) || lower.includes(c.company.toLowerCase())))
          );
          if (match) matchedClientId = match.id;
        }
        // Auto-match project: find the best active project for the matched client
        let matchedProjectId = projectId || '';
        if (!matchedProjectId && matchedClientId && projects?.length) {
          const clientProjects = projects.filter(p => p.client_id === matchedClientId);
          const active = clientProjects.filter(p => p.status === 'active');
          if (active.length === 1) {
            matchedProjectId = active[0].id;
          } else if (active.length > 1) {
            // Prefer the project whose name best matches the invoice item/client_name
            const invoiceText = (result.data.client_name || '').toLowerCase();
            const scored = active.map(p => {
              const pName = p.name.toLowerCase();
              const pDesc = (p.description || '').toLowerCase();
              let score = 0;
              if (invoiceText && (pName.includes(invoiceText) || invoiceText.includes(pName))) score += 3;
              if (invoiceText && (pDesc.includes(invoiceText) || invoiceText.includes(pDesc))) score += 1;
              // Prefer urgent/high priority
              if (p.priority === 'urgent') score += 2;
              else if (p.priority === 'high') score += 1;
              return { project: p, score };
            });
            scored.sort((a, b) => b.score - a.score);
            matchedProjectId = scored[0].project.id;
          } else if (clientProjects.length > 0) {
            matchedProjectId = clientProjects[0].id;
          }
        }
        const nextNumber = await window.electronAPI.getNextInvoiceNumber();
        setConfirmFields({
          invoice_number: result.data.invoice_number || nextNumber,
          client_id: matchedClientId,
          project_id: matchedProjectId,
          amount: result.data.amount?.toString() || '',
          currency: result.data.currency || 'HUF',
          issue_date: result.data.issue_date || '',
          due_date: result.data.due_date || '',
        });
        setStep('confirm');
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  }, [clients, defaultClientId]);

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

  async function handleConfirm() {
    if (!confirmFields.amount || !confirmFields.client_id) return;
    try {
      await window.electronAPI.createInvoice({
        project_id: confirmFields.project_id || projectId || null,
        client_id: confirmFields.client_id,
        file_path: uploadedFilePath,
        invoice_number: confirmFields.invoice_number,
        amount: parseFloat(confirmFields.amount),
        currency: confirmFields.currency,
        issue_date: confirmFields.issue_date,
        due_date: confirmFields.due_date,
        status: 'pending',
      });
      onSaved();
    } catch (err) {
      console.error('Failed to create invoice:', err);
    }
  }

  const inputClass = "w-full px-3 py-2 bg-surface-900 border border-teal/10 rounded-lg text-sm text-cream focus:outline-none focus:ring-2 focus:ring-teal/30";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onDoubleClick={onClose}>
      <div className="bg-surface-800 rounded-xl border border-teal/15 p-6 w-full max-w-md shadow-2xl" onDoubleClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-pixel text-[14px] text-cream">
            {step === 'upload' ? 'Számla beolvasása' : 'Számla ellenőrzése'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-teal/10 text-steel hover:text-cream cursor-pointer">
            <X width={14} height={14} />
          </button>
        </div>

        {step === 'upload' && (
          <>
            <p className="text-xs text-steel/60 mb-4">
              Húzd ide a PDF számlát vagy válaszd ki a fájlkezelőből. Az AI automatikusan kinyeri az adatokat.
            </p>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                uploading
                  ? 'border-teal/30 bg-teal/5'
                  : dragOver
                    ? 'border-teal bg-teal/10 scale-[1.02]'
                    : 'border-teal/20 hover:border-teal/40 hover:bg-teal/5'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileInput}
                disabled={uploading}
                className="hidden"
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 width={28} height={28} className="text-teal animate-spin" />
                  <div className="text-center">
                    <p className="text-sm text-cream font-medium">AI feldolgozás...</p>
                    <p className="text-[10px] text-steel/60 mt-1">Az adatok kinyerése folyamatban</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-teal/10 flex items-center justify-center">
                    <Upload width={22} height={22} className="text-teal" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-cream font-medium">PDF számla feltöltése</p>
                    <p className="text-[10px] text-steel/60 mt-1">Húzd ide a fájlt vagy kattints a tallózáshoz</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-teal/5 rounded-lg border border-teal/10">
              <Sparkles width={14} height={14} className="text-teal shrink-0" />
              <p className="text-[11px] text-steel">Az AI kinyerte az adatokat. Ellenőrizd és mentsd.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-steel mb-1">
                  Számlaszám
                  {!extractedData?.invoice_number && <span className="ml-1 text-amber-400 text-[9px]">• manuális</span>}
                </label>
                <input type="text" value={confirmFields.invoice_number} onChange={e => setConfirmFields(f => ({ ...f, invoice_number: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-steel mb-1">
                  Ügyfél *
                  {extractedData?.client_name && !confirmFields.client_id && <span className="ml-1 text-amber-400 text-[9px]">• „{extractedData.client_name}" – nem azonosítva</span>}
                </label>
                <select value={confirmFields.client_id} onChange={e => setConfirmFields(f => ({ ...f, client_id: e.target.value, project_id: '' }))} className={inputClass} required>
                  <option value="">Válassz ügyfelet...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {!projectId && projects && projects.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-steel mb-1">
                    Projekt
                    {confirmFields.project_id && <span className="ml-1 text-teal text-[9px]">• AI javasolt</span>}
                  </label>
                  <select value={confirmFields.project_id} onChange={e => setConfirmFields(f => ({ ...f, project_id: e.target.value }))} className={inputClass}>
                    <option value="">Nincs projekthez csatolva</option>
                    {projects.filter(p => !confirmFields.client_id || p.client_id === confirmFields.client_id).map(p => (
                      <option key={p.id} value={p.id}>{p.name}{p.client_name ? ` — ${p.client_name}` : ''}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-steel mb-1">
                    Összeg *
                    {!extractedData?.amount && <span className="ml-1 text-amber-400 text-[9px]">• manuális</span>}
                  </label>
                  <input type="number" value={confirmFields.amount} onChange={e => setConfirmFields(f => ({ ...f, amount: e.target.value }))} className={inputClass} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-steel mb-1">Pénznem</label>
                  <select value={confirmFields.currency} onChange={e => setConfirmFields(f => ({ ...f, currency: e.target.value }))} className={inputClass}>
                    <option value="HUF">HUF</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-steel mb-1">
                    Kiállítás dátuma
                    {!extractedData?.issue_date && <span className="ml-1 text-amber-400 text-[9px]">• manuális</span>}
                  </label>
                  <input type="date" value={confirmFields.issue_date} onChange={e => setConfirmFields(f => ({ ...f, issue_date: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-steel mb-1">
                    Fizetési határidő
                    {!extractedData?.due_date && <span className="ml-1 text-amber-400 text-[9px]">• manuális</span>}
                  </label>
                  <input type="date" value={confirmFields.due_date} onChange={e => setConfirmFields(f => ({ ...f, due_date: e.target.value }))} className={inputClass} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => { setStep('upload'); setExtractedData(null); setUploadedFilePath(null); }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-steel hover:bg-teal/10 rounded-lg cursor-pointer"
              >
                <ArrowLeft width={14} height={14} /> Másik fájl
              </button>
              <div className="flex-1" />
              <button onClick={onClose} className="px-4 py-2 text-sm text-steel hover:bg-teal/10 rounded-lg cursor-pointer">Mégse</button>
              <button
                onClick={handleConfirm}
                disabled={!confirmFields.amount || !confirmFields.client_id}
                className={`px-4 py-2 text-sm rounded-lg font-medium cursor-pointer ${
                  confirmFields.amount && confirmFields.client_id
                    ? 'bg-teal text-cream hover:bg-teal/80'
                    : 'bg-teal/20 text-steel/40 cursor-not-allowed'
                }`}
              >
                Számla mentése
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
