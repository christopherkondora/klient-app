import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Target } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ProfitGoalModalProps {
  currentGoal: number;
  currentProfit: number;
  onClose: () => void;
  onSaved?: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(amount);
}

function fmtNum(s: string): string {
  const digits = s.replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function parseNum(s: string): string {
  return s.replace(/\D/g, '');
}

export default function ProfitGoalModal({ currentGoal, currentProfit, onClose, onSaved }: ProfitGoalModalProps) {
  const { user, updateUser } = useAuth();
  const [goalInput, setGoalInput] = useState(String(currentGoal || ''));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const parsedGoal = parseInt(goalInput, 10);
  const hasGoal = !isNaN(parsedGoal) && parsedGoal > 0;
  const monthly = hasGoal ? Math.round(parsedGoal / 12) : 0;
  const weekly = hasGoal ? Math.round(parsedGoal / 52) : 0;
  const daily = hasGoal ? Math.round(parsedGoal / 252) : 0;
  const progressPct = hasGoal && currentProfit > 0 ? Math.min(Math.round((currentProfit / parsedGoal) * 100), 100) : 0;

  const presets = [
    { label: '500 E', sub: 'Ft', value: 500000, tier: 'Kezdő' },
    { label: '1 M',   sub: 'Ft', value: 1000000, tier: 'Stabil' },
    { label: '2 M',   sub: 'Ft', value: 2000000, tier: 'Növekvő' },
    { label: '5 M',   sub: 'Ft', value: 5000000, tier: 'Erős' },
    { label: '10 M',  sub: 'Ft', value: 10000000, tier: 'Ambiciózus' },
    { label: '20 M',  sub: 'Ft', value: 20000000, tier: 'Merész' },
  ];

  const save = async () => {
    if (!hasGoal || !user || saving) return;
    setSaving(true);
    try {
      await updateUser({ profit_goal_yearly: parsedGoal });
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative w-full max-w-lg bg-surface-800 rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Decorative gradient header */}
        <div className="relative h-32 bg-gradient-to-br from-teal/40 via-teal/20 to-transparent overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-teal/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-8 w-40 h-40 bg-steel/15 rounded-full blur-3xl" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-surface-900/40 hover:bg-surface-900/70 text-cream/80 hover:text-cream backdrop-blur-sm transition-colors cursor-pointer"
          >
            <X width={16} height={16} />
          </button>
          <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Target width={14} height={14} className="text-teal" />
                <p className="text-[10px] text-cream/70 tracking-[0.18em] font-semibold uppercase">Éves nyereség cél • {new Date().getFullYear()}</p>
              </div>
              <p
                key={hasGoal ? parsedGoal : 'empty'}
                className="text-4xl font-extrabold text-cream tracking-tight tabular-nums goal-number-pop"
              >
                {hasGoal ? formatCurrency(parsedGoal) : <span className="text-cream/30">— Ft</span>}
              </p>
            </div>
          </div>
        </div>

        {hasGoal && (
          <div className="px-6 py-4 border-b border-steel/10 grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-[10px] text-steel tracking-[0.12em] font-medium mb-1">HAVI</p>
              <p className="text-sm font-semibold text-cream tabular-nums">{formatCurrency(monthly)}</p>
            </div>
            <div className="text-center border-x border-steel/10">
              <p className="text-[10px] text-steel tracking-[0.12em] font-medium mb-1">HETI</p>
              <p className="text-sm font-semibold text-cream tabular-nums">{formatCurrency(weekly)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-steel tracking-[0.12em] font-medium mb-1">NAPI</p>
              <p className="text-sm font-semibold text-cream tabular-nums">{formatCurrency(daily)}</p>
            </div>
          </div>
        )}

        {hasGoal && currentProfit > 0 && (
          <div className="px-6 pt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-steel tracking-[0.12em] font-medium">JELENLEGI HALADÁS</span>
              <span className="text-xs font-semibold text-cream tabular-nums">{progressPct}%</span>
            </div>
            <div className="h-1.5 bg-surface-900/60 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal to-steel transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        <div className="px-6 pt-5 pb-2">
          <p className="text-[10px] text-steel tracking-[0.12em] font-medium mb-3">GYAKORI CÉLOK</p>
          <div className="grid grid-cols-3 gap-2.5">
            {presets.map((p, i) => {
              const isSelected = goalInput === String(p.value);
              return (
                <button
                  key={p.value}
                  onClick={() => setGoalInput(String(p.value))}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className={`goal-preset group relative overflow-hidden rounded-xl py-3 px-2 cursor-pointer transition-all duration-200 border ${
                    isSelected
                      ? 'bg-gradient-to-br from-teal/30 to-teal/10 border-teal text-cream goal-preset-selected'
                      : 'bg-surface-900/60 border-steel/15 text-steel hover:border-teal/40 hover:text-cream hover:bg-surface-900/90 hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-lg font-bold tracking-tight">{p.label}</span>
                      <span className="text-[10px] font-medium opacity-60">{p.sub}</span>
                    </div>
                    <span className={`text-[9px] tracking-[0.1em] uppercase font-medium ${isSelected ? 'text-cream/70' : 'text-steel/60 group-hover:text-steel'}`}>
                      {p.tier}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-6 pt-4 pb-2">
          <label className="block text-[10px] text-steel tracking-[0.12em] font-medium mb-2">VAGY EGYEDI ÖSSZEG</label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={fmtNum(goalInput)}
              onChange={e => setGoalInput(parseNum(e.target.value))}
              placeholder="pl. 3 500 000"
              className="w-full pl-4 pr-12 py-3 text-base font-medium bg-surface-900 border border-steel/15 rounded-xl text-cream focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal/40 placeholder:text-steel/40 tabular-nums transition-all"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') save(); }}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-steel font-medium pointer-events-none">Ft</span>
          </div>
        </div>

        <div className="px-6 py-5 mt-2 flex items-center justify-between bg-surface-900/30 border-t border-steel/10">
          <p className="text-[11px] text-steel/70">
            {hasGoal
              ? (<>A cél <span className="text-cream/80 font-medium">{formatCurrency(monthly)}</span> havi átlagos nyereséget igényel.</>)
              : 'Válassz egy mérföldkövet vagy adj meg egyedi összeget.'}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-steel hover:text-cream cursor-pointer transition-colors">Mégsem</button>
            <button
              onClick={save}
              disabled={!hasGoal || saving}
              className="px-5 py-2 text-sm bg-teal text-cream rounded-xl hover:bg-teal/85 cursor-pointer font-semibold transition-all shadow-lg shadow-teal/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              Cél mentése
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
