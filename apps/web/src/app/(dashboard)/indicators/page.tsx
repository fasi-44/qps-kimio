'use client';

import { useState, useMemo, useEffect, useRef, Fragment, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Gauge, Loader2, Layers, Building2, Save, Check, Plus, X,
  TrendingUp, ChevronDown, SaveAll,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatResult, ragStatus, RAG_COLOR, type Rag } from '@/lib/indicator-compute';
import {
  buildSpec, computeSpec, cleanSamples, filledInputs, stableStringify,
  type IndicatorSpec, type Term,
} from '@/lib/indicator-spec';
import { FormulaView, Fraction, Op, displayLabel, scaleInNumerator } from '@/components/indicator-formula';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type Framework = 'KPI' | 'OUTCOME';
type FormulaType = 'RATIO' | 'MEAN' | 'MEDIAN' | 'CUSTOM';

interface ITemplate {
  id: string; name: string; formulaType: FormulaType; multiplier: number; customExpression: string | null;
  formula: string | null; formulaSpec: IndicatorSpec | null;
  numeratorLabel: string | null; denominatorLabel: string | null; unit: string | null;
  frequency: string | null; sourceOfData: string | null; significance: string | null;
  target: number | null; higherIsBetter: boolean; order: number;
  departmentCode: string | null; departmentName: string | null; isActive: boolean;
  type?: { id: string; name: string; framework: Framework; order: number };
}
interface IEntry {
  id: string; templateId: string; year: number; month: number;
  numeratorValue: number | null; denominatorValue: number | null; sampleValues: number[];
  inputValues: Record<string, number> | null;
  computedResult: number | null; note: string | null;
  enteredBy?: { id: string; name: string } | null;
}
type RowDraft = { values: Record<string, string>; samples: string[]; note: string };

const DEPARTMENTS = [
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
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Most ratio inputs are whole-number counts (patients, beds, days, cases…) and
// must NOT take decimals. A few are genuinely decimal — money/amounts, hours,
// minutes/time — detected from the label so those stay decimal.
const DECIMAL_HINT = /amount|money|inr|rupee|₹|expenditure|fund|grant|hour|minute|\btime\b/i;
const allowsDecimal = (label: string | null | undefined) => DECIMAL_HINT.test(label || '');

// ─── Draft <-> entry helpers (spec-driven) ───────────────────────────────────

function emptyDraft(): RowDraft { return { values: {}, samples: [''], note: '' }; }

/** Values already stored for an entry, keyed by the spec's input variables. */
function entryInputs(spec: IndicatorSpec, e?: IEntry): Record<string, number> {
  if (!e) return {};
  if (e.inputValues && typeof e.inputValues === 'object') {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(e.inputValues)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    return out;
  }
  // Legacy fallback for entries saved before per-variable inputs existed.
  const out: Record<string, number> = {};
  if (spec.mode === 'value' && e.numeratorValue != null) out[spec.key] = e.numeratorValue;
  else if (spec.mode === 'ratio') {
    const nIn = spec.numerator.filter((t) => t.kind === 'input');
    const dIn = spec.denominator.filter((t) => t.kind === 'input');
    if (nIn.length === 1 && e.numeratorValue != null) out[(nIn[0] as { key: string }).key] = e.numeratorValue;
    if (dIn.length === 1 && e.denominatorValue != null) out[(dIn[0] as { key: string }).key] = e.denominatorValue;
  }
  return out;
}

function draftFromEntry(t: ITemplate, e?: IEntry): RowDraft {
  const spec = buildSpec(t);
  const iv = entryInputs(spec, e);
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(iv)) values[k] = String(v);
  return { values, samples: e?.sampleValues?.length ? e.sampleValues.map(String) : [''], note: e?.note ?? '' };
}

function draftResult(t: ITemplate, d: RowDraft): number | null {
  return computeSpec(buildSpec(t), d.values, d.samples).result;
}
function hasValidInput(t: ITemplate, d: RowDraft): boolean {
  return draftResult(t, d) != null;
}
function sameNums(a: number[], b: number[]): boolean { return JSON.stringify(a) === JSON.stringify(b); }

function isDirty(t: ITemplate, d: RowDraft, e?: IEntry): boolean {
  const spec = buildSpec(t);
  const noteDirty = (d.note || '') !== (e?.note ?? '');
  if (spec.mode === 'list') return !sameNums(cleanSamples(d.samples), e?.sampleValues ?? []) || noteDirty;
  return stableStringify(filledInputs(spec, d.values)) !== stableStringify(entryInputs(spec, e)) || noteDirty;
}

function entryPayload(t: ITemplate, d: RowDraft, year: number, month: number) {
  const spec = buildSpec(t);
  const r = computeSpec(spec, d.values, d.samples);
  const iv = filledInputs(spec, d.values);
  return {
    templateId: t.id, year, month,
    numeratorValue: spec.mode === 'list' ? undefined : r.numeratorValue,
    denominatorValue: spec.mode === 'ratio' ? r.denominatorValue : undefined,
    sampleValues: spec.mode === 'list' ? cleanSamples(d.samples) : undefined,
    inputValues: spec.mode === 'list' || !Object.keys(iv).length ? undefined : iv,
    note: d.note || undefined,
  };
}

/** Enter advances focus to the next indicator input — fast keyboard data entry. */
function focusNextInput(e: ReactKeyboardEvent<HTMLInputElement>) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('[data-ind-input]'));
  const idx = inputs.indexOf(e.currentTarget);
  const next = inputs[idx + 1];
  if (next) next.focus();
  else e.currentTarget.blur();
}

export default function IndicatorsPage() {
  const qc = useQueryClient();
  const now = useMemo(() => new Date(), []);
  const [framework, setFramework] = useState<Framework>('KPI');
  const [departmentCode, setDepartmentCode] = useState<string>('emergency');
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const YEARS = useMemo(() => { const y = now.getFullYear(); return [y - 2, y - 1, y, y + 1]; }, [now]);

  const deptParam = framework === 'OUTCOME' ? departmentCode : undefined;
  const ctxKey = `${framework}|${deptParam ?? ''}|${year}|${month}`;

  const { data: templates = [], isLoading: tplLoading } = useQuery<ITemplate[]>({
    queryKey: ['ind-templates', framework, deptParam],
    queryFn: () => api.get(`/indicators/templates?active=true&framework=${framework}${deptParam ? `&departmentCode=${deptParam}` : ''}`),
  });
  const { data: entries = [], isLoading: entriesLoading } = useQuery<IEntry[]>({
    queryKey: ['ind-entries', framework, deptParam, year, month],
    queryFn: () => api.get(`/indicators/entries?framework=${framework}${deptParam ? `&departmentCode=${deptParam}` : ''}&year=${year}&month=${month}`),
  });
  const entryByTpl = useMemo(() => {
    const m = new Map<string, IEntry>();
    for (const e of entries) m.set(e.templateId, e);
    return m;
  }, [entries]);

  // Editable draft, keyed by templateId. Rebuilt once per selection (when data
  // has loaded) so in-progress edits survive entry refetches after a save.
  const [draft, setDraft] = useState<Record<string, RowDraft>>({});
  const loadedRef = useRef<string>('');
  useEffect(() => {
    if (loadedRef.current === ctxKey) return;
    if (tplLoading || entriesLoading) return;
    const d: Record<string, RowDraft> = {};
    for (const t of templates) d[t.id] = draftFromEntry(t, entryByTpl.get(t.id));
    setDraft(d);
    loadedRef.current = ctxKey;
  }, [ctxKey, tplLoading, entriesLoading, templates, entryByTpl]);

  const setRow = (id: string, patch: Partial<RowDraft>) =>
    setDraft((p) => ({ ...p, [id]: { ...(p[id] ?? emptyDraft()), ...patch } }));

  const total = templates.length;
  const recorded = useMemo(() => templates.filter((t) => entryByTpl.has(t.id)).length, [templates, entryByTpl]);
  const pct = total ? Math.round((recorded / total) * 100) : 0;
  const dirtyRows = useMemo(
    () => templates.filter((t) => {
      const d = draft[t.id]; if (!d) return false;
      return isDirty(t, d, entryByTpl.get(t.id)) && hasValidInput(t, d);
    }),
    [templates, draft, entryByTpl],
  );

  const invalidateEntries = () =>
    qc.invalidateQueries({ queryKey: ['ind-entries', framework, deptParam, year, month] });

  const saveAll = useMutation({
    mutationFn: () => api.post('/indicators/entries/bulk', {
      entries: dirtyRows.map((t) => entryPayload(t, draft[t.id], year, month)),
    }),
    onSuccess: (res: any) => { toast.success('Saved', `${res?.count ?? dirtyRows.length} indicator(s) updated`); invalidateEntries(); },
    onError: (e) => toast.error('Failed to save all', e instanceof ApiError ? e.message : undefined),
  });

  const dirtyCount = dirtyRows.length;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirtyCount && !saveAll.isPending) saveAll.mutate();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirtyCount, saveAll.isPending]);

  // Types by type.order, indicators within a Type by template.order.
  const grouped = useMemo(() => {
    const map = new Map<string, { typeName: string; typeOrder: number; items: ITemplate[] }>();
    for (const t of templates) {
      const key = t.type?.id ?? 'untyped';
      const g = map.get(key) ?? { typeName: t.type?.name ?? 'Other', typeOrder: t.type?.order ?? 9999, items: [] };
      g.items.push(t);
      map.set(key, g);
    }
    const groups = Array.from(map.values());
    for (const g of groups) g.items.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    groups.sort((a, b) => a.typeOrder - b.typeOrder || a.typeName.localeCompare(b.typeName));
    return groups;
  }, [templates]);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-brand-teal/10 border border-brand-teal/20">
          <Gauge className="w-5 h-5 text-brand-teal" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-100">Quality Indicators</h1>
          <p className="text-slate-400 text-sm mt-0.5">Enter each value in the formula — the result is calculated automatically</p>
        </div>
      </motion.div>

      {/* RAG legend + keyboard hint */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.68rem] text-slate-500 -mt-2">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: RAG_COLOR.green }} /> Meets target</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: RAG_COLOR.amber }} /> Near target</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: RAG_COLOR.red }} /> Misses target</span>
        <span className="hidden sm:inline text-slate-600">·</span>
        <span className="hidden sm:inline">Press <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 text-slate-400 font-mono text-[0.62rem]">Enter</kbd> for next field, <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 text-slate-400 font-mono text-[0.62rem]">Ctrl/⌘ S</kbd> to save all</span>
      </div>

      {/* Sticky toolbar */}
      <div className="sticky top-0 z-20 rounded-2xl p-3 flex items-center gap-3 flex-wrap" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
        <div className="flex items-center gap-0.5 rounded-xl bg-white/5 border border-white/8 p-0.5">
          {(['KPI', 'OUTCOME'] as Framework[]).map((f) => (
            <button key={f} onClick={() => setFramework(f)} className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all', framework === f ? 'bg-brand-teal text-white' : 'text-slate-400 hover:text-slate-200')}>
              <Layers className="w-3.5 h-3.5" />
              {f === 'KPI' ? 'KPI' : 'Outcome'}
            </button>
          ))}
        </div>
        {framework === 'OUTCOME' && (
          <div className="w-56">
            <Select value={departmentCode} onValueChange={setDepartmentCode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div className="w-36">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-28">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {total > 0 && (
            <>
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-300 tabular-nums">{recorded} / {total} recorded</div>
                <div className="text-[0.65rem] text-slate-500">{MONTHS[month - 1]} {year}</div>
              </div>
              <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: pct === 100 ? '#10B981' : 'var(--color-brand-teal)' }} />
              </div>
            </>
          )}
          <button
            onClick={() => saveAll.mutate()}
            disabled={!dirtyRows.length || saveAll.isPending}
            title="Save all (Ctrl/⌘ S)"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-white bg-brand-teal hover:bg-brand-teal-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
          >
            {saveAll.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <SaveAll className="w-4 h-4" />}
            Save all{dirtyRows.length ? ` (${dirtyRows.length})` : ''}
          </button>
        </div>
      </div>

      {/* List */}
      {tplLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl p-4 animate-pulse" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <div className="h-3.5 w-56 rounded bg-white/[0.08]" />
              <div className="mt-3 grid lg:grid-cols-2 gap-3">
                <div className="h-24 rounded-xl bg-white/[0.05]" />
                <div className="h-24 rounded-xl bg-white/[0.05]" />
              </div>
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl py-16 text-center" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <Gauge className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No active indicators for this selection.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => {
            const gRecorded = g.items.filter((t) => entryByTpl.has(t.id)).length;
            const gComplete = gRecorded === g.items.length;
            return (
            <div key={g.typeName}>
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{g.typeName}</h3>
                <span className="flex items-center gap-1 text-[0.65rem] font-semibold tabular-nums" style={{ color: gComplete ? '#10B981' : 'var(--text-muted)' }}>
                  {gComplete && <Check className="w-3 h-3" />}
                  {gRecorded}/{g.items.length} recorded
                </span>
              </div>
              <div className="space-y-3">
                {g.items.map((t) => (
                  <EntryRow
                    key={t.id}
                    template={t}
                    entry={entryByTpl.get(t.id)}
                    draft={draft[t.id] ?? emptyDraft()}
                    onChange={(patch) => setRow(t.id, patch)}
                    year={year} month={month}
                    framework={framework}
                    onSaved={invalidateEntries}
                  />
                ))}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Inline formula pieces ───────────────────────────────────────────────────

/** An input box (right panel) for a variable, with its label underneath.
 *  `integer` blocks decimals for whole-number counts. */
function TermInput({ term, value, onSet, integer = false }: { term: Extract<Term, { kind: 'input' }>; value: string; onSet: (v: string) => void; integer?: boolean }) {
  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (integer && ['.', ',', 'e', 'E', '-', '+'].includes(e.key)) { e.preventDefault(); return; }
    focusNextInput(e);
  };
  const clean = (raw: string) => (integer ? raw.split('.')[0].replace(/[^\d]/g, '') : raw);
  return (
    <div className="flex flex-col items-center gap-1">
      <input
        type="number" inputMode={integer ? 'numeric' : 'decimal'} step={integer ? 1 : 'any'}
        data-ind-input onKeyDown={onKey}
        value={value} onChange={(e) => onSet(clean(e.target.value))} placeholder="0"
        className="w-[5.5rem] px-2 py-1.5 rounded-lg text-sm text-center bg-white/[0.05] border border-white/10 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all"
        style={{ color: 'var(--text-base)' }}
      />
      <span title={term.label} className="text-[0.58rem] text-slate-400 text-center leading-tight max-w-[7.5rem] line-clamp-3">{displayLabel(term)}</span>
    </div>
  );
}

function ResultChip({ result, unit, rag }: { result: number | null; unit: string | null; rag: Rag }) {
  const color = result == null ? 'var(--text-muted)' : rag ? RAG_COLOR[rag] : 'var(--text-base)';
  return (
    <div
      className="px-3 py-2 rounded-xl text-center min-w-[4.5rem]"
      style={{
        background: result == null ? 'var(--inner-bg)' : rag ? `${RAG_COLOR[rag]}1a` : 'rgba(14,165,233,0.10)',
        border: `1px solid ${result == null ? 'var(--inner-border)' : rag ? `${RAG_COLOR[rag]}55` : 'rgba(14,165,233,0.25)'}`,
      }}
    >
      <div className="text-lg font-extrabold tabular-nums leading-tight" style={{ color }}>{formatResult(result, unit)}</div>
    </div>
  );
}

const termsRow = (terms: Term[], render: (t: Term, i: number) => React.ReactNode) =>
  terms.map((t, i) => <Fragment key={i}>{i > 0 && <Op>×</Op>}{render(t, i)}</Fragment>);

// ─── One indicator's entry row (formula ◂▸ calculator) ───────────────────────

function EntryRow({
  template, entry, draft, onChange, year, month, framework, onSaved,
}: {
  template: ITemplate; entry?: IEntry; draft: RowDraft; onChange: (patch: Partial<RowDraft>) => void;
  year: number; month: number; framework: Framework; onSaved: () => void;
}) {
  const spec = useMemo(() => buildSpec(template), [template]);
  // Draw the ×scale exactly where the source PDF places it (numerator vs whole ratio).
  const scaleInNum = scaleInNumerator(template.formula, spec.mode === 'ratio' ? spec.scale : 1);
  const [showTrend, setShowTrend] = useState(false);
  const result = draftResult(template, draft);
  const rag = ragStatus(result, template.target, template.higherIsBetter);
  const dirty = isDirty(template, draft, entry) && hasValidInput(template, draft);
  const canSave = hasValidInput(template, draft);

  const setVal = (key: string, v: string) => onChange({ values: { ...draft.values, [key]: v } });

  const save = useMutation({
    mutationFn: () => api.post('/indicators/entries', entryPayload(template, draft, year, month)),
    onSuccess: () => {
      toast.success('Saved', `${template.name} — ${result == null ? 'no result' : formatResult(result, template.unit)}`);
      onSaved();
    },
    onError: (e) => toast.error('Failed to save', e instanceof ApiError ? e.message : undefined),
  });

  return (
    <div className={cn('rounded-2xl p-4 transition-colors', dirty ? 'ring-1 ring-brand-teal/30' : '')} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-[0.95rem] font-bold text-slate-100 leading-tight">{template.name}</span>
          {entry && !dirty && <Badge variant="success">Recorded</Badge>}
          {dirty && <Badge variant="warning">Unsaved</Badge>}
          {framework === 'OUTCOME' && template.departmentName && (
            <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
              <Building2 className="w-3 h-3" />{template.departmentName}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowTrend((v) => !v)} title="Trend"
          className={cn('flex items-center gap-1 p-1.5 rounded-lg transition-all shrink-0', showTrend ? 'text-brand-teal bg-brand-teal/10' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]')}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <ChevronDown className={cn('w-3 h-3 transition-transform', showTrend && 'rotate-180')} />
        </button>
      </div>

      {/* Two panels: formula (left) ◂▸ calculator (right) */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2 items-stretch">
        {/* LEFT — the formula (as a fraction) */}
        <div title={template.formula ?? undefined} className="rounded-xl p-3.5 flex flex-col h-full min-w-0" style={{ background: 'var(--inner-bg)', border: '1px solid var(--inner-border)' }}>
          <div className="text-[0.56rem] uppercase tracking-widest font-bold text-slate-500 mb-2.5">Formula</div>
          <div className="flex-1 flex items-center min-w-0">
            <FormulaView spec={spec} unit={template.unit} scaleInNum={scaleInNum} />
          </div>
        </div>

        {/* RIGHT — the calculator */}
        <div className="rounded-xl p-3.5 flex flex-col justify-center h-full min-w-0" style={{ background: 'var(--inner-bg)', border: '1px solid var(--inner-border)' }}>
          <div className="text-[0.56rem] uppercase tracking-widest font-bold text-slate-500 mb-2.5">Enter values &amp; calculate</div>
          <div className="overflow-x-auto">
            <Calculator spec={spec} values={draft.values} samples={draft.samples} result={result} unit={template.unit} rag={rag}
              onSet={setVal} onSamples={(samples) => onChange({ samples })} scaleInNum={scaleInNum}
              valueInteger={spec.mode === 'value' && !allowsDecimal(template.name) && !allowsDecimal(template.formula)} />
          </div>
          {template.target != null && (
            <div className="flex items-center gap-1.5 mt-3">
              {rag && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: RAG_COLOR[rag] }} />}
              <span className="text-[0.62rem] text-slate-500 tabular-nums">
                Target {template.higherIsBetter ? '≥' : '≤'} {formatResult(template.target, template.unit)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer: note + save */}
      <div className="mt-3 flex items-center gap-3">
        <input value={draft.note} onChange={(e) => onChange({ note: e.target.value })} placeholder="Note (optional)"
          className="flex-1 px-3 py-2 rounded-xl text-sm bg-white/[0.04] border border-white/8 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all"
          style={{ color: 'var(--text-base)' }} />
        <button
          onClick={() => save.mutate()}
          disabled={!canSave || save.isPending || !dirty}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-brand-teal bg-brand-teal/10 border border-brand-teal/25 hover:bg-brand-teal/20 transition-all shrink-0 disabled:bg-white/[0.03] disabled:text-slate-500 disabled:border-white/8 disabled:cursor-not-allowed"
        >
          {save.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : entry ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {entry ? 'Update' : 'Save'}
        </button>
      </div>

      {/* Trend */}
      <AnimatePresence>
        {showTrend && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <TrendPanel templateId={template.id} unit={template.unit} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Right: the formula with input boxes + live result ───────────────────────

function Calculator({
  spec, values, samples, result, unit, rag, onSet, onSamples, valueInteger = false, scaleInNum = false,
}: {
  spec: IndicatorSpec; values: Record<string, string>; samples: string[];
  result: number | null; unit: string | null; rag: Rag;
  onSet: (key: string, v: string) => void; onSamples: (s: string[]) => void;
  valueInteger?: boolean; scaleInNum?: boolean;
}) {
  if (spec.mode === 'list') {
    return (
      <div>
        <div className="flex flex-wrap gap-2 items-center">
          {samples.map((s, i) => (
            <div key={i} className="relative">
              <input
                type="number" inputMode="decimal" value={s} placeholder={`#${i + 1}`} data-ind-input onKeyDown={focusNextInput}
                onChange={(e) => onSamples(samples.map((x, j) => (j === i ? e.target.value : x)))}
                className="w-[4.5rem] px-2 py-1.5 pr-6 rounded-lg text-sm text-center bg-white/[0.05] border border-white/10 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50"
                style={{ color: 'var(--text-base)' }}
              />
              {samples.length > 1 && (
                <button onClick={() => onSamples(samples.filter((_, j) => j !== i))} className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-500 hover:text-red-400"><X className="w-3 h-3" /></button>
              )}
            </div>
          ))}
          <button onClick={() => onSamples([...samples, ''])} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-brand-teal bg-brand-teal/10 border border-brand-teal/20 hover:bg-brand-teal/20 transition-all">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        <div className="flex items-center gap-2.5 mt-3">
          <span className="text-[0.7rem] text-slate-500">{cleanSamples(samples).length} value(s) · {spec.stat === 'MEAN' ? 'mean' : 'median'}</span>
          <span className="text-slate-500 text-xl font-light ml-auto">=</span>
          <ResultChip result={result} unit={unit} rag={rag} />
        </div>
      </div>
    );
  }

  if (spec.mode === 'value') {
    return (
      <div className="flex items-center gap-2.5 flex-wrap">
        <TermInput term={{ kind: 'input', key: spec.key, label: spec.label }} value={values[spec.key] ?? ''} onSet={(v) => onSet(spec.key, v)} integer={valueInteger} />
        <span className="text-slate-500 text-xl font-light">=</span>
        <ResultChip result={result} unit={unit} rag={rag} />
      </div>
    );
  }

  // ×scale is drawn where the PDF puts it: inside the numerator (scaleInNum) for
  // "(bed days ×100/beds×days)", or on the whole ratio for "(falls/days)×1000".
  const top = (
    <>
      {termsRow(spec.numerator, (t) => t.kind === 'input'
        ? <TermInput term={t} value={values[t.key] ?? ''} onSet={(v) => onSet(t.key, v)} integer={!allowsDecimal(t.label)} />
        : <span className="text-base font-bold text-slate-300 self-center px-1 pb-4">{t.value}</span>)}
      {scaleInNum && spec.scale !== 1 && <span className="text-base font-bold text-slate-300 self-center px-1 pb-4">× {spec.scale}</span>}
    </>
  );
  const bottom = spec.denominator.length
    ? termsRow(spec.denominator, (t) => t.kind === 'input'
        ? <TermInput term={t} value={values[t.key] ?? ''} onSet={(v) => onSet(t.key, v)} integer={!allowsDecimal(t.label)} />
        : <span className="text-base font-bold text-slate-300 self-center px-1">{t.value}</span>)
    : undefined;

  const scaleOutside = !scaleInNum && spec.scale !== 1;

  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      {scaleOutside ? (
        // "(numerator / denominator) × scale" — parenthesised like the PDF so the
        // ×scale reads as applied to the whole ratio, never to the denominator.
        <span className="inline-flex items-center gap-1.5">
          <span className="text-slate-500 font-thin" style={{ fontSize: '3em', lineHeight: 0.7 }}>(</span>
          <Fraction top={top} bottom={bottom} />
          <span className="text-slate-500 font-thin" style={{ fontSize: '3em', lineHeight: 0.7 }}>)</span>
          <span className="text-slate-400 font-semibold text-sm whitespace-nowrap self-center">× {spec.scale}</span>
        </span>
      ) : (
        <Fraction top={top} bottom={bottom} />
      )}
      <span className="text-slate-500 text-xl font-light self-center">=</span>
      <div className="self-center"><ResultChip result={result} unit={unit} rag={rag} /></div>
    </div>
  );
}

// ─── Trend sparkline ─────────────────────────────────────────────────────────

function TrendPanel({ templateId, unit }: { templateId: string; unit: string | null }) {
  const { data: history = [], isLoading } = useQuery<IEntry[]>({
    queryKey: ['ind-history', templateId],
    queryFn: () => api.get(`/indicators/templates/${templateId}/history`),
  });
  const points = useMemo(
    () => [...history].reverse().filter((e) => e.computedResult != null).slice(-12),
    [history],
  );

  if (isLoading) return <div className="mt-3 pt-3 border-t border-white/6 text-xs text-slate-600">Loading trend…</div>;
  if (points.length === 0) return <div className="mt-3 pt-3 border-t border-white/6 text-xs text-slate-600">No history yet — saved months will appear here.</div>;

  const vals = points.map((p) => p.computedResult as number);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const W = 460, H = 48, pad = 4;
  const x = (i: number) => points.length === 1 ? W / 2 : pad + (i * (W - pad * 2)) / (points.length - 1);
  const y = (v: number) => H - pad - ((v - min) / range) * (H - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.computedResult as number).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <div className="mt-3 pt-3 border-t border-white/6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.7rem] font-bold uppercase tracking-widest text-slate-500">Trend · last {points.length} month(s)</span>
        <span className="text-xs font-bold text-brand-teal tabular-nums">{formatResult(last.computedResult, unit)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 48 }} preserveAspectRatio="none">
        <path d={path} fill="none" stroke="#00B4FF" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={p.id} cx={x(i)} cy={y(p.computedResult as number)} r={2} fill="#00B4FF" />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {points.map((p) => (
          <span key={p.id} className="text-[0.66rem] text-slate-500 tabular-nums">
            <span className="text-slate-600">{MON3[p.month - 1]} {String(p.year).slice(2)}:</span>{' '}
            <span className="text-slate-300 font-semibold">{formatResult(p.computedResult, unit)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
