'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import {
  Plus, ChevronRight, Landmark, Users, CalendarDays,
  CheckCircle2, Clock, AlertTriangle, ListTodo, Percent, CalendarClock,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Badge } from '@/components/ui/badge';

interface CommitteeStats {
  overview: { totalCommittees: number; activeCommittees: number; upcomingMeetings: number; expiredCommittees: number };
  meetings: { planned: number; conducted: number; pending: number; cancelled: number };
  actions: { open: number; overdue: number; closed: number; departmentWise: { department: string; count: number }[] };
  attendance: { percentage: number; present: number; recorded: number };
}

function StatTile({ icon: Icon, label, value, tone = 'default' }: {
  icon: React.ElementType; label: string; value: number | string;
  tone?: 'default' | 'danger' | 'success';
}) {
  const toneCls = tone === 'danger'
    ? 'text-red-400 bg-red-500/10 border-red-500/20'
    : tone === 'success'
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
      : 'text-brand-teal bg-brand-teal/10 border-brand-teal/20';
  return (
    <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${toneCls}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-extrabold text-slate-100 leading-none">{value}</p>
        <p className="text-[0.7rem] text-slate-500 mt-1 truncate">{label}</p>
      </div>
    </div>
  );
}

interface Committee {
  id: string;
  name: string;
  category: string | null;
  type: string | null;
  frequency: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  _count: { members: number; meetings: number; actions: number };
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  ACTIVE: 'default',
  INACTIVE: 'secondary',
  ARCHIVED: 'destructive',
};

export default function CommitteesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const selectedModule = useAuthStore((s) => s.selectedModule);
  const canManage = user?.role === 'ADMIN' || user?.role === 'HOD';

  const { data, isLoading } = useQuery<{ data: Committee[] }>({
    queryKey: ['committees', selectedModule],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '100' });
      if (selectedModule) params.set('module', selectedModule);
      return api.get(`/committees?${params}`);
    },
  });
  const committees = data?.data ?? [];

  const { data: stats } = useQuery<CommitteeStats>({
    queryKey: ['committee-stats', selectedModule],
    queryFn: () => api.get(`/committees/stats${selectedModule ? `?module=${selectedModule}` : ''}`),
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between flex-wrap gap-4"
      >
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100">Committees</h1>
          <p className="text-slate-500 text-sm mt-1">
            Constitution, members, meetings and action plans
          </p>
        </div>
        {canManage && (
          <Link
            href="/committees/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-teal hover:bg-brand-teal-dark hover:shadow-lg hover:shadow-brand-teal/20 hover:scale-[1.02] transition-all"
          >
            <Plus className="w-4 h-4" />
            New Committee
          </Link>
        )}
      </motion.div>

      {/* Dashboard widgets (FRS §10) */}
      {stats && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile icon={Landmark} label="Total committees" value={stats.overview.totalCommittees} />
            <StatTile icon={CheckCircle2} label="Active" value={stats.overview.activeCommittees} tone="success" />
            <StatTile icon={CalendarClock} label="Upcoming meetings" value={stats.overview.upcomingMeetings} />
            <StatTile icon={Clock} label="Expired" value={stats.overview.expiredCommittees} tone={stats.overview.expiredCommittees ? 'danger' : 'default'} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <StatTile icon={CalendarDays} label="Meetings conducted" value={stats.meetings.conducted} />
            <StatTile icon={CalendarDays} label="Meetings pending" value={stats.meetings.pending} />
            <StatTile icon={ListTodo} label="Open actions" value={stats.actions.open} />
            <StatTile icon={AlertTriangle} label="Overdue actions" value={stats.actions.overdue} tone={stats.actions.overdue ? 'danger' : 'default'} />
            <StatTile icon={CheckCircle2} label="Closed actions" value={stats.actions.closed} tone="success" />
            <StatTile icon={Percent} label="Attendance" value={`${stats.attendance.percentage}%`} />
          </div>
          {stats.actions.departmentWise.length > 0 && (
            <div className="rounded-2xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <p className="text-[0.7rem] font-bold text-slate-500 uppercase tracking-widest mb-3">Department-wise actions</p>
              <div className="flex flex-wrap gap-2">
                {stats.actions.departmentWise.map((d) => (
                  <span key={d.department} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-400 bg-white/5 border border-white/8">
                    {d.department}
                    <span className="font-bold text-slate-200">{d.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl p-5 animate-pulse space-y-3"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
              >
                <div className="h-4 w-32 rounded bg-white/5" />
                <div className="h-3 w-24 rounded bg-white/5" />
                <div className="h-8 w-full rounded bg-white/5" />
              </div>
            ))
          : committees.map((c, i) => (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => router.push(`/committees/${c.id}`)}
                className="text-left block rounded-2xl p-5 group hover:border-brand-teal/30 transition-all duration-200 w-full"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-teal/10 border border-brand-teal/20 flex items-center justify-center">
                    <Landmark className="w-5 h-5 text-brand-teal" />
                  </div>
                  <Badge variant={STATUS_VARIANT[c.status] ?? 'secondary'}>{c.status}</Badge>
                </div>

                <h3 className="text-sm font-bold text-slate-200 group-hover:text-brand-teal transition-colors mb-1">
                  {c.name}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-1">
                  {[c.category, c.type].filter(Boolean).join(' · ') || 'No category'}
                </p>

                <div className="mt-4 pt-3 border-t border-white/6 flex items-center justify-between text-xs text-slate-600">
                  <span className="flex items-center gap-1.5"><Users className="w-3 h-3" />{c._count.members}</span>
                  <span className="flex items-center gap-1.5"><CalendarDays className="w-3 h-3" />{c._count.meetings}</span>
                  <ChevronRight className="w-4 h-4 group-hover:text-brand-teal transition-colors" />
                </div>
              </motion.button>
            ))}
      </div>

      {!isLoading && committees.length === 0 && (
        <div className="text-center py-16">
          <Landmark className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No committees yet</p>
          {canManage && (
            <Link href="/committees/new" className="text-brand-teal text-sm mt-1 hover:underline">
              Constitute the first committee
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
