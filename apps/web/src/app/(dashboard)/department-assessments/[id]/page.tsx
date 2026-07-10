'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Search,
  ClipboardList,
  ChevronRight,
  CalendarDays,
  ArrowLeft,
  BarChart3,
  ArrowUpRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface InstitutionAssessment {
  id: string;
  name: string;
  quarter: string;
  year: number;
  type: string;
  module: string;
  startDate: string;
  endDate: string;
  _count?: { assessments: number };
}

interface Assessment {
  id: string;
  department: { id: string; name: string; code: string };
  quarter: string;
  year: number;
  type: string;
  status: string;
  compliancePct: number;
  totalNqasScore: number;
  maxNqasScore: number;
  completedSections: number;
  totalSections: number;
  assesseeName: string;
  assessorNames: string[];
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'warning' | 'success' | 'destructive' }> = {
  DRAFT:       { label: 'Draft',       variant: 'secondary' },
  IN_PROGRESS: { label: 'In Progress', variant: 'warning' },
  SUBMITTED:   { label: 'Submitted',   variant: 'default' },
  APPROVED:    { label: 'Approved',    variant: 'success' },
  REJECTED:    { label: 'Rejected',    variant: 'destructive' },
  SENT_BACK:   { label: 'Sent Back',   variant: 'warning' },
};

function scoreColor(pct: number) {
  if (pct >= 80) return '#22C55E';
  if (pct >= 60) return '#F59E0B';
  if (pct >= 40) return '#F97316';
  return '#EF4444';
}

export default function DepartmentAssessmentsPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const selectedModule = useAuthStore((s) => s.selectedModule);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const { data: cycle, isLoading: cycleLoading } = useQuery<InstitutionAssessment>({
    queryKey: ['assessment-cycle', id],
    queryFn: () => api.get(`/institution-assessments/${id}`),
  });

  const { data, isLoading: assessmentsLoading } = useQuery<{ data: Assessment[]; total: number }>({
    queryKey: ['assessments', selectedModule, id],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '200', institutionAssessmentId: id });
      if (selectedModule) params.set('module', selectedModule);
      return api.get(`/assessments?${params}`);
    },
  });

  const assessments = data?.data ?? [];
  const isLoading = cycleLoading || assessmentsLoading;

  const filtered = assessments.filter((a) => {
    const matchesSearch =
      !search ||
      a.department.name.toLowerCase().includes(search.toLowerCase()) ||
      a.department.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between flex-wrap gap-4"
      >
        <div className="flex items-center gap-3">
          <Link
            href="/assessment-cycles"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-all border border-transparent hover:border-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            {cycleLoading ? (
              <div className="h-5 w-48 rounded bg-white/5 animate-pulse" />
            ) : (
              <>
                <h1 className="text-xl font-extrabold text-slate-100">{cycle?.name}</h1>
                <p className="text-slate-500 text-sm mt-0.5 flex items-center gap-1.5">
                  <CalendarDays className="w-3 h-3" />
                  {cycle?.quarter} {cycle?.year} · {cycle?.type}
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/assessment-cycles/${id}/report`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/10 text-slate-300 hover:bg-white/8 transition-all"
          >
            <BarChart3 className="w-4 h-4" />
            Report
          </Link>
          {(user?.role === 'ADMIN' || user?.role === 'ASSESSOR') && (
            <Link
              href={`/assessments/new?institutionAssessmentId=${id}`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-teal hover:bg-brand-teal-dark hover:shadow-lg hover:shadow-brand-teal/20 hover:scale-[1.02] transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Department
            </Link>
          )}
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap gap-3"
      >
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by department…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/8 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {['ALL', 'DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150',
                statusFilter === s
                  ? 'bg-brand-teal/15 text-brand-teal border border-brand-teal/25'
                  : 'bg-white/4 text-slate-500 border border-transparent hover:border-white/10 hover:text-slate-300',
              )}
            >
              {s === 'ALL' ? 'All' : (STATUS_CONFIG[s]?.label ?? s)}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
      >
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 text-[0.68rem] font-bold text-slate-600 uppercase tracking-widest border-b border-white/6">
          <span>Department</span>
          <span className="hidden sm:block text-right">Progress</span>
          <span className="hidden md:block text-right">Score</span>
          <span className="text-right">Status</span>
          <span />
        </div>

        <div className="divide-y divide-white/5">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-4">
                <div className="space-y-1.5">
                  <div className="h-4 w-48 rounded bg-white/5 animate-pulse" />
                  <div className="h-3 w-28 rounded bg-white/5 animate-pulse" />
                </div>
                <div className="hidden sm:flex flex-col items-end gap-1.5 w-32">
                  <div className="h-3 w-20 rounded bg-white/5 animate-pulse" />
                  <div className="h-1 w-full rounded-full bg-white/5 animate-pulse" />
                </div>
                <div className="hidden md:block h-5 w-12 rounded bg-white/5 animate-pulse" />
                <div className="h-5 w-20 rounded-full bg-white/5 animate-pulse" />
                <div className="h-4 w-4 rounded bg-white/5 animate-pulse" />
              </div>
            ))
          ) : filtered.length ? (
            filtered.map((a, i) => {
              const sc = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.DRAFT;
              const completedCount = Array.isArray(a.completedSections)
                ? (a.completedSections as unknown as string[]).length
                : (a.completedSections as unknown as number);
              const progressPct = a.totalSections
                ? Math.round((completedCount / a.totalSections) * 100)
                : 0;
              const href =
                a.status === 'DRAFT' || a.status === 'IN_PROGRESS' || a.status === 'SENT_BACK'
                  ? `/assessments/${a.id}/wizard`
                  : `/assessments/${a.id}`;

              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="group"
                >
                  <Link
                    href={href}
                    className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-4 hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-200 truncate group-hover:text-brand-teal transition-colors">
                          {a.department.name}
                        </span>
                        <span className="text-[0.65rem] text-slate-400 font-mono shrink-0">
                          {a.department.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-600">{a.assesseeName || '—'}</span>
                      </div>
                    </div>

                    <div className="hidden sm:flex flex-col items-end gap-1.5 w-32">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold tabular-nums" style={{ color: progressPct === 100 ? '#22c55e' : progressPct > 0 ? '#38bdf8' : undefined }}>
                          {completedCount}
                          <span className="font-normal text-slate-600">/{a.totalSections}</span>
                        </span>
                        <span className="text-[0.65rem] text-slate-600">sections</span>
                      </div>
                      <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'var(--inner-border)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${progressPct}%`,
                            background: progressPct === 100 ? '#22c55e' : progressPct > 0 ? '#38bdf8' : 'transparent',
                          }}
                        />
                      </div>
                      <span className="text-[0.6rem] text-slate-500 tabular-nums">{progressPct}%</span>
                    </div>

                    <div className="hidden md:block text-right">
                      {a.compliancePct > 0 ? (
                        <span className="text-sm font-bold tabular-nums" style={{ color: scoreColor(a.compliancePct) }}>
                          {a.compliancePct.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <Badge variant={sc.variant}>{sc.label}</Badge>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-brand-teal transition-colors" />
                  </Link>
                </motion.div>
              );
            })
          ) : (
            <div className="py-16 text-center">
              <ClipboardList className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No department assessments yet</p>
              {(user?.role === 'ADMIN' || user?.role === 'ASSESSOR') && (
                <Link
                  href={`/assessments/new?institutionAssessmentId=${id}`}
                  className="text-brand-teal text-sm mt-1 hover:underline inline-flex items-center gap-1"
                >
                  Add the first department <ArrowUpRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {!isLoading && filtered.length > 0 && (
        <p className="text-xs text-slate-500 text-right">
          Showing {filtered.length} of {assessments.length} assessments
        </p>
      )}
    </div>
  );
}
