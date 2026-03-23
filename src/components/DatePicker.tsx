import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  parseISO,
} from 'date-fns';
import { hu } from 'date-fns/locale';

interface DatePickerProps {
  value: string; // yyyy-MM-dd
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export default function DatePicker({ value, onChange, placeholder = 'Válassz dátumot...', required, className }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => value ? parseISO(value) : new Date());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (value) setViewMonth(parseISO(value));
  }, [value]);

  const calendarDays = useMemo(() => {
    const ms = startOfMonth(viewMonth);
    const me = endOfMonth(ms);
    const sd = startOfWeek(ms, { weekStartsOn: 1 });
    const ed = endOfWeek(me, { weekStartsOn: 1 });
    const days: Date[] = [];
    let d = sd;
    while (d <= ed) { days.push(d); d = addDays(d, 1); }
    return days;
  }, [viewMonth]);

  const dayNames = ['Hé', 'Ke', 'Sze', 'Csü', 'Pé', 'Szo', 'Va'];
  const selectedDate = value ? parseISO(value) : null;

  return (
    <div ref={ref} className={`relative ${className || ''}`}>
      {/* Hidden native input for form validation */}
      {required && <input type="text" value={value} required tabIndex={-1} className="absolute opacity-0 w-0 h-0" onChange={() => {}} />}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-surface-900 border border-teal/10 rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-teal/30 transition-colors"
      >
        <span className={value ? 'text-cream' : 'text-steel/50'}>
          {value ? format(parseISO(value), 'yyyy. MM. dd.') : placeholder}
        </span>
        <Calendar width={14} height={14} className="text-steel" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-surface-800 border border-teal/15 rounded-lg shadow-xl z-50 p-3">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setViewMonth(subMonths(viewMonth, 1))} className="p-1 hover:bg-teal/10 rounded text-steel hover:text-cream">
              <ChevronLeft width={14} height={14} />
            </button>
            <span className="text-xs font-medium text-cream">
              {format(viewMonth, 'yyyy. MMMM', { locale: hu })}
            </span>
            <button type="button" onClick={() => setViewMonth(addMonths(viewMonth, 1))} className="p-1 hover:bg-teal/10 rounded text-steel hover:text-cream">
              <ChevronRight width={14} height={14} />
            </button>
          </div>

          {/* Day name headers */}
          <div className="grid grid-cols-7 mb-1">
            {dayNames.map(n => (
              <div key={n} className="text-center text-[9px] text-steel/60 py-1">{n}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-0.5">
            {calendarDays.map((day, idx) => {
              const isCurrentMonth = isSameMonth(day, viewMonth);
              const isToday = isSameDay(day, new Date());
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <button
                  type="button"
                  key={idx}
                  onClick={() => {
                    onChange(format(day, 'yyyy-MM-dd'));
                    setOpen(false);
                  }}
                  className={`w-full aspect-square flex items-center justify-center rounded text-[11px] font-medium transition-colors ${
                    isSelected ? 'bg-teal text-cream' :
                    isToday ? 'bg-teal/15 text-ash' :
                    isCurrentMonth ? 'text-steel hover:bg-teal/10 hover:text-cream' :
                    'text-steel/25'
                  }`}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-teal/10">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="text-[10px] text-steel hover:text-cream"
            >
              Törlés
            </button>
            <button
              type="button"
              onClick={() => { onChange(format(new Date(), 'yyyy-MM-dd')); setOpen(false); }}
              className="text-[10px] text-teal hover:text-cream"
            >
              Ma
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
