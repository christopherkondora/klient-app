import { useState, useRef, useEffect } from 'react';

const PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#78716c',
  '#01161E', '#124559', '#598392', '#AEC3B0', '#EFF6E0', '#334155',
];

export default function HexColorPicker({ value, onChange, presetColors }: {
  value: string;
  onChange: (hex: string) => void;
  presetColors?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  const isCustom = value && !(presetColors || []).some(c => c.toLowerCase() === value.toLowerCase());

  useEffect(() => { setHexInput(value); }, [value]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function commitHex(raw: string) {
    const cleaned = raw.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
    if (cleaned.length === 6) {
      const hex = `#${cleaned}`;
      onChange(hex);
      setHexInput(hex);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-7 h-7 rounded-full cursor-pointer transition-all flex items-center justify-center ${
          isCustom
            ? 'ring-2 ring-offset-2 ring-offset-surface-800 ring-teal scale-110'
            : 'border-2 border-dashed border-teal/30 hover:border-teal/60 hover:scale-105'
        }`}
        style={isCustom ? { backgroundColor: value } : {}}
        title="Egyéni szín"
      >
        {!isCustom && <span className="text-steel/50 text-xs font-bold">+</span>}
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-2 z-[100] bg-surface-800 border border-teal/15 rounded-xl shadow-2xl p-3 w-56">
          <div className="grid grid-cols-6 gap-1.5 mb-3">
            {PALETTE.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => { onChange(c); setHexInput(c); setOpen(false); }}
                className={`w-7 h-7 rounded-md transition-all ${
                  value.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-offset-1 ring-offset-surface-800 ring-cream scale-110' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="h-px bg-teal/10 mb-3" />

          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg border border-teal/15 shrink-0"
              style={{ backgroundColor: hexInput.length === 7 ? hexInput : value }}
            />
            <div className="flex-1 relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steel/40 text-xs font-mono">#</span>
              <input
                type="text"
                value={hexInput.replace('#', '')}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                  setHexInput(`#${raw}`);
                  if (raw.length === 6) onChange(`#${raw}`);
                }}
                onBlur={() => commitHex(hexInput)}
                onKeyDown={e => { if (e.key === 'Enter') { commitHex(hexInput); setOpen(false); } }}
                maxLength={6}
                className="w-full pl-6 pr-2 py-1.5 bg-surface-900 border border-teal/10 rounded-lg text-xs text-cream font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-teal/30 uppercase"
                placeholder="598392"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
