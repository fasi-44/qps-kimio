'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, BarChart3, Building2, CheckCircle2, Clock, Circle, Plus,
  CalendarDays,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function scoreColor(pct: number) {
  if (pct >= 80) return '#22C55E';
  if (pct >= 60) return '#F59E0B';
  if (pct >= 40) return '#F97316';
  return '#EF4444';
}

const STATUS_CONFIG: Record<string, { label: string; variant: any; icon: any; color: string }> = {
  DRAFT:       { label: 'Draft',       variant: 'secondary',    icon: Circle,       color: 'text-slate-500' },
  IN_PROGRESS: { label: 'In Progress', variant: 'warning',      icon: Clock,        color: 'text-amber-400' },
  SUBMITTED:   { label: 'Submitted',   variant: 'default',      icon: Clock,        color: 'text-sky-400' },
  APPROVED:    { label: 'Approved',    variant: 'success',      icon: CheckCircle2, color: 'text-emerald-400' },
  REJECTED:    { label: 'Rejected',    variant: 'destructive',  icon: Circle,       color: 'text-red-400' },
  SENT_BACK:   { label: 'Sent Back',   variant: 'warning',      icon: Clock,        color: 'text-amber-400' },
};

interface CycleDetail {
  name: string;
  quarter: string;
  year: number;
  type: string;
  stats: { total: number; completed: number; inProgress: number; notStarted: number };
  departments: any[];
}

export default function AssessmentCycleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery({
    queryKey: ['assessment-cycle', id],
    queryFn: () => api.get<CycleDetail>(`/institution-assessments/${id}`),
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl animate-pulse">
        <div className="h-8 w-64 rounded-xl bg-white/5" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-white/5" />)}
        </div>
        <div className="h-64 rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (!data) return null;
  const ia = data;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <Link
            href="/assessment-cycles"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-all border border-transparent hover:border-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold text-slate-100 truncate">{ia.name}</h1>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
              <CalendarDays className="w-3 h-3" />
              {ia.quarter} {ia.year} · {ia.type}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/assessment-cycles/${id}/report`}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-brand-teal hover:bg-brand-teal-dark hover:shadow-lg hover:shadow-brand-teal/20 transition-all"
            >
              <BarChart3 className="w-4 h-4" />
              View Report
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        {[
          { label: 'Total Departments', value: ia.stats.total, color: 'text-slate-200' },
          { label: 'Approved', value: ia.stats.completed, color: 'text-emerald-400' },
          { label: 'In Progress', value: ia.stats.inProgress, color: 'text-amber-400' },
          { label: 'Not Started', value: ia.stats.notStarted, color: 'text-slate-500' },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl p-4"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
          >
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={cn('text-2xl font-extrabold tabular-nums', s.color)}>{s.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Department grid */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
      >
        <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-teal" />
            Department Status
          </h2>
          {(user?.role === 'ADMIN' || user?.role === 'ASSESSOR') && (
            <Link
              href={`/assessments/new?institutionAssessmentId=${id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-brand-teal border border-brand-teal/25 bg-brand-teal/8 hover:bg-brand-teal/15 transition-all"
            >
              <Plus className="w-3 h-3" />
              Add Department
            </Link>
          )}
        </div>

        <div className="divide-y divide-white/5">
          {ia.departments.map((dept: any, i: number) => {
            const sc = dept.assessment ? (STATUS_CONFIG[dept.assessment.status] ?? STATUS_CONFIG.DRAFT) : null;
            const Icon = sc?.icon ?? Circle;

            return (
              <motion.div
                key={dept.departmentCode}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-4 px-5 py-3.5"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-200 truncate">{dept.departmentName}</span>
                    <span className="text-[0.65rem] text-slate-400 font-mono shrink-0">{dept.departmentCode}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {dept.assessment ? (
                    <>
                      {dept.assessment.compliancePct > 0 && (
                        <span
                          className="text-sm font-bold tabular-nums hidden sm:block"
                          style={{ color: scoreColor(dept.assessment.compliancePct) }}
                        >
                          {dept.assessment.compliancePct.toFixed(1)}%
                        </span>
                      )}
                      <Badge variant={sc!.variant}>{sc!.label}</Badge>
                      <Link
                        href={
                          dept.assessment.status === 'DRAFT' ||
                          dept.assessment.status === 'IN_PROGRESS' ||
                          dept.assessment.status === 'SENT_BACK'
                            ? `/assessments/${dept.assessment.id}/wizard`
                            : `/assessments/${dept.assessment.id}`
                        }
                        className="text-xs text-brand-teal hover:underline shrink-0"
                      >
                        {dept.assessment.status === 'APPROVED' ? 'View' : 'Open'}
                      </Link>
                    </>
                  ) : (
                    <span className="text-xs text-slate-600">Not started</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
