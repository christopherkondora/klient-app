import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmDialog({ title, message, confirmLabel, cancelLabel, variant, onConfirm, onCancel }: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const v = variant || 'default';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-surface-800 rounded-2xl ring-1 ring-inset ring-teal/15 w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header accent */}
        <div className={`h-1 ${v === 'danger' ? 'bg-red-500' : v === 'warning' ? 'bg-amber-500' : 'bg-teal'}`} />

        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              v === 'danger' ? 'bg-red-500/10' : v === 'warning' ? 'bg-amber-500/10' : 'bg-teal/10'
            }`}>
              <AlertTriangle width={18} height={18} className={
                v === 'danger' ? 'text-red-400' : v === 'warning' ? 'text-amber-400' : 'text-teal'
              } />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-pixel text-[14px] text-cream">{title}</h2>
              <p className="text-sm text-steel mt-1">{message}</p>
            </div>
            <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream cursor-pointer transition-colors duration-150 ease-out shrink-0">
              <X width={14} height={14} />
            </button>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-xs text-steel hover:text-cream transition-colors duration-150 ease-out cursor-pointer"
            >
              {cancelLabel || 'Mégse'}
            </button>
            <button
              onClick={onConfirm}
              className={`px-5 py-2 text-xs rounded-lg font-medium transition-colors duration-150 ease-out cursor-pointer ${
                v === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' :
                v === 'warning' ? 'bg-amber-600 text-white hover:bg-amber-700' :
                'bg-teal text-cream hover:bg-teal/80'
              }`}
            >
              {confirmLabel || 'Megerősítés'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
