'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowLeft, Loader2, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

function getCurrentQuarter(): string {
  const m = new Date().getMonth() + 1;
  return m <= 3 ? 'Q1' : m <= 6 ? 'Q2' : m <= 9 ? 'Q3' : 'Q4';
}
function getQuarterStart(q: string, year: number): string {
  const startMonth: Record<string, number> = { Q1: 0, Q2: 3, Q3: 6, Q4: 9 };
  return new Date(year, startMonth[q], 1).toISOString().slice(0, 10);
}
function getQuarterEnd(q: string, year: number): string {
  const endMonth: Record<string, number> = { Q1: 3, Q2: 6, Q3: 9, Q4: 12 };
  return new Date(year, endMonth[q], 0).toISOString().slice(0, 10);
}

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i);
const TYPES = ['INTERNAL', 'EXTERNAL'];

export default function NewAssessmentCyclePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const selectedModule = useAuthStore((s) => s.selectedModule);

  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      router.replace('/assessment-cycles');
    }
  }, [user, router]);
  const currentYear = new Date().getFullYear();
  const currentQuarter = getCurrentQuarter();

  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    name: `${currentQuarter} ${currentYear} NQAS Assessment`,
    quarter: currentQuarter,
    year: currentYear,
    type: 'INTERNAL',
    startDate: getQuarterStart(currentQuarter, currentYear),
    endDate: getQuarterEnd(currentQuarter, currentYear),
    assessmentDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const set = (k: string, v: any) => setForm((p) => {
    const updated = { ...p, [k]: v };
    // Auto-update name and dates when quarter/year changes
    if (k === 'quarter' || k === 'year') {
      const q = k === 'quarter' ? v : updated.quarter;
      const y = k === 'year' ? v : updated.year;
      updated.name = `${q} ${y} NQAS Assessment`;
      updated.startDate = getQuarterStart(q, y);
      updated.endDate = getQuarterEnd(q, y);
    }
    return updated;
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      const res = await api.post<{ id: string }>('/institution-assessments', {
        ...form,
        assessmentDate: new Date(form.assessmentDate).toISOString(),
        module: selectedModule ?? 'NQAS',
      });
      toast.success('Assessment cycle created');
      router.push(`/assessment-cycles/${res.id}`);
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
          href="/assessment-cycles"
          className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-all border border-transparent hover:border-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-slate-100">New Assessment Cycle</h1>
          <p className="text-slate-500 text-sm mt-0.5">Create a hospital-wide assessment for a quarter</p>
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
            Cycle Details
          </h2>

          <div className="space-y-2">
            <Label>Assessment Name</Label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Q1 2026 NQAS Assessment"
              required
              className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/8 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Quarter</Label>
              <Select value={form.quarter} onValueChange={(v) => set('quarter', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUARTERS.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={form.year.toString()} onValueChange={(v) => set('year', +v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => set('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set('startDate', e.target.value)}
                  required
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/8 text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all [color-scheme:dark]"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => set('endDate', e.target.value)}
                  required
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/8 text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all [color-scheme:dark]"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assessment Date</Label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
              <input
                type="date"
                value={form.assessmentDate}
                onChange={(e) => set('assessmentDate', e.target.value)}
                required
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/8 text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Any context or instructions for this assessment cycle…"
              rows={3}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className={cn(
            'w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all duration-200 disabled:opacity-65 disabled:cursor-not-allowed',
            pending
              ? 'bg-brand-teal/60'
              : 'bg-brand-teal hover:bg-brand-teal-dark hover:shadow-xl hover:shadow-brand-teal/20 hover:scale-[1.01] active:scale-[0.99]',
          )}
        >
          {pending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating…
            </span>
          ) : (
            'Create Assessment Cycle →'
          )}
        </button>
      </motion.form>
    </div>
  );
}
