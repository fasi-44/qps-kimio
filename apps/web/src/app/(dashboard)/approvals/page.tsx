'use client';

import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { CheckSquare2, ArrowUpRight, CalendarDays, User } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface PendingAssessment {
  id: string;
  department: { name: string; code: string };
  quarter: string;
  year: number;
  type: string;
  compliancePct: number;
  totalNqasScore: number;
  maxNqasScore: number;
  completedSections: string[];
  totalSections: number;
  assesseeName: string;
  assessorNames: string[];
  updatedAt: string;
}

function scoreColor(pct: number) {
  if (pct >= 80) return '#22C55E';
  if (pct >= 60) return '#F59E0B';
  if (pct >= 40) return '#F97316';
  return '#EF4444';
}

export default function ApprovalsPage() {
  const { data, isLoading } = useQuery<{ data: PendingAssessment[]; total: number }>({
    queryKey: ['approvals-pending'],
    queryFn: () => api.get('/approvals/pending'),
    refetchInterval: 30_000,
  });

  const pending = data?.data ?? [];

  return (
    <div className="space-y-6 max-w-6xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-extrabold text-slate-100">Pending Approvals</h1>
        <p className="text-slate-500 text-sm mt-1 flex items-center gap-2">
          Assessments submitted for HOD review
          {pending.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-brand-teal/10 text-brand-teal text-xs font-bold border border-brand-teal/20">
              {pending.length}
            </span>
          )}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
      >
        {/* Card header */}
        <div className="px-5 py-3.5 border-b flex items-center gap-3" style={{ borderColor: 'var(--card-border)' }}>
          <CheckSquare2 className="w-4 h-4 text-brand-teal" />
          <span className="text-sm font-bold text-slate-300">Awaiting Review</span>
        </div>

        {/* Column header */}
        {!isLoading && pending.length > 0 && (
          <div
            className="grid items-center gap-4 px-5 py-2.5 text-[0.65rem] font-bold uppercase tracking-widest text-slate-500"
            style={{
              gridTemplateColumns: '1fr 180px 110px 90px',
              borderBottom: '1px solid var(--inner-border)',
              background: 'var(--inner-bg)',
            }}
          >
            <span>Department</span>
            <span>Section Progress</span>
            <span className="text-right">Compliance</span>
            <span />
          </div>
        )}

        <div className="divide-y" style={{ borderColor: 'var(--inner-border)' }}>
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="grid gap-4 px-5 py-4 animate-pulse"
                style={{ gridTemplateColumns: '1fr 180px 110px 90px' }}
              >
                <div className="space-y-2">
                  <div className="h-4 w-48 rounded bg-white/5" />
                  <div className="h-3 w-32 rounded bg-white/5" />
                </div>
                <div className="space-y-2 self-center">
                  <div className="h-2 w-full rounded-full bg-white/5" />
                  <div className="h-3 w-16 rounded bg-white/5 ml-auto" />
                </div>
                <div className="space-y-1 self-center text-right">
                  <div className="h-4 w-12 rounded bg-white/5 ml-auto" />
                  <div className="h-3 w-16 rounded bg-white/5 ml-auto" />
                </div>
                <div className="h-7 w-20 rounded-xl bg-white/5 self-center ml-auto" />
              </div>
            ))
          ) : pending.length ? (
            pending.map((a, i) => {
              const progressPct = (a.totalSections && a.completedSections?.length > 0)
                ? Math.round((a.completedSections.length / a.totalSections) * 100)
                : 0;

              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="group"
                >
                  <Link
                    href={`/assessments/${a.id}`}
                    className="grid gap-4 items-center px-5 py-4 hover:bg-white/[0.025] transition-colors"
                    style={{ gridTemplateColumns: '1fr 180px 110px 90px' }}
                  >
                    {/* ── Department info ── */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-slate-200 truncate group-hover:text-brand-teal transition-colors">
                          {a.department.name}
                        </span>
                        <span
                          className="text-[0.65rem] font-mono font-bold shrink-0 px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--inner-bg)', color: 'var(--text-muted)' }}
                        >
                          {a.department.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {a.quarter} {a.year} · {a.type}
                        </span>
                        {a.assesseeName && (
                          <>
                            <span className="opacity-40">·</span>
                            <span className="flex items-center gap-1 truncate max-w-[160px]">
                              <User className="w-3 h-3 shrink-0" />
                              {a.assesseeName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* ── Section progress ── */}
                    <div className="min-w-0">
                      {a.completedSections?.length &&
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[0.65rem] text-slate-500 font-medium">Sections</span>
                          <span className="text-[0.7rem] font-bold tabular-nums" style={{ color: progressPct === 100 ? '#22c55e' : 'var(--text-muted)' }}>
                            {a.completedSections?.length}/{a.totalSections}
                          </span>
                        </div>
                      }
                      {a.completedSections?.length &&
                        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--inner-border)' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${progressPct}%`,
                              background: progressPct === 100 ? '#22c55e' : '#0EA5E9',
                            }}
                          />
                        </div>
                      }
                      <div className="text-right mt-1">
                        <span className="text-[0.6rem] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                          {progressPct}% done
                        </span>
                      </div>
                    </div>

                    {/* ── Score ── */}
                    <div className="text-right">
                      <div
                        className="text-base font-black tabular-nums leading-none"
                        style={{ color: scoreColor(a.compliancePct) }}
                      >
                        {a.compliancePct.toFixed(1)}%
                      </div>
                      <div className="text-[0.65rem] mt-0.5 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {a.totalNqasScore}/{a.maxNqasScore} pts
                      </div>
                    </div>

                    {/* ── Review CTA ── */}
                    <div className="flex justify-end">
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-brand-teal bg-brand-teal/10 border border-brand-teal/20 group-hover:bg-brand-teal/18 transition-colors whitespace-nowrap">
                        Review <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </div>
                  </Link>
                </motion.div>
              );
            })
          ) : (
            <div className="py-16 text-center">
              <CheckSquare2 className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No pending approvals</p>
              <p className="text-slate-500 text-sm mt-1">All assessments are up to date</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
