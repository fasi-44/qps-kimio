'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Check, ChevronDown, X } from 'lucide-react';

export interface MultiSelectOption {
  id: string;
  label: string;
  sublabel?: string;
}

export function MultiSelect({
  options,
  values,
  onChange,
  placeholder,
  className,
}: {
  options: MultiSelectOption[];
  values: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.filter((o) => values.includes(o.id));

  const measure = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.bottom + 4, left: r.left, width: r.width });
  };

  // Portalled menu positioned against the trigger so an ancestor `overflow-hidden` can't clip it.
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

  const toggle = (id: string) =>
    onChange(values.includes(id) ? values.filter((v) => v !== id) : [...values, id]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q))
    : options;

  return (
    <div ref={wrapRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setQuery(''); }}
        className="w-full min-h-[2.75rem] flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-white/[0.04] border border-white/8 text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all"
      >
        <div className="flex-1 flex flex-wrap gap-1.5 min-w-0">
          {selected.length === 0 ? (
            <span className="text-slate-600">{placeholder ?? 'Select…'}</span>
          ) : (
            selected.map((o) => (
              <span
                key={o.id}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-xs font-medium text-brand-teal bg-brand-teal/10 border border-brand-teal/20"
              >
                {o.label}
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => { e.stopPropagation(); toggle(o.id); }}
                  className="p-0.5 rounded hover:bg-brand-teal/20"
                >
                  <X className="w-3 h-3" />
                </span>
              </span>
            ))
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && rect && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[70] rounded-xl border border-white/10 shadow-xl py-1"
          style={{ top: rect.top, left: rect.left, width: rect.width, background: 'rgba(15,23,42,0.98)' }}
        >
          <div className="relative px-2 pb-1.5 pt-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full pl-8 pr-2 py-1.5 rounded-lg text-sm bg-white/[0.04] border border-white/8 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-teal/30"
            />
          </div>
          <div className="max-h-52 overflow-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2.5 text-xs text-slate-500">No matches found</p>
            ) : (
              filtered.map((o) => {
                const checked = values.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggle(o.id)}
                    className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                  >
                    <span className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-brand-teal border-brand-teal' : 'border-white/20'}`}>
                      {checked && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <span className="min-w-0 truncate">
                      <span className="text-slate-200">{o.label}</span>
                      {o.sublabel && <span className="text-slate-500 text-xs ml-1.5">— {o.sublabel}</span>}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
