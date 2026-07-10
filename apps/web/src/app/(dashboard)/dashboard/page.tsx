'use client';

import { useEffect } from 'react';
import { motion } from 'motion/react';
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  RefreshCw,
  Building2,
  CalendarDays,
} from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';

interface DashboardOverview {
  totalAssessments: number;
  totalCycles: number;
  pendingApprovals: number;
  approvedCount: number;
  rejectedCount: number;
  totalUsers: number;
  avgCompliancePct: number;
}

interface AssessmentCycle {
  id: string;
  name: string;
  quarter: string;
  year: number;
  type: string;
  module: string;
  createdAt: string;
  _count: { assessments: number };
}

interface DeptScore {
  department: string;
  code: string;
  latestPct: number;
  trend: number;
  assessmentCount: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Draft', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  SUBMITTED: { label: 'Submitted', color: 'text-brand-teal', bg: 'bg-brand-teal/10 border-brand-teal/20' },
  APPROVED: { label: 'Approved', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  REJECTED: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  SENT_BACK: { label: 'Sent Back', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
};

function scoreColor(pct: number) {
  if (pct >= 80) return '#22C55E';
  if (pct >= 60) return '#F59E0B';
  if (pct >= 40) return '#F97316';
  return '#EF4444';
}

function ScoreRing({ pct, size = 56 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = scoreColor(pct);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        className="score-ring"
      />
    </svg>
  );
}

const STAGGER = 0.07;

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const { data: stats, isLoading, refetch } = useQuery<DashboardOverview>({
    queryKey: ['dashboard-overview'],
    queryFn: () => api.get('/dashboard/overview'),
    refetchInterval: 60_000,
  });

  const selectedModule = useAuthStore((s) => s.selectedModule);

  const { data: recentCycles = [] } = useQuery<AssessmentCycle[]>({
    queryKey: ['institution-assessments-recent', selectedModule],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '6', page: '1' });
      if (selectedModule) params.set('module', selectedModule);
      return api.get(`/institution-assessments?${params}`);
    },
    refetchInterval: 60_000,
  });

  const { data: deptData = [] } = useQuery<DeptScore[]>({
    queryKey: ['dashboard-dept-scores'],
    queryFn: () => api.get('/dashboard/department-scores'),
    refetchInterval: 120_000,
  });

  const departmentScores = deptData;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const statCards = [
    {
      label: 'Dept Assessments',
      value: stats?.totalAssessments ?? 0,
      sub: `${stats?.totalCycles ?? 0} cycle${(stats?.totalCycles ?? 0) !== 1 ? 's' : ''}`,
      icon: ClipboardCheck,
      color: 'text-brand-teal',
      bg: 'bg-brand-teal/[0.07]',
      border: 'border-brand-teal/15',
    },
    {
      label: 'Approved',
      value: stats?.approvedCount ?? 0,
      sub: stats ? `${stats.avgCompliancePct.toFixed(1)}% avg` : '—',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/[0.07]',
      border: 'border-emerald-500/15',
    },
    {
      label: 'Pending Approval',
      value: stats?.pendingApprovals ?? 0,
      sub: 'Awaiting review',
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/[0.07]',
      border: 'border-amber-500/15',
    },
    {
      label: 'Rejected',
      value: stats?.rejectedCount ?? 0,
      sub: 'Needs rework',
      icon: XCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/[0.07]',
      border: 'border-red-500/15',
    },
  ];

  return (
    <div className="space-y-7 max-w-7xl">
      {/* ── Greeting header ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-start justify-between flex-wrap gap-4"
      >
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 leading-tight">
            {greeting()}, {user?.name?.split(' ')[0] ?? 'User'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            KMIO NQAS Accreditation Platform · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-slate-200 hover:bg-white/8 transition-all border border-transparent hover:border-white/10"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <Link
            href="/assessment-cycles/new"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-brand-teal hover:bg-brand-teal-dark transition-all duration-200"
          >
            New Cycle
          </Link>
        </div>
      </motion.div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * STAGGER, duration: 0.45 }}
            className={cn(
              'relative rounded-2xl p-5 overflow-hidden',
              card.bg,
              `border ${card.border}`,
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">
                  {card.label}
                </p>
                {isLoading ? (
                  <div className="h-8 w-16 rounded-lg bg-white/5 animate-pulse" />
                ) : (
                  <p className={cn('text-2xl font-black', card.color)}>{card.value}</p>
                )}
                {!isLoading && card.sub && (
                  <p className="text-[0.68rem] text-slate-600 mt-1">{card.sub}</p>
                )}
              </div>
              <div className={cn('p-2.5 rounded-xl bg-white/5 border border-white/8', card.color)}>
                <card.icon className="w-4.5 h-4.5" strokeWidth={1.8} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Main content grid ── */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent assessments */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.45 }}
          className="lg:col-span-2 rounded-2xl overflow-hidden"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
          }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
            <h2 className="text-sm font-bold text-slate-200">Recent Assessment Cycles</h2>
            <Link
              href="/assessment-cycles"
              className="flex items-center gap-1 text-xs text-brand-teal hover:text-brand-teal-light transition-colors font-medium"
            >
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-white/5">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-40 rounded bg-white/5 animate-pulse" />
                    <div className="h-2.5 w-24 rounded bg-white/5 animate-pulse" />
                  </div>
                  <div className="h-5 w-16 rounded-full bg-white/5 animate-pulse" />
                </div>
              ))
            ) : recentCycles.length ? (
              recentCycles.map((cycle) => (
                <Link
                  key={cycle.id}
                  href={`/assessment-cycles/${cycle.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors group"
                >
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-lg bg-brand-teal/10 border border-brand-teal/15 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-brand-teal" />
                  </div>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-200 truncate group-hover:text-brand-teal transition-colors">
                      {cycle.name}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-0.5">
                      <CalendarDays className="w-3 h-3" />
                      {cycle.quarter} {cycle.year}
                      <span className="text-slate-700">·</span>
                      {cycle._count.assessments} dept{cycle._count.assessments !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Type badge */}
                  <span
                    className={cn(
                      'text-[0.68rem] font-semibold px-2.5 py-0.5 rounded-full border shrink-0',
                      cycle.type === 'EXTERNAL'
                        ? 'text-brand-teal bg-brand-teal/10 border-brand-teal/20'
                        : 'text-slate-400 bg-slate-500/10 border-slate-500/20',
                    )}
                  >
                    {cycle.type}
                  </span>

                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-brand-teal transition-colors shrink-0" />
                </Link>
              ))
            ) : (
              <div className="px-5 py-10 text-center">
                <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-slate-600 text-sm">No assessment cycles yet.</p>
                <Link
                  href="/assessment-cycles/new"
                  className="text-brand-teal text-sm hover:underline mt-1 inline-block"
                >
                  Create the first cycle
                </Link>
              </div>
            )}
          </div>
        </motion.div>

        {/* Department compliance scores */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.45 }}
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
          }}
        >
          <div className="px-5 py-4 border-b border-white/6">
            <h2 className="text-sm font-bold text-slate-200">Department Scores</h2>
            <p className="text-xs text-slate-600 mt-0.5">Current quarter avg</p>
          </div>

          <div className="p-4 space-y-3">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-full rounded bg-white/5 animate-pulse" />
                    <div className="h-2 w-full rounded-full bg-white/5 animate-pulse" />
                  </div>
                </div>
              ))
            ) : departmentScores.length ? (
              departmentScores.slice(0, 8).map((dept, i) => (
                <motion.div
                  key={dept.code}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.04 }}
                  className="space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium truncate max-w-[130px]">
                      {dept.department}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {dept.trend !== 0 && (
                        <span
                          className="text-[0.6rem] font-semibold tabular-nums"
                          style={{ color: dept.trend > 0 ? '#22C55E' : '#EF4444' }}
                        >
                          {dept.trend > 0 ? '+' : ''}{dept.trend}%
                        </span>
                      )}
                      <span
                        className="text-xs font-bold tabular-nums"
                        style={{ color: scoreColor(dept.latestPct) }}
                      >
                        {dept.latestPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/6 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${dept.latestPct}%` }}
                      transition={{ delay: 0.5 + i * 0.04, duration: 0.7, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ background: scoreColor(dept.latestPct) }}
                    />
                  </div>
                </motion.div>
              ))
            ) : (
              <p className="text-center text-slate-600 text-sm py-6">No approved assessments yet</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
