'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import { useAuthStore } from '@/stores/auth.store';

const FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'CUSTOM'];
const inputCls =
  'w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/8 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all';

export default function NewCommitteePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const selectedModule = useAuthStore((s) => s.selectedModule);

  useEffect(() => {
    if (user && user.role !== 'ADMIN' && user.role !== 'HOD') {
      router.replace('/committees');
    }
  }, [user, router]);

  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: '',
    type: '',
    purpose: '',
    frequency: 'QUARTERLY',
    effectiveDate: '',
    expiryDate: '',
  });
  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      const res = await api.post<{ id: string }>('/committees', {
        name: form.name,
        category: form.category || undefined,
        type: form.type || undefined,
        purpose: form.purpose || undefined,
        frequency: form.frequency,
        effectiveDate: form.effectiveDate || undefined,
        expiryDate: form.expiryDate || undefined,
        module: selectedModule ?? 'NQAS',
      });
      toast.success('Committee created');
      router.push(`/committees/${res.id}`);
    } catch (err) {
      toast.error('Failed to create', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-6 sm:mb-8"
      >
        <Link
          href="/committees"
          className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-all border border-transparent hover:border-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-slate-100">New Committee</h1>
          <p className="text-slate-500 text-sm mt-0.5">Constitute a committee for NABH / NQAS governance</p>
        </div>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={onSubmit}
        className="space-y-6"
      >
        <div
          className="rounded-2xl p-4 sm:p-6 space-y-5"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        >
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest border-b border-white/6 pb-3">
            Committee Details
          </h2>

          <div className="space-y-2">
            <Label>Committee Name</Label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="e.g. Hospital Infection Control Committee" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category (optional)</Label>
              <input value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="e.g. Clinical, Statutory" className={inputCls} />
            </div>
            <div className="space-y-2">
              <Label>Type (optional)</Label>
              <input value={form.type} onChange={(e) => set('type', e.target.value)} placeholder="e.g. NABH, NQAS" className={inputCls} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Meeting Frequency</Label>
            <Select value={form.frequency} onValueChange={(v) => set('frequency', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{f.replace('_', '-')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Effective Date (optional)</Label>
              <DatePicker value={form.effectiveDate} onChange={(v) => set('effectiveDate', v)} placeholder="Select date" />
            </div>
            <div className="space-y-2">
              <Label>Expiry Date (optional)</Label>
              <DatePicker value={form.expiryDate} onChange={(v) => set('expiryDate', v)} placeholder="Select date" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Purpose / Objectives (optional)</Label>
            <Textarea value={form.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="Mandate and objectives of this committee…" rows={3} />
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className={cn(
            'w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all duration-200 disabled:opacity-65 disabled:cursor-not-allowed',
            pending ? 'bg-brand-teal/60' : 'bg-brand-teal hover:bg-brand-teal-dark hover:shadow-xl hover:shadow-brand-teal/20 hover:scale-[1.01] active:scale-[0.99]',
          )}
        >
          {pending ? (
            <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Creating…</span>
          ) : (
            'Create Committee →'
          )}
        </button>
      </motion.form>
    </div>
  );
}
