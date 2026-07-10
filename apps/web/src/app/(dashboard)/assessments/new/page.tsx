'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
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
import { useAuthStore } from '@/stores/auth.store';

interface Department { id: string; name: string; code: string; }
interface UserName { id: string; name: string; designation?: string | null; }
interface InstAssessment {
  id: string;
  name: string;
  quarter: string;
  year: number;
  type: string;
  module: string;
  startDate: string;
  endDate: string;
  assessmentDate: string;
  assessorNames: string[];
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function NewAssessmentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledId = searchParams.get('institutionAssessmentId') ?? '';

  const user = useAuthStore((s) => s.user);
  const selectedModule = useAuthStore((s) => s.selectedModule);
  const isAdmin = user?.role === 'ADMIN';

  const [institutionAssessmentId, setInstitutionAssessmentId] = useState(prefilledId);
  const [departmentId, setDepartmentId] = useState('');
  const [assesseeName, setAssesseeName] = useState(user?.name ?? '');
  const [leadAssessor, setLeadAssessor] = useState(user?.name ?? '');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  /* ── Data fetches ── */
  const { data: departments = [], isLoading: depsLoading } = useQuery<Department[]>({
    queryKey: ['nqas-departments'],
    queryFn: () => api.get('/checklists/departments'),
  });

  const { data: userNames = [] } = useQuery<UserName[]>({
    queryKey: ['user-names'],
    queryFn: () => api.get('/users/names'),
  });

  const { data: instAssessments = [] } = useQuery<InstAssessment[]>({
    queryKey: ['institution-assessments', selectedModule],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedModule) params.set('module', selectedModule);
      return api.get(`/institution-assessments?${params}`);
    },
  });

  const selectedCycle = instAssessments.find((ia) => ia.id === institutionAssessmentId) ?? null;

  /* Auto-select department matching the logged-in user's department */
  useEffect(() => {
    if (!departments.length || !user?.department) return;
    const match = departments.find(
      (d) => d.name.toLowerCase() === (user.department as unknown as string).toLowerCase(),
    );
    if (match) setDepartmentId(match.id);
  }, [departments, user?.department]);

  /* Pre-fill lead assessor from cycle (runs when cycle data loads or selection changes) */
  useEffect(() => {
    if (selectedCycle?.assessorNames?.length) {
      setLeadAssessor(selectedCycle.assessorNames[0]);
    }
  }, [selectedCycle?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Submit ── */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!institutionAssessmentId) errs.cycle = 'Select an assessment cycle';
    if (!selectedCycle) errs.cycle = 'Select an assessment cycle';
    if (!departmentId) errs.department = 'Select a department';
    if (!leadAssessor.trim()) errs.leadAssessor = 'Lead assessor name is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setPending(true);

    try {
      const res = await api.post<{ id: string }>('/assessments', {
        departmentId,
        quarter: selectedCycle!.quarter,
        year: selectedCycle!.year,
        type: selectedCycle!.type,
        startDate: selectedCycle!.startDate,
        endDate: selectedCycle!.endDate,
        assessmentDate: selectedCycle!.assessmentDate ?? new Date().toISOString(),
        assesseeName: assesseeName || user?.name || '',
        assessorNames: leadAssessor.trim()
          ? [leadAssessor.trim()]
          : (selectedCycle!.assessorNames?.length ? selectedCycle!.assessorNames : [leadAssessor.trim()]),
        notes: notes.trim() || undefined,
        module: selectedModule ?? 'NQAS',
        institutionAssessmentId,
      });
      toast.success('Assessment created', 'Redirecting to wizard…');
      router.push(`/assessments/${res.id}/wizard`);
    } catch (err) {
      toast.error('Failed to create', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-6 sm:mb-8"
      >
        <Link
          href="/assessments"
          className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-all border border-transparent hover:border-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-slate-100">New Assessment</h1>
          <p className="text-slate-500 text-sm mt-0.5">Select cycle and department, then add personnel</p>
        </div>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={onSubmit}
        className="space-y-5"
      >
        {/* ── Card 1: Assessment Cycle ── */}
        <div
          className="rounded-2xl p-4 sm:p-6 space-y-4"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        >
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest border-b border-white/6 pb-3">
            Assessment Cycle
          </h2>

          <div className="space-y-2">
            <Label>Cycle <span className="text-red-400">*</span></Label>
            <Select
              value={institutionAssessmentId || '__none__'}
              onValueChange={(v) => {
                const val = v === '__none__' ? '' : v;
                setInstitutionAssessmentId(val);
                if (val) setErrors((p) => ({ ...p, cycle: '' }));
              }}
            >
              <SelectTrigger error={!!errors.cycle}>
                <SelectValue placeholder="Select assessment cycle…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select assessment cycle…</SelectItem>
                {instAssessments.map((ia) => (
                  <SelectItem key={ia.id} value={ia.id}>
                    {ia.name} · {ia.quarter} {ia.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.cycle && <p className="text-red-400 text-xs">{errors.cycle}</p>}
            {instAssessments.length === 0 && (
              <p className="text-amber-400 text-xs">
                No cycles found.{' '}
                {isAdmin && (
                  <a href="/assessment-cycles/new" className="underline hover:text-amber-300">
                    Create one first
                  </a>
                )}
              </p>
            )}
          </div>

          {/* Prefetched cycle details — read-only info strip */}
          {selectedCycle && (
            <div
              className="space-y-3 px-4 py-3 rounded-xl"
              style={{ background: 'var(--inner-bg)', border: '1px solid var(--inner-border)' }}
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <p className="text-[0.6rem] text-slate-600 uppercase tracking-widest mb-0.5">Quarter</p>
                  <p className="text-xs font-bold text-slate-300">{selectedCycle.quarter}</p>
                </div>
                <div>
                  <p className="text-[0.6rem] text-slate-600 uppercase tracking-widest mb-0.5">Year</p>
                  <p className="text-xs font-bold text-slate-300">{selectedCycle.year}</p>
                </div>
                <div>
                  <p className="text-[0.6rem] text-slate-600 uppercase tracking-widest mb-0.5">Type</p>
                  <p className="text-xs font-bold text-slate-300">{selectedCycle.type}</p>
                </div>
                <div>
                  <p className="text-[0.6rem] text-slate-600 uppercase tracking-widest mb-0.5">Period</p>
                  <p className="text-xs font-bold text-slate-300">
                    {fmtDate(selectedCycle.startDate)} – {fmtDate(selectedCycle.endDate)}
                  </p>
                </div>
              </div>
              {selectedCycle.assessorNames?.length > 0 && (
                <div>
                  <p className="text-[0.6rem] text-slate-600 uppercase tracking-widest mb-0.5">Assessors</p>
                  <p className="text-xs font-bold text-slate-300">{selectedCycle.assessorNames.join(', ')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Card 2: Department ── */}
        <div
          className="rounded-2xl p-4 sm:p-6 space-y-4"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        >
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest border-b border-white/6 pb-3">
            Department
          </h2>
          <div className="space-y-2">
            <Label>Department <span className="text-red-400">*</span></Label>
            <Select
              value={departmentId || '__none__'}
              onValueChange={(v) => {
                const val = v === '__none__' ? '' : v;
                setDepartmentId(val);
                if (val) setErrors((p) => ({ ...p, department: '' }));
              }}
              disabled={depsLoading}
            >
              <SelectTrigger error={!!errors.department}>
                <SelectValue placeholder={depsLoading ? 'Loading departments…' : 'Select department…'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select department…</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                    <span className="text-slate-600 ml-1.5 font-mono text-xs">({d.code})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.department && <p className="text-red-400 text-xs">{errors.department}</p>}
          </div>
        </div>

        {/* ── Card 3: Personnel ── */}
        <div
          className="rounded-2xl p-4 sm:p-6 space-y-4"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        >
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest border-b border-white/6 pb-3">
            Personnel
          </h2>

          <div className="space-y-2">
            <Label>Assessee (Department Head)</Label>
            <Select
              value={assesseeName || '__none__'}
              onValueChange={(v) => setAssesseeName(v === '__none__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department head…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select department head…</SelectItem>
                {userNames.map((u) => (
                  <SelectItem key={u.id} value={u.name}>
                    {u.name}
                    {u.designation && (
                      <span className="text-slate-500 ml-1.5 text-xs">· {u.designation}</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Lead Assessor Name <span className="text-red-400">*</span></Label>
            <input
              value={leadAssessor}
              onChange={(e) => {
                setLeadAssessor(e.target.value);
                if (e.target.value.trim()) setErrors((p) => ({ ...p, leadAssessor: '' }));
              }}
              placeholder="Dr. Full Name"
              className={cn(
                'w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.04] border text-slate-100',
                'placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all',
                errors.leadAssessor
                  ? 'border-red-500/50 focus:ring-red-500/15'
                  : 'border-white/8 focus:border-brand-teal/50 focus:ring-brand-teal/20',
              )}
            />
            {errors.leadAssessor && <p className="text-red-400 text-xs">{errors.leadAssessor}</p>}
          </div>

          <div className="space-y-2">
            <Label>Notes <span className="text-slate-600 font-normal">(optional)</span></Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional context or observations…"
              rows={3}
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={pending}
          className={cn(
            'w-full py-3.5 rounded-xl font-bold text-sm text-white',
            'transition-all duration-200 disabled:opacity-65 disabled:cursor-not-allowed',
            pending
              ? 'bg-brand-teal/60'
              : 'bg-brand-teal hover:bg-brand-teal-dark hover:shadow-xl hover:shadow-brand-teal/20 hover:scale-[1.01] active:scale-[0.99]',
          )}
        >
          {pending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating Assessment…
            </span>
          ) : (
            'Create & Start Assessment →'
          )}
        </button>
      </motion.form>
    </div>
  );
}

export default function NewAssessmentPage() {
  return (
    <Suspense fallback={null}>
      <NewAssessmentForm />
    </Suspense>
  );
}
