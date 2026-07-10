'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { Plus, ChevronRight, CalendarDays, Building2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Badge } from '@/components/ui/badge';

interface AssessmentCycle {
  id: string;
  name: string;
  quarter: string;
  year: number;
  type: string;
  module: string;
  startDate: string;
  endDate: string;
  _count: { assessments: number };
}

export default function AssessmentsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const selectedModule = useAuthStore((s) => s.selectedModule);

  const { data: cycles = [], isLoading } = useQuery<AssessmentCycle[]>({
    queryKey: ['assessment-cycles', selectedModule],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedModule) params.set('module', selectedModule);
      return api.get(`/institution-assessments?${params}`);
    },
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between flex-wrap gap-4"
      >
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100">Assessments</h1>
          <p className="text-slate-500 text-sm mt-1">
            Select an assessment cycle to view department assessments
          </p>
        </div>
        {user?.role === 'ADMIN' && (
          <Link
            href="/assessment-cycles/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-teal hover:bg-brand-teal-dark hover:shadow-lg hover:shadow-brand-teal/20 hover:scale-[1.02] transition-all"
          >
            <Plus className="w-4 h-4" />
            New Cycle
          </Link>
        )}
      </motion.div>

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
          : cycles.map((cycle, i) => (
              <motion.button
                key={cycle.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                onClick={() => router.push(`/assessment-cycles/${cycle.id}`)}
                className="text-left block rounded-2xl p-5 group hover:border-brand-teal/30 transition-all duration-200 w-full"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-teal/10 border border-brand-teal/20 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-brand-teal" />
                  </div>
                  <Badge variant={cycle.type === 'EXTERNAL' ? 'default' : 'secondary'}>
                    {cycle.type}
                  </Badge>
                </div>

                <h3 className="text-sm font-bold text-slate-200 group-hover:text-brand-teal transition-colors mb-1">
                  {cycle.name}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <CalendarDays className="w-3 h-3" />
                  {cycle.quarter} {cycle.year}
                </div>

                <div className="mt-4 pt-3 border-t border-white/6 flex items-center justify-between">
                  <span className="text-xs text-slate-600">
                    {cycle._count.assessments} dept{cycle._count.assessments !== 1 ? 's' : ''} assessed
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-brand-teal transition-colors" />
                </div>
              </motion.button>
            ))}
      </div>

      {!isLoading && cycles.length === 0 && (
        <div className="text-center py-16">
          <Building2 className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No assessment cycles yet</p>
          {user?.role === 'ADMIN' && (
            <Link href="/assessment-cycles/new" className="text-brand-teal text-sm mt-1 hover:underline">
              Create the first cycle
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
