'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, CalendarDays, ChevronRight, MapPin, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth.store';
import { formatDate } from '@/lib/utils';

interface Meeting {
  id: string; title: string; scheduledDate: string; time: string | null;
  venue: string | null; mode: string; status: string; isRecurring: boolean;
  _count: { agendaItems: number; attendance: number; actions: number };
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  SCHEDULED: 'default', RESCHEDULED: 'secondary', CANCELLED: 'destructive', COMPLETED: 'secondary',
};

export default function MeetingsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'ADMIN' || user?.role === 'HOD';

  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ['committee-meetings', id],
    queryFn: () => api.get(`/committees/${id}/meetings`),
  });

  // Shares the detail page's cache key; gate scheduling when the committee isn't active.
  const { data: committee } = useQuery<{ status: string }>({
    queryKey: ['committee', id],
    queryFn: () => api.get(`/committees/${id}`),
  });
  const canWrite = canManage && committee?.status === 'ACTIVE';

  return (
    <div className="space-y-6 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/committees/${id}`} className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-100">Meetings</h1>
        </div>
        {canWrite && (
          <Link
            href={`/committees/${id}/meetings/new`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-teal hover:bg-brand-teal-dark hover:shadow-lg hover:shadow-brand-teal/20 transition-all"
          >
            <Plus className="w-4 h-4" /> Schedule
          </Link>
        )}
      </motion.div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-teal" /></div>
      ) : meetings.length === 0 ? (
        <div className="text-center py-16">
          <CalendarDays className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No meetings scheduled</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((m, i) => (
            <motion.button
              key={m.id}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => router.push(`/committees/${id}/meetings/${m.id}`)}
              className="w-full text-left rounded-2xl p-4 flex items-center gap-4 group hover:border-brand-teal/30 transition-all"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
            >
              <div className="w-11 h-11 rounded-xl bg-brand-teal/10 border border-brand-teal/20 flex flex-col items-center justify-center shrink-0">
                <span className="text-[0.6rem] text-brand-teal font-bold leading-none">
                  {String(new Date(m.scheduledDate).getMonth() + 1).padStart(2, '0')}
                </span>
                <span className="text-sm text-slate-100 font-bold leading-none mt-0.5">
                  {String(new Date(m.scheduledDate).getDate()).padStart(2, '0')}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-200 group-hover:text-brand-teal transition-colors truncate">{m.title}</span>
                  {m.isRecurring && <Badge variant="secondary">Recurring</Badge>}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                  <span>{formatDate(m.scheduledDate)}{m.time ? ` · ${m.time}` : ''}</span>
                  {m.venue && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{m.venue}</span>}
                  <span>{m.mode}</span>
                </div>
              </div>
              <Badge variant={STATUS_VARIANT[m.status] ?? 'secondary'}>{m.status}</Badge>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-brand-teal transition-colors" />
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
