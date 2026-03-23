import { X, FileText } from 'lucide-react';

export default function InvoicePdfViewer({ invoice, onClose }: {
  invoice: Invoice;
  onClose: () => void;
}) {
  if (!invoice.file_path) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onDoubleClick={onClose}>
      <div className="bg-surface-800 rounded-xl border border-teal/15 shadow-2xl w-[85vw] h-[85vh] flex flex-col overflow-hidden" onDoubleClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-teal/10 shrink-0">
          <div className="flex items-center gap-2">
            <FileText width={14} height={14} className="text-green-400" />
            <span className="text-sm text-cream font-medium">
              {invoice.invoice_number || 'Számla'} — {new Intl.NumberFormat('hu-HU', { style: 'currency', currency: invoice.currency || 'HUF', maximumFractionDigits: 0 }).format(invoice.amount)}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              invoice.status === 'paid' ? 'bg-emerald-500/15 text-emerald-400' :
              invoice.status === 'pending' ? 'bg-amber-500/15 text-amber-400' :
              'bg-red-500/15 text-red-400'
            }`}>
              {invoice.status === 'paid' ? 'Fizetve' : invoice.status === 'pending' ? 'Függő' : 'Lejárt'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream transition-colors"
          >
            <X width={16} height={16} />
          </button>
        </div>
        <webview
          src={`file://${invoice.file_path}`}
          partition="persist:shortcuts"
          className="flex-1"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}
