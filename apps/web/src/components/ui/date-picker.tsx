'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n: number) => String(n).padStart(2, '0');
const toValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function parse(v: string): Date | null {
  if (!v) return null;
  const [y, m, d] = v.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Theme-consistent date picker. Value is a `yyyy-mm-dd` string (same as a native
 * date input) so form payloads are unchanged, but it always displays DD/MM/YYYY
 * and renders a portalled calendar that can't be clipped by ancestor overflow.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  min,
  disabled = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [view, setView] = useState(() => parse(value) ?? new Date());
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = parse(value);
  const minDate = min ? parse(min) : null;
  const today = new Date();

  const measure = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.max(r.width, 248);
    // Flip above the field when there isn't room below (e.g. near the bottom of the page).
    const ph = menuRef.current?.offsetHeight || 340;
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < ph + 8 && r.top > spaceBelow;
    setRect({
      top: openUp ? Math.max(8, r.top - ph - 4) : r.bottom + 4,
      left: Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - width - 8)),
      width,
    });
  };

  useEffect(() => {
    if (!open) return;
    setView(parse(value) ?? new Date());
    measure();
    // Re-measure once the calendar has painted so the flip uses its real height.
    const raf = requestAnimationFrame(measure);
    const reposition = () => measure();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const year = view.getFullYear();
  const month = view.getMonth();
  const startOffset = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const isDisabled = (d: Date) => !!minDate && d.getTime() < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()).getTime();

  const pick = (d: Date) => { if (isDisabled(d)) return; onChange(toValue(d)); setOpen(false); };

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/8 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        style={{ color: 'var(--text-base)' }}
      >
        <CalendarIcon className="w-4 h-4 shrink-0 text-slate-500" />
        <span className={cn('flex-1 text-left', !selected && 'text-slate-500')}>
          {selected ? formatDate(selected) : placeholder}
        </span>
        {selected && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="p-0.5 rounded text-slate-500 hover:text-red-400"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {open && rect && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[90] rounded-xl border border-white/10 shadow-xl p-3"
          style={{ top: rect.top, left: rect.left, width: 248, background: 'var(--card-bg)', backdropFilter: 'blur(8px)' }}
        >
          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setView(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg text-slate-500 hover:text-brand-teal hover:bg-brand-teal/10 transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold" style={{ color: 'var(--text-base)' }}>{MONTHS[month]} {year}</span>
            <button type="button" onClick={() => setView(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg text-slate-500 hover:text-brand-teal hover:bg-brand-teal/10 transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAYS.map((w) => (
              <span key={w} className="text-[0.65rem] font-semibold text-slate-500 text-center py-1">{w}</span>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (!d) return <span key={i} />;
              const isSel = selected && sameDay(d, selected);
              const isToday = sameDay(d, today);
              const dis = isDisabled(d);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={dis}
                  onClick={() => pick(d)}
                  className={cn(
                    'h-8 rounded-lg text-xs font-medium transition-all',
                    isSel ? 'bg-brand-teal text-white font-bold'
                      : dis ? 'text-slate-600 cursor-not-allowed'
                      : 'hover:bg-brand-teal/10 hover:text-brand-teal',
                    !isSel && isToday && 'ring-1 ring-brand-teal/40',
                  )}
                  style={!isSel && !dis ? { color: 'var(--text-base)' } : undefined}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/8">
            <button
              type="button"
              onClick={() => { if (!isDisabled(today)) pick(today); }}
              className="text-xs font-semibold text-brand-teal hover:underline"
            >
              Today
            </button>
            {selected && (
              <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="text-xs text-slate-500 hover:text-red-400">
                Clear
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
