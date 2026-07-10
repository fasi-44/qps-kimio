'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { useConfirmState, resolveConfirm } from '@/hooks/use-confirm';

/** Global confirmation dialog host. Render once near the app root (see providers.tsx). */
export function ConfirmDialogHost() {
  const state = useConfirmState();

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolveConfirm(false);
      else if (e.key === 'Enter') resolveConfirm(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [state]);

  const danger = state?.tone !== 'default'; // default to danger styling for destructive actions

  return (
    <AnimatePresence>
      {state && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={() => resolveConfirm(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  danger
                    ? 'text-red-400 bg-red-500/10 border-red-500/20'
                    : 'text-brand-teal bg-brand-teal/10 border-brand-teal/20'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold" style={{ color: 'var(--text-base)' }}>{state.title}</h2>
                {state.message && <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{state.message}</p>}
              </div>
              <button
                onClick={() => resolveConfirm(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/10 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => resolveConfirm(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium border transition-all hover:bg-white/5"
                style={{ color: 'var(--text-base)', borderColor: 'var(--card-border)' }}
              >
                {state.cancelLabel ?? 'Cancel'}
              </button>
              <button
                autoFocus
                onClick={() => resolveConfirm(true)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all ${
                  danger
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-brand-teal hover:bg-brand-teal-dark'
                }`}
              >
                {state.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
