import { X, ScrollText } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function ContractPdfViewer({ contract, onClose }: {
  contract: Contract;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onDoubleClick={onClose}>
      <div className="bg-surface-800 rounded-xl border border-teal/15 shadow-2xl w-[85vw] h-[85vh] flex flex-col overflow-hidden" onDoubleClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-teal/10 shrink-0">
          <div className="flex items-center gap-2">
            <ScrollText width={14} height={14} className="text-teal" />
            <span className="text-sm text-cream font-medium">
              {contract.name}
            </span>
            <span className="text-xs text-steel/60">
              {format(parseISO(contract.created_at), 'yyyy. MM. dd.')}
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
          src={`file://${contract.file_path}`}
          partition="persist:shortcuts"
          className="flex-1"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}
