import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useCallback } from 'react';

interface Props {
  currentPage: number;
  totalItems: number;
  itemsPerPage?: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalItems, itemsPerPage = 25, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && currentPage > 1) {
      onPageChange(currentPage - 1);
    } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (totalItems <= itemsPerPage) return null;

  function getPageNumbers(): (number | '...')[] {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-teal/8">
      <span className="text-[11px] text-steel">
        Megjelenítve: {startItem}–{endItem} / {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="flex items-center gap-0.5 px-2 py-1 text-[11px] text-steel hover:text-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-3 h-3" /> Előző
        </button>
        {getPageNumbers().map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="px-1 text-[11px] text-steel/40">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-[28px] px-1.5 py-1 text-[11px] rounded transition-colors ${
                p === currentPage
                  ? 'bg-teal/15 text-cream font-medium'
                  : 'text-steel hover:text-cream hover:bg-surface-800'
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="flex items-center gap-0.5 px-2 py-1 text-[11px] text-steel hover:text-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Következő <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
