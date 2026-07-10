'use client';

import { useEffect, useState } from 'react';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
}

export interface ConfirmState extends ConfirmOptions {
  id: string;
  resolve: (ok: boolean) => void;
}

let current: ConfirmState | null = null;
const listeners = new Set<(s: ConfirmState | null) => void>();

function emit() {
  const snapshot = current;
  listeners.forEach((l) => l(snapshot));
}

/** Imperatively ask for confirmation. Resolves true if confirmed, false otherwise. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  // If a dialog is already open, supersede it (treat the previous as cancelled).
  if (current) current.resolve(false);
  return new Promise<boolean>((resolve) => {
    current = { ...options, id: crypto.randomUUID(), resolve };
    emit();
  });
}

/** Resolve and close the active dialog. */
export function resolveConfirm(ok: boolean) {
  if (!current) return;
  current.resolve(ok);
  current = null;
  emit();
}

export function useConfirmState() {
  const [state, setState] = useState<ConfirmState | null>(current);
  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return state;
}
