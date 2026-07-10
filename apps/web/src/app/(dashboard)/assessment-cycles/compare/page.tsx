'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, GitCompare, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

function scoreColor(pct: number) {
  if (pct >= 80) return '#16A34A';
  if (pct >= 60) return '#D97706';
  if (pct >= 40) return '#EA580C';
  return '#DC2626';
}

function TrendIcon({ diff }: { diff: number }) {
  if (diff > 0) return <TrendingUp className="w-3 h-3 text-emerald-500" />;
  if (diff < 0) return <TrendingDown className="w-3 h-3 text-red-500" />;
  return <Minus className="w-3 h-3 text-slate-400" />;
}

export default function CompareAssessmentsPage() {
  const selectedModule = useAuthStore((s) => s.selectedModule);
  const [idA, setIdA] = useState('');
  const [idB, setIdB] = useState('');

  const { data: list = [] } = useQuery<any[]>({
    queryKey: ['institution-assessments', selectedModule],
    queryFn: () => {
      const p = new URLSearchParams();
      if (selectedModule) p.set('module', selectedModule);
      return api.get(`/institution-assessments?${p}`);
    },
  });

  const canCompare = idA && idB && idA !== idB;

  const { data: comparison, isLoading: comparing } = useQuery<any[]>({
    queryKey: ['compare', idA, idB],
    queryFn: () => api.get(`/institution-assessments/compare?ids=${idA},${idB}`),
    enabled: !!canCompare,
  });

  const [reportA, reportB] = comparison ?? [null, null];

  // Collect all areas across both reports
  const allAreas: Record<string, { code: string; name: string; order: number }> = {};
  for (const r of comparison ?? []) {
    for (const a of r.areas ?? []) allAreas[a.code] = a;
  }
  const areas = Object.values(allAreas).sort((a: any, b: any) => a.order - b.order);

  // Build quick-access matrix: reportIdx → areaCode → deptCode → score
  const getAreaAvg = (report: any, areaCode: string) => {
    if (!report) return null;
    let ob = 0; let mx = 0;
    for (const dept of report.departments ?? []) {
      const a = dept.areas?.find((x: any) => x.code === areaCode);
      if (a) { ob += a.obtained; mx += a.max; }
    }
    return mx > 0 ? { obtained: ob, max: mx, pct: Math.round((ob / mx) * 100) } : null;
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <Link
          href="/assessment-cycles"
          className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-all border border-transparent hover:border-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-brand-teal" />
            Compare Assessments
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Select two assessment cycles to compare</p>
        </div>
      </motion.div>

      {/* Selectors */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 gap-4"
      >
        {[
          { label: 'Assessment A (baseline)', value: idA, set: setIdA, other: idB },
          { label: 'Assessment B (compare to)', value: idB, set: setIdB, other: idA },
        ].map(({ label, value, set, other }) => (
          <div
            key={label}
            className="rounded-2xl p-4 space-y-3"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
          >
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
            <Select value={value} onValueChange={set}>
              <SelectTrigger>
                <SelectValue placeholder="Select assessment cycle…" />
              </SelectTrigger>
              <SelectContent>
                {list
                  .filter((ia) => ia.id !== other)
                  .map((ia) => (
                    <SelectItem key={ia.id} value={ia.id}>
                      {ia.name} <span className="text-slate-500 text-xs ml-1">({ia.quarter} {ia.year})</span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </motion.div>

      {/* Comparison results */}
      {comparing && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-brand-teal/30 border-t-brand-teal rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 text-sm mt-3">Comparing assessments…</p>
        </div>
      )}

      {canCompare && reportA && reportB && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

          {/* Programme scores comparison */}
          <div
            className="rounded-2xl p-5"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
          >
            <h2 className="text-sm font-bold text-slate-200 mb-4">Programme Score Comparison</h2>
            <div className="grid grid-cols-3 gap-4">
              {['NQAS', 'LAQSHYA', 'MUSQAN'].map((prog) => {
                const a = reportA.programmeScores?.[prog];
                const b = reportB.programmeScores?.[prog];
                if (!a || !b || (a.deptCount === 0 && b.deptCount === 0)) return null;
                const diff = b.pct - a.pct;
                return (
                  <div key={prog} className="rounded-xl p-4" style={{ background: 'var(--inner-bg)', border: '1px solid var(--inner-border)' }}>
                    <p className="text-xs font-bold text-slate-400 mb-3">{prog === 'NQAS' ? 'Hospital Score' : prog + ' Score'}</p>
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <div className="text-xs text-slate-600 mb-0.5">{reportA.institutionAssessment.name}</div>
                        <div className="text-xl font-black tabular-nums" style={{ color: scoreColor(a.pct) }}>
                          {a.deptCount > 0 ? `${a.pct}%` : '—'}
                        </div>
                      </div>
                      <div className="text-2xl text-slate-600">→</div>
                      <div className="text-right">
                        <div className="text-xs text-slate-600 mb-0.5">{reportB.institutionAssessment.name}</div>
                        <div className="text-xl font-black tabular-nums" style={{ color: scoreColor(b.pct) }}>
                          {b.deptCount > 0 ? `${b.pct}%` : '—'}
                        </div>
                      </div>
                    </div>
                    {a.deptCount > 0 && b.deptCount > 0 && (
                      <div className={cn('flex items-center gap-1 mt-2 text-xs font-semibold', diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-slate-500')}>
                        <TrendIcon diff={diff} />
                        {diff > 0 ? '+' : ''}{diff.toFixed(1)}% change
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Area of Concern comparison */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
          >
            <div className="px-5 py-4 border-b border-white/6">
              <h2 className="text-sm font-bold text-slate-200">Area of Concern — Hospital Totals</h2>
              <p className="text-xs text-slate-600 mt-0.5">Combined scores across all departments</p>
            </div>
            <div className="divide-y divide-white/5">
              {areas.map((area: any) => {
                const a = getAreaAvg(reportA, area.code);
                const b = getAreaAvg(reportB, area.code);
                const diff = (b?.pct ?? 0) - (a?.pct ?? 0);
                return (
                  <div key={area.code} className="px-5 py-3 flex items-center gap-4">
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[0.65rem] font-black shrink-0"
                      style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.25)', color: '#38BDF8' }}
                    >
                      {area.code}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-300 truncate">{area.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {/* Bar A */}
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--inner-border)' }}>
                          <div className="h-full rounded-full opacity-60" style={{ width: `${a?.pct ?? 0}%`, background: scoreColor(a?.pct ?? 0) }} />
                        </div>
                        {/* Bar B */}
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--inner-border)' }}>
                          <div className="h-full rounded-full" style={{ width: `${b?.pct ?? 0}%`, background: scoreColor(b?.pct ?? 0) }} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-bold tabular-nums w-12 text-right opacity-70" style={{ color: scoreColor(a?.pct ?? 0) }}>
                        {a ? `${a.pct}%` : '—'}
                      </span>
                      <span className="text-sm font-bold tabular-nums w-12 text-right" style={{ color: scoreColor(b?.pct ?? 0) }}>
                        {b ? `${b.pct}%` : '—'}
                      </span>
                      <div className={cn('flex items-center gap-1 w-16 justify-end text-xs font-semibold', diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-slate-500')}>
                        <TrendIcon diff={diff} />
                        {diff > 0 ? '+' : ''}{diff !== 0 ? `${diff.toFixed(1)}%` : '—'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="px-5 py-3 border-t border-white/6 flex items-center gap-6 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <div className="w-8 h-1.5 rounded-full opacity-60 bg-slate-400" />
                <span>{reportA.institutionAssessment.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-8 h-1.5 rounded-full bg-brand-teal" />
                <span>{reportB.institutionAssessment.name}</span>
              </div>
            </div>
          </div>

          {/* Department-by-department table */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
          >
            <div className="px-5 py-4 border-b border-white/6">
              <h2 className="text-sm font-bold text-slate-200">Department Compliance — Side by Side</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase tracking-wider" style={{ borderBottom: '1px solid var(--inner-border)' }}>
                      Department
                    </th>
                    <th className="px-3 py-3 text-right font-bold text-slate-400" style={{ borderBottom: '1px solid var(--inner-border)' }}>
                      {reportA.institutionAssessment.name}
                    </th>
                    <th className="px-3 py-3 text-right font-bold text-brand-teal" style={{ borderBottom: '1px solid var(--inner-border)' }}>
                      {reportB.institutionAssessment.name}
                    </th>
                    <th className="px-3 py-3 text-right font-bold text-slate-400" style={{ borderBottom: '1px solid var(--inner-border)' }}>
                      Change
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Merge departments from both reports
                    const deptMap = new Map<string, { name: string; a: number; b: number }>();
                    for (const d of reportA.departments ?? []) {
                      deptMap.set(d.departmentCode, { name: d.departmentName, a: d.compliancePct, b: 0 });
                    }
                    for (const d of reportB.departments ?? []) {
                      const existing = deptMap.get(d.departmentCode);
                      if (existing) existing.b = d.compliancePct;
                      else deptMap.set(d.departmentCode, { name: d.departmentName, a: 0, b: d.compliancePct });
                    }
                    return Array.from(deptMap.entries()).map(([code, row], i) => {
                      const diff = row.b - row.a;
                      return (
                        <tr key={code} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--inner-bg)' }}>
                          <td className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--inner-border)' }}>
                            <div className="font-semibold text-slate-200">{row.name}</div>
                            <div className="text-slate-600 font-mono">{code}</div>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-bold" style={{ borderBottom: '1px solid var(--inner-border)', color: scoreColor(row.a), opacity: 0.7 }}>
                            {row.a > 0 ? `${row.a.toFixed(1)}%` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-bold" style={{ borderBottom: '1px solid var(--inner-border)', color: scoreColor(row.b) }}>
                            {row.b > 0 ? `${row.b.toFixed(1)}%` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right" style={{ borderBottom: '1px solid var(--inner-border)' }}>
                            <div className={cn('flex items-center justify-end gap-1 font-semibold', diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-slate-500')}>
                              <TrendIcon diff={diff} />
                              {row.a > 0 && row.b > 0 ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%` : '—'}
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {canCompare && !comparing && !comparison && (
        <div className="text-center py-8 text-slate-500 text-sm">Select two different assessment cycles above to compare</div>
      )}

      {!canCompare && idA && idB && idA === idB && (
        <div className="text-center py-8 text-amber-400 text-sm">Please select two different assessment cycles</div>
      )}
    </div>
  );
}
