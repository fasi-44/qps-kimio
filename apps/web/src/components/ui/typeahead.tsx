'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';

export interface TypeaheadOption {
  id: string;
  label: string;
  sublabel?: string;
}

export function Typeahead({
  options,
  value,
  onSelect,
  placeholder,
  className,
}: {
  options: TypeaheadOption[];
  value: string;
  onSelect: (id: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);

  const measure = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.bottom + 4, left: r.left, width: r.width });
  };

  // Position the portalled menu against the input, and close on outside click.
  // A portal is used so an ancestor `overflow-hidden` (e.g. a card) can't clip the list.
  useEffect(() => {
    if (!open) return;
    measure();
    const reposition = () => measure();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q))
    : options;

  return (
    <div ref={wrapRef} className={`relative ${className ?? ''}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <Input
          className="pl-9"
          value={open ? query : selected?.label ?? ''}
          placeholder={selected ? selected.label : placeholder}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setQuery(''); setOpen(true); }}
        />
      </div>

      {open && rect && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[70] max-h-56 overflow-auto rounded-xl border border-white/10 shadow-xl py-1"
          style={{ top: rect.top, left: rect.left, width: rect.width, background: 'rgba(15,23,42,0.98)' }}
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-slate-500">No matches found</p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => { onSelect(o.id); setOpen(false); setQuery(''); }}
                className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors"
              >
                <Check className={`w-3.5 h-3.5 shrink-0 ${o.id === value ? 'text-brand-teal' : 'text-transparent'}`} />
                <span className="min-w-0 truncate">
                  <span className="text-slate-200">{o.label}</span>
                  {o.sublabel && <span className="text-slate-500 text-xs ml-1.5">— {o.sublabel}</span>}
                </span>
              </button>
            ))
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
