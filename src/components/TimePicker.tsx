import { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface TimePickerProps {
  value: string; // HH:mm
  onChange: (value: string) => void;
  className?: string;
}

type PickerMode = 'hour' | 'minute';

export default function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PickerMode>('hour');
  const [tempHour, setTempHour] = useState(9);
  const [tempMinute, setTempMinute] = useState(0);
  const [textInput, setTextInput] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const clockRef = useRef<SVGSVGElement>(null);
  const isDragging = useRef(false);

  const [h, m] = value.split(':').map(Number);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    setTempHour(h);
    setTempMinute(m);
  }, [value]);

  function openPicker() {
    setTempHour(h);
    setTempMinute(m);
    setTextInput('');
    setMode('hour');
    setOpen(true);
  }

  function getDistanceFromCenter(e: React.MouseEvent | MouseEvent) {
    if (!clockRef.current) return 0;
    const rect = clockRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getAngleFromEvent(e: React.MouseEvent | MouseEvent) {
    if (!clockRef.current) return 0;
    const rect = clockRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    let angle = Math.atan2(dx, -dy) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    return angle;
  }

  function getHourFromEvent(e: React.MouseEvent | MouseEvent) {
    const angle = getAngleFromEvent(e);
    const dist = getDistanceFromCenter(e);
    const rect = clockRef.current!.getBoundingClientRect();
    const scaleFactor = rect.width / 200;
    const threshold = 62 * scaleFactor;
    const baseHour = Math.round(angle / 30) % 12;
    if (dist < threshold) {
      // Inner ring: 0, 13-23
      return baseHour === 0 ? 0 : baseHour + 12;
    } else {
      // Outer ring: 1-12
      return baseHour === 0 ? 12 : baseHour;
    }
  }

  function handleClockClick(e: React.MouseEvent) {
    if (mode === 'hour') {
      setTempHour(getHourFromEvent(e));
    } else {
      const angle = getAngleFromEvent(e);
      const minute = Math.round(angle / 6) % 60;
      setTempMinute(minute);
    }
  }

  function handleMouseDown(e: React.MouseEvent) {
    isDragging.current = true;
    handleClockClick(e);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging.current) return;
    if (mode === 'hour') {
      setTempHour(getHourFromEvent(e));
    } else {
      const angle = getAngleFromEvent(e);
      const minute = Math.round(angle / 6) % 60;
      setTempMinute(minute);
    }
  }

  function handleMouseUp() {
    isDragging.current = false;
  }

  function handleTextInputChange(val: string) {
    // Allow only digits and colon
    const cleaned = val.replace(/[^\d:]/g, '');
    setTextInput(cleaned);
    // Auto-parse HH:MM
    const match = cleaned.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const hr = Math.min(parseInt(match[1], 10), 23);
      const mn = Math.min(parseInt(match[2], 10), 59);
      setTempHour(hr);
      setTempMinute(mn);
    }
  }

  function handleTextInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirm();
    }
  }

  function confirm() {
    onChange(`${String(tempHour).padStart(2, '0')}:${String(tempMinute).padStart(2, '0')}`);
    setOpen(false);
  }

  // Clock face rendering
  const center = 100;
  const hourNumbers = Array.from({ length: 24 }, (_, i) => i);
  const minuteNumbers = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  function getPosition(value: number, total: number, r: number) {
    const angle = (value / total) * 360 - 90;
    const rad = (angle * Math.PI) / 180;
    return {
      x: center + r * Math.cos(rad),
      y: center + r * Math.sin(rad),
    };
  }

  // Hand angle - map to 12-hour position for display
  const displayHour = tempHour > 12 ? tempHour - 12 : (tempHour === 0 ? 12 : tempHour);
  const handAngle = mode === 'hour'
    ? (displayHour / 12) * 360 - 90
    : (tempMinute / 60) * 360 - 90;
  const handLength = mode === 'hour' && (tempHour > 12 || tempHour === 0) ? 55 : (mode === 'hour' ? 65 : 75);
  const handRad = (handAngle * Math.PI) / 180;
  const handX = center + handLength * Math.cos(handRad);
  const handY = center + handLength * Math.sin(handRad);

  return (
    <div ref={ref} className={`relative ${className || ''}`}>
      <button
        type="button"
        onClick={openPicker}
        className="w-full flex items-center justify-between px-2 py-1.5 bg-surface-800 border border-teal/10 rounded text-xs text-left focus:outline-none focus:ring-1 focus:ring-teal/30 transition-colors"
      >
        <span className={value ? 'text-cream' : 'text-steel/50'}>
          {value || '--:--'}
        </span>
        <Clock width={12} height={12} className="text-steel" />
      </button>

      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[220px] bg-surface-800 border border-teal/15 rounded-xl shadow-2xl z-50 p-3 animate-in">
          {/* Text input for typing time */}
          <div className="mb-2">
            <input
              type="text"
              value={textInput}
              onChange={e => handleTextInputChange(e.target.value)}
              onKeyDown={handleTextInputKeyDown}
              placeholder={`${String(tempHour).padStart(2, '0')}:${String(tempMinute).padStart(2, '0')}`}
              className="w-full px-2 py-1 bg-surface-900 border border-teal/10 rounded text-xs text-cream text-center placeholder:text-steel/40 focus:outline-none focus:ring-1 focus:ring-teal/30"
            />
          </div>

          {/* Time display - click to switch mode */}
          <div className="flex items-center justify-center gap-1 mb-3">
            <button
              type="button"
              onClick={() => setMode('hour')}
              className={`text-xl font-bold px-2 py-0.5 rounded transition-colors ${mode === 'hour' ? 'text-cream bg-teal/20' : 'text-steel hover:text-cream'}`}
            >
              {String(tempHour).padStart(2, '0')}
            </button>
            <span className="text-xl font-bold text-steel">:</span>
            <button
              type="button"
              onClick={() => setMode('minute')}
              className={`text-xl font-bold px-2 py-0.5 rounded transition-colors ${mode === 'minute' ? 'text-cream bg-teal/20' : 'text-steel hover:text-cream'}`}
            >
              {String(tempMinute).padStart(2, '0')}
            </button>
          </div>

          {/* Clock face */}
          <svg
            ref={clockRef}
            viewBox="0 0 200 200"
            className="w-full cursor-pointer select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Background */}
            <circle cx={center} cy={center} r={95} fill="var(--color-surface-900)" stroke="var(--color-teal)" strokeWidth="0.5" strokeOpacity="0.2" />

            {/* Hand */}
            <line
              x1={center} y1={center}
              x2={handX} y2={handY}
              stroke="var(--color-teal)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx={center} cy={center} r="3" fill="var(--color-teal)" />
            <circle cx={handX} cy={handY} r="4" fill="var(--color-teal)" />

            {/* Numbers */}
            {mode === 'hour' ? (
              <>
                {/* Outer ring: 1-12 */}
                {hourNumbers.filter(h => h >= 1 && h <= 12).map(h => {
                  const pos = getPosition(h, 12, 75);
                  return (
                    <text
                      key={h}
                      x={pos.x}
                      y={pos.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className={`text-[11px] font-medium pointer-events-none ${tempHour === h ? 'fill-cream' : 'fill-steel'}`}
                    >
                      {h}
                    </text>
                  );
                })}
                {/* Inner ring: 0, 13-23 */}
                {hourNumbers.filter(h => h === 0 || h >= 13).map(h => {
                  const pos = getPosition(h === 0 ? 12 : h - 12, 12, 50);
                  return (
                    <text
                      key={h}
                      x={pos.x}
                      y={pos.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className={`text-[9px] font-medium pointer-events-none ${tempHour === h ? 'fill-cream' : 'fill-steel/60'}`}
                    >
                      {String(h).padStart(2, '0')}
                    </text>
                  );
                })}
              </>
            ) : (
              minuteNumbers.map(m => {
                const pos = getPosition(m, 60, 80);
                return (
                  <text
                    key={m}
                    x={pos.x}
                    y={pos.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className={`text-[11px] font-medium pointer-events-none ${tempMinute === m ? 'fill-cream' : 'fill-steel'}`}
                  >
                    {String(m).padStart(2, '0')}
                  </text>
                );
              })
            )}
          </svg>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-2 py-1 text-[10px] text-steel hover:text-cream rounded hover:bg-teal/10"
            >
              Mégse
            </button>
            <button
              type="button"
              onClick={confirm}
              className="px-2 py-1 text-[10px] text-cream bg-teal/20 hover:bg-teal/30 rounded"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
