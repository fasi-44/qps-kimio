'use client';

import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, TrendingUp, Gauge, Layers, ArrowUp, ArrowDown, Minus,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';
import { formatResult, describeFormula, ragStatus, RAG_COLOR } from '@/lib/indicator-compute';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface QuarterlyTrend {
  quarter: string;
  year: number;
  avgCompliance: number;
  totalAssessments: number;
}

interface DeptBreakdown {
  department: string;
  code: string;
  latestPct: number;
  trend: number;
  assessmentCount: number;
}

function scoreColor(pct: number) {
  if (pct >= 80) return '#22C55E';
  if (pct >= 60) return '#F59E0B';
  if (pct >= 40) return '#F97316';
  return '#EF4444';
}

export default function ReportsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  const { data: trends = [], isLoading: trendsLoading } = useQuery<QuarterlyTrend[]>({
    queryKey: ['quarterly-trends'],
    queryFn: () => api.get('/dashboard/quarterly-trends'),
  });

  const { data: deptBreakdown = [], isLoading: deptLoading } = useQuery<DeptBreakdown[]>({
    queryKey: ['dept-breakdown'],
    queryFn: () => api.get('/dashboard/department-scores'),
  });

  const maxBar = Math.max(...trends.map((t) => t.avgCompliance), 1);

  return (
    <div className="space-y-6 max-w-6xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-extrabold text-slate-100">Reports & Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">Quarterly trends and department compliance breakdown</p>
      </motion.div>

      {/* Quarterly trend chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl p-6"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-teal" />
              Quarterly Compliance Trend
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">Average across all departments</p>
          </div>
        </div>

        {trendsLoading ? (
          <div className="flex items-end gap-3 h-40">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-1 rounded-t-lg animate-pulse" style={{ height: `${30 + i * 10}%`, background: 'rgba(255,255,255,0.05)' }} />
            ))}
          </div>
        ) : trends.length ? (
          <div className="flex items-end gap-3 h-44 mt-2">
            {trends.map((t, i) => {
              const height = (t.avgCompliance / 100) * 100;
              const color = scoreColor(t.avgCompliance);
              return (
                <motion.div
                  key={`${t.year}-${t.quarter}`}
                  className="flex-1 flex flex-col items-center gap-1"
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  transition={{ delay: i * 0.07, duration: 0.5, ease: 'easeOut' }}
                  style={{ transformOrigin: 'bottom' }}
                >
                  <span className="text-xs font-bold tabular-nums" style={{ color }}>{t.avgCompliance.toFixed(0)}%</span>
                  <div className="w-full rounded-t-lg" style={{ height: `${Math.max(height, 4)}%`, background: `${color}30`, border: `1px solid ${color}50` }} />
                  <span className="text-[0.65rem] text-slate-500 text-center leading-tight">{t.quarter}<br/>{t.year}</span>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="h-44 flex items-center justify-center">
            <p className="text-slate-600 text-sm">No trend data available yet</p>
          </div>
        )}
      </motion.div>

      {/* Department breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
      >
        <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-teal" />
            Department Compliance
          </h2>
          <span className="text-xs text-slate-600">Latest assessment scores</span>
        </div>

        <div className="p-5 space-y-3">
          {deptLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-36 h-3 rounded bg-white/5 animate-pulse" />
                <div className="flex-1 h-2 rounded-full bg-white/5 animate-pulse" />
                <div className="w-12 h-3 rounded bg-white/5 animate-pulse" />
              </div>
            ))
          ) : deptBreakdown.length ? (
            deptBreakdown.map((dept, i) => (
              <motion.div
                key={dept.code}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-4"
              >
                <div className="w-44 shrink-0">
                  <p className="text-xs font-medium text-slate-400 truncate">{dept.department}</p>
                  <p className="text-[0.65rem] text-slate-400 font-mono">{dept.code}</p>
                </div>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--inner-border)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${dept.latestPct}%` }}
                    transition={{ delay: 0.3 + i * 0.04, duration: 0.7, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ background: scoreColor(dept.latestPct) }}
                  />
                </div>
                <div className="w-16 text-right shrink-0">
                  <span className="text-sm font-bold tabular-nums" style={{ color: scoreColor(dept.latestPct) }}>
                    {dept.latestPct.toFixed(1)}%
                  </span>
                </div>
                <div className="w-8 text-right shrink-0">
                  <span className={cn('text-xs font-semibold', dept.trend >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {dept.trend >= 0 ? '+' : ''}{dept.trend.toFixed(1)}
                  </span>
                </div>
              </motion.div>
            ))
          ) : (
            <p className="text-center text-slate-600 text-sm py-6">No department data available</p>
          )}
        </div>
      </motion.div>

      {/* KPI / Outcome indicators dashboard (Admin / Super Admin) */}
      {isAdmin && <KpiDashboardSection />}
    </div>
  );
}

// ─── KPI / Outcome indicators dashboard ──────────────────────────────────────

type Framework = 'KPI' | 'OUTCOME';
interface DashTemplate {
  id: string; name: string; unit: string | null; formulaType: string; multiplier: number;
  target: number | null; higherIsBetter: boolean; order: number;
  type?: { id: string; name: string; order: number };
}
interface DashEntry { id: string; templateId: string; year: number; month: number; computedResult: number | null; }

const DASH_DEPARTMENTS = [
  { code: 'emergency', name: 'Emergency Department' },
  { code: 'opd', name: 'Out Patient Department' },
  { code: 'paed_ward', name: 'Paediatric Ward' },
  { code: 'lab', name: 'Laboratory' },
  { code: 'ot', name: 'Operation Theatre' },
  { code: 'icu', name: 'Intensive Care Unit' },
  { code: 'ipd', name: 'Indoor Patient Department' },
  { code: 'blood_bank', name: 'Blood Bank' },
  { code: 'radiology', name: 'Radiology' },
  { code: 'pharmacy', name: 'Pharmacy' },
  { code: 'auxiliary', name: 'Auxiliary Services' },
  { code: 'mortuary', name: 'Mortuary' },
  { code: 'admin', name: 'General Administration' },
  { code: 'nuclear_medicine', name: 'Nuclear Medicine Department' },
];
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="h-8 w-24" />;
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const W = 96, H = 32, pad = 3;
  const pts = values.map((v, i) => {
    const x = pad + (i * (W - pad * 2)) / (values.length - 1);
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-24 h-8" preserveAspectRatio="none">
      <polyline points={pts.join(' ')} fill="none" stroke="#00B4FF" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function KpiDashboardSection() {
  const [framework, setFramework] = useState<Framework>('KPI');
  const [dept, setDept] = useState('emergency');
  const deptParam = framework === 'OUTCOME' ? dept : undefined;

  const { data: templates = [], isLoading: tplLoading } = useQuery<DashTemplate[]>({
    queryKey: ['dash-ind-tpl', framework, deptParam],
    queryFn: () => api.get(`/indicators/templates?active=true&framework=${framework}${deptParam ? `&departmentCode=${deptParam}` : ''}`),
  });
  const { data: entries = [] } = useQuery<DashEntry[]>({
    queryKey: ['dash-ind-entries', framework, deptParam],
    queryFn: () => api.get(`/indicators/entries?framework=${framework}${deptParam ? `&departmentCode=${deptParam}` : ''}`),
  });

  const byTpl = useMemo(() => {
    const m = new Map<string, DashEntry[]>();
    for (const e of entries) { const a = m.get(e.templateId) ?? []; a.push(e); m.set(e.templateId, a); }
    for (const a of m.values()) a.sort((x, y) => x.year - y.year || x.month - y.month);
    return m;
  }, [entries]);

  const rows = useMemo(() => templates.map((t) => {
    const hist = (byTpl.get(t.id) ?? []).filter((e) => e.computedResult != null);
    const latest = hist.at(-1);
    const prev = hist.at(-2);
    const delta = latest && prev ? (latest.computedResult! - prev.computedResult!) : null;
    return {
      t, latest, delta,
      rag: ragStatus(latest?.computedResult ?? null, t.target, t.higherIsBetter),
      spark: hist.slice(-6).map((e) => e.computedResult as number),
      typeName: t.type?.name ?? 'Other',
    };
  }), [templates, byTpl]);

  const recorded = rows.filter((r) => r.latest).length;

  // Group by type — Types by type.order, indicators by template.order (same
  // ordering as Indicator Setup and the data-entry screen).
  const grouped = useMemo(() => {
    const m = new Map<string, { typeName: string; typeOrder: number; items: typeof rows }>();
    for (const r of rows) {
      const key = r.t.type?.id ?? 'untyped';
      const g = m.get(key) ?? { typeName: r.typeName, typeOrder: r.t.type?.order ?? 9999, items: [] as typeof rows };
      g.items.push(r);
      m.set(key, g);
    }
    const groups = Array.from(m.values());
    for (const g of groups) g.items.sort((a, b) => a.t.order - b.t.order || a.t.name.localeCompare(b.t.name));
    groups.sort((a, b) => a.typeOrder - b.typeOrder || a.typeName.localeCompare(b.typeName));
    return groups;
  }, [rows]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
      className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
    >
      <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Gauge className="w-4 h-4 text-brand-teal" />
          Quality &amp; Patient Safety — Indicators
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg bg-white/5 border border-white/8 p-0.5">
            {(['KPI', 'OUTCOME'] as Framework[]).map((f) => (
              <button key={f} onClick={() => setFramework(f)} className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all', framework === f ? 'bg-brand-teal text-white' : 'text-slate-400 hover:text-slate-200')}>
                <Layers className="w-3 h-3" />{f === 'KPI' ? 'KPI' : 'Outcome'}
              </button>
            ))}
          </div>
          {framework === 'OUTCOME' && (
            <div className="w-52">
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{DASH_DEPARTMENTS.map((d) => <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {tplLoading ? (
        <div className="p-5 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 animate-pulse">
              <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
              <div className="h-3 flex-1 rounded bg-white/[0.08]" />
              <div className="h-6 w-24 rounded bg-white/[0.05]" />
              <div className="h-4 w-12 rounded bg-white/[0.08]" />
            </div>
          ))}
        </div>
      ) : recorded === 0 ? (
        <div className="px-5 py-10 text-center">
          <Gauge className="w-9 h-9 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No recorded values yet for this selection.</p>
          <p className="text-xs text-slate-600 mt-1">Figures entered under <span className="text-slate-400 font-semibold">Quality Indicators</span> will appear here with trends.</p>
        </div>
      ) : (
        <div className="p-5 space-y-5">
          <p className="text-xs text-slate-600">{recorded} of {templates.length} indicators have recorded data · latest value &amp; month-over-month trend</p>
          {grouped.map(({ typeName, items }) => (
            <div key={typeName}>
              <h3 className="text-[0.7rem] font-bold text-slate-500 uppercase tracking-widest mb-2">{typeName}</h3>
              <div className="space-y-1.5">
                {items.map(({ t, latest, delta, rag, spark }) => (
                  <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.02] transition-colors">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: rag ? RAG_COLOR[rag] : 'rgba(255,255,255,0.14)' }}
                      title={rag ? `${rag.toUpperCase()} vs target ${t.target}` : 'No target set'}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-200 truncate">{t.name}</p>
                      <p className="text-[0.62rem] text-slate-500 font-mono truncate">
                        {describeFormula(t.formulaType, t.multiplier, t.unit)}{t.target != null ? ` · target ${t.target}` : ''}
                      </p>
                    </div>
                    <Sparkline values={spark} />
                    {delta != null && (
                      <div className={cn('flex items-center gap-0.5 text-[0.7rem] font-semibold w-14 justify-end tabular-nums',
                        delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-slate-500')}>
                        {delta > 0 ? <ArrowUp className="w-3 h-3" /> : delta < 0 ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        {Math.abs(delta).toFixed(1)}
                      </div>
                    )}
                    <div className="w-20 text-right shrink-0">
                      <span className="text-sm font-extrabold tabular-nums" style={{ color: rag ? RAG_COLOR[rag] : 'var(--text-base)' }}>{formatResult(latest?.computedResult, t.unit)}</span>
                      {latest && <p className="text-[0.58rem] text-slate-600">{MON3[latest.month - 1]} {latest.year}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
