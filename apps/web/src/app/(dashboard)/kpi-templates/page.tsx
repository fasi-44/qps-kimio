'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  SlidersHorizontal, Plus, Loader2, Pencil, Trash2, X, Save, Power,
  FolderPlus, Layers, Calculator, Building2, Search, Download, ShieldAlert,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { confirm } from '@/hooks/use-confirm';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';
import { describeFormula } from '@/lib/indicator-compute';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type Framework = 'KPI' | 'OUTCOME';
type FormulaType = 'RATIO' | 'MEAN' | 'MEDIAN' | 'CUSTOM';

interface IType {
  id: string; framework: Framework; departmentCode: string; departmentName: string | null;
  name: string; description: string | null; order: number; isActive: boolean; _count?: { templates: number };
}
interface ITemplate {
  id: string; typeId: string; name: string;
  numeratorLabel: string | null; denominatorLabel: string | null;
  formulaType: FormulaType; multiplier: number; customExpression: string | null; formula: string | null;
  unit: string | null; frequency: string | null; sourceOfData: string | null; significance: string | null;
  target: number | null; higherIsBetter: boolean;
  scope: 'HOSPITAL' | 'DEPARTMENT'; departmentCode: string | null; departmentName: string | null;
  order: number; isActive: boolean;
  type?: { id: string; name: string; framework: Framework; departmentCode: string };
}

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
const DEPT_NAME: Record<string, string> = Object.fromEntries(DEPARTMENTS.map((d) => [d.code, d.name]));

const FORMULA_TYPES: { value: FormulaType; label: string }[] = [
  { value: 'RATIO', label: 'Ratio (numerator ÷ denominator)' },
  { value: 'MEAN', label: 'Mean (average of values)' },
  { value: 'MEDIAN', label: 'Median (middle of values)' },
  { value: 'CUSTOM', label: 'Custom expression' },
];
const MULTIPLIERS = [
  { value: 1, label: '× 1 — plain ratio' },
  { value: 100, label: '× 100 — percentage (%)' },
  { value: 1000, label: '× 1000 — per thousand' },
];

const inputCls =
  'w-full px-3 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/8 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all';

type TypeForm = { name: string; description: string; order: number; isActive: boolean };
const EMPTY_TYPE: TypeForm = { name: '', description: '', order: 0, isActive: true };

type TplForm = {
  typeId: string; name: string; numeratorLabel: string; denominatorLabel: string;
  formulaType: FormulaType; multiplier: number; customExpression: string; formula: string;
  unit: string; frequency: string; sourceOfData: string; significance: string;
  target: string; higherIsBetter: boolean;
  order: number; isActive: boolean;
};
const EMPTY_TPL: TplForm = {
  typeId: '', name: '', numeratorLabel: '', denominatorLabel: '',
  formulaType: 'RATIO', multiplier: 100, customExpression: '', formula: '',
  unit: '%', frequency: 'Monthly', sourceOfData: '', significance: '',
  target: '', higherIsBetter: true, order: 0, isActive: true,
};

// Only Super Admin may configure indicator frameworks. Admins get read-only
// data entry elsewhere (/indicators) and are bounced if they reach this URL.
export default function KpiTemplatesPage() {
  const router = useRouter();
  const { user, hydrated } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (hydrated && user && !isSuperAdmin) router.replace('/dashboard');
  }, [hydrated, user, isSuperAdmin, router]);

  if (hydrated && user && !isSuperAdmin) {
    return (
      <div className="max-w-md mx-auto mt-24 text-center rounded-2xl p-8" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center bg-rose-500/10 border border-rose-500/20">
          <ShieldAlert className="w-6 h-6 text-rose-400" />
        </div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-base)' }}>Super Admin only</h2>
        <p className="text-sm text-slate-400 mt-1.5">Indicator Setup is restricted to Super Admin accounts. Redirecting you to the dashboard…</p>
      </div>
    );
  }
  if (!hydrated || !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-brand-teal" />
      </div>
    );
  }

  return <KpiTemplatesInner />;
}

function KpiTemplatesInner() {
  const qc = useQueryClient();
  const [framework, setFramework] = useState<Framework>('KPI');
  const [dept, setDept] = useState<string>('emergency');
  const deptCode = framework === 'KPI' ? '' : dept;            // type.departmentCode for current context
  const contextLabel = framework === 'KPI' ? 'Hospital-wide' : DEPT_NAME[dept];

  const { data: types = [], isLoading: typesLoading } = useQuery<IType[]>({
    queryKey: ['indicator-types'], queryFn: () => api.get('/indicators/types'),
  });
  const { data: templates = [], isLoading: tplLoading } = useQuery<ITemplate[]>({
    queryKey: ['indicator-templates'], queryFn: () => api.get('/indicators/templates'),
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['indicator-types'] });
    qc.invalidateQueries({ queryKey: ['indicator-templates'] });
  };

  // Types in the current framework + department context
  const contextTypes = useMemo(
    () => types
      .filter((t) => t.framework === framework && t.departmentCode === deptCode)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    [types, framework, deptCode],
  );

  const [search, setSearch] = useState('');
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byType = new Map<string, ITemplate[]>();
    for (const t of templates) {
      if (q && !`${t.name} ${t.numeratorLabel ?? ''} ${t.denominatorLabel ?? ''}`.toLowerCase().includes(q)) continue;
      const arr = byType.get(t.typeId) ?? [];
      arr.push(t);
      byType.set(t.typeId, arr);
    }
    return contextTypes
      .map((ty) => ({ type: ty, items: (byType.get(ty.id) ?? []).sort((a, b) => a.order - b.order) }))
      // when searching, hide types with no matches
      .filter((g) => !q || g.items.length > 0);
  }, [templates, contextTypes, search]);

  // Export the current context's indicators to a CSV (opens in Excel).
  const exportCsv = () => {
    const rows = contextTypes.flatMap((ty) =>
      templates.filter((t) => t.typeId === ty.id).sort((a, b) => a.order - b.order).map((t) => ({
        Type: ty.name, Indicator: t.name,
        Numerator: t.numeratorLabel ?? '', Denominator: t.denominatorLabel ?? '',
        Formula: describeFormula(t.formulaType, t.multiplier, t.unit),
        Unit: t.unit ?? '', Frequency: t.frequency ?? '',
        Source: t.sourceOfData ?? '', Significance: t.significance ?? '',
        Active: t.isActive ? 'Yes' : 'No',
      })),
    );
    if (!rows.length) { toast.error('Nothing to export'); return; }
    const headers = Object.keys(rows[0]);
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => esc((r as Record<string, string>)[h])).join(','))].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `indicators-${framework.toLowerCase()}${deptCode ? `-${deptCode}` : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Type modal ──
  const [typeModal, setTypeModal] = useState<{ editing: IType | null } | null>(null);
  const [typeForm, setTypeForm] = useState<TypeForm>(EMPTY_TYPE);
  const openCreateType = () => { setTypeForm(EMPTY_TYPE); setTypeModal({ editing: null }); };
  const openEditType = (t: IType) => {
    setTypeForm({ name: t.name, description: t.description ?? '', order: t.order, isActive: t.isActive });
    setTypeModal({ editing: t });
  };
  const saveType = useMutation({
    mutationFn: () => {
      if (typeModal?.editing) {
        return api.patch(`/indicators/types/${typeModal.editing.id}`, {
          name: typeForm.name, description: typeForm.description || undefined, order: typeForm.order, isActive: typeForm.isActive,
        });
      }
      return api.post('/indicators/types', {
        framework,
        departmentCode: deptCode,
        departmentName: framework === 'OUTCOME' ? DEPT_NAME[dept] : undefined,
        name: typeForm.name,
        description: typeForm.description || undefined,
        order: typeForm.order,
        isActive: typeForm.isActive,
      });
    },
    onSuccess: () => { toast.success(typeModal?.editing ? 'Type updated' : 'Type created'); setTypeModal(null); invalidate(); },
    onError: (e) => toast.error('Failed to save type', e instanceof ApiError ? e.message : undefined),
  });
  const deleteType = useMutation({
    mutationFn: (id: string) => api.delete(`/indicators/types/${id}`),
    onSuccess: () => { toast.success('Type deleted'); invalidate(); },
    onError: (e) => toast.error('Cannot delete', e instanceof ApiError ? e.message : undefined),
  });

  // ── Template modal ──
  const [tplModal, setTplModal] = useState<{ editing: ITemplate | null } | null>(null);
  const [tplForm, setTplForm] = useState<TplForm>(EMPTY_TPL);
  const setTpl = <K extends keyof TplForm>(k: K, v: TplForm[K]) => setTplForm((p) => ({ ...p, [k]: v }));
  const openCreateTpl = (typeId?: string) => {
    setTplForm({ ...EMPTY_TPL, typeId: typeId ?? contextTypes[0]?.id ?? '' });
    setTplModal({ editing: null });
  };
  const openEditTpl = (t: ITemplate) => {
    setTplForm({
      typeId: t.typeId, name: t.name, numeratorLabel: t.numeratorLabel ?? '', denominatorLabel: t.denominatorLabel ?? '',
      formulaType: t.formulaType, multiplier: t.multiplier ?? 1, customExpression: t.customExpression ?? '', formula: t.formula ?? '',
      unit: t.unit ?? '', frequency: t.frequency ?? 'Monthly', sourceOfData: t.sourceOfData ?? '', significance: t.significance ?? '',
      target: t.target != null ? String(t.target) : '', higherIsBetter: t.higherIsBetter ?? true,
      order: t.order, isActive: t.isActive,
    });
    setTplModal({ editing: t });
  };
  const saveTpl = useMutation({
    mutationFn: () => {
      const f = tplForm;
      const body = {
        typeId: f.typeId, name: f.name,
        numeratorLabel: f.numeratorLabel || undefined, denominatorLabel: f.denominatorLabel || undefined,
        formulaType: f.formulaType, multiplier: f.formulaType === 'RATIO' ? f.multiplier : 1,
        customExpression: f.formulaType === 'CUSTOM' ? (f.customExpression || undefined) : undefined,
        formula: f.formula || undefined,
        unit: f.unit || undefined, frequency: f.frequency || undefined,
        sourceOfData: f.sourceOfData || undefined, significance: f.significance || undefined,
        target: f.target.trim() === '' ? undefined : Number(f.target),
        higherIsBetter: f.higherIsBetter,
        scope: framework === 'OUTCOME' ? 'DEPARTMENT' : 'HOSPITAL',
        departmentCode: framework === 'OUTCOME' ? dept : undefined,
        departmentName: framework === 'OUTCOME' ? DEPT_NAME[dept] : undefined,
        order: f.order, isActive: f.isActive,
      };
      return tplModal?.editing
        ? api.patch(`/indicators/templates/${tplModal.editing.id}`, body)
        : api.post('/indicators/templates', body);
    },
    onSuccess: () => { toast.success(tplModal?.editing ? 'Indicator updated' : 'Indicator created'); setTplModal(null); invalidate(); },
    onError: (e) => toast.error('Failed to save indicator', e instanceof ApiError ? e.message : undefined),
  });
  const toggleTpl = useMutation({
    mutationFn: (t: ITemplate) => api.patch(`/indicators/templates/${t.id}`, { isActive: !t.isActive }),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error('Failed', e instanceof ApiError ? e.message : undefined),
  });
  const deleteTpl = useMutation({
    mutationFn: (id: string) => api.delete(`/indicators/templates/${id}`),
    onSuccess: () => { toast.success('Indicator deleted'); invalidate(); },
    onError: (e) => toast.error('Cannot delete', e instanceof ApiError ? e.message : undefined),
  });

  const isLoading = typesLoading || tplLoading;
  const totalInContext = grouped.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-brand-teal/10 border border-brand-teal/20">
            <SlidersHorizontal className="w-5 h-5 text-brand-teal" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-100">Indicator Setup</h1>
            <p className="text-slate-500 text-sm mt-0.5">Department of Quality &amp; Patient Safety — define indicator types, formulas &amp; definitions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openCreateType} className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-200 bg-white/[0.05] border border-white/8 hover:bg-white/[0.08] transition-all">
            <FolderPlus className="w-4 h-4" /> New Type
          </button>
          <button onClick={() => openCreateTpl()} disabled={!contextTypes.length} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-teal hover:bg-brand-teal-dark disabled:opacity-50 transition-all">
            <Plus className="w-4 h-4" /> New Indicator
          </button>
        </div>
      </motion.div>

      {/* Framework tabs + dept selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-0.5 rounded-xl bg-white/5 border border-white/8 p-0.5">
          {(['KPI', 'OUTCOME'] as Framework[]).map((f) => (
            <button
              key={f}
              onClick={() => setFramework(f)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all',
                framework === f ? 'bg-brand-teal text-white' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              {f === 'KPI' ? 'Key Performance Indicators' : 'Outcome Indicators'}
            </button>
          ))}
        </div>
        {framework === 'OUTCOME' && (
          <div className="w-60">
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {/* Search */}
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search indicators…"
            className="w-full pl-9 pr-8 py-2 rounded-xl text-sm bg-white/[0.04] border border-white/8 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-500 hover:text-slate-300"><X className="w-3.5 h-3.5" /></button>
          )}
        </div>
        {/* Export */}
        <button onClick={exportCsv} title="Export to CSV (Excel)" className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-slate-300 bg-white/[0.05] border border-white/8 hover:bg-white/[0.08] transition-all">
          <Download className="w-3.5 h-3.5" /> Export
        </button>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
          <Building2 className="w-3.5 h-3.5" />
          <span className="font-semibold text-slate-400">{contextLabel}</span>
          <span>·</span>
          <span>{contextTypes.length} types · {totalInContext} indicators</span>
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden animate-pulse" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <div className="px-5 py-3.5 border-b border-white/6"><div className="h-4 w-32 rounded bg-white/[0.08]" /></div>
              <div className="divide-y divide-white/5">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="px-5 py-3.5">
                    <div className="h-3.5 w-56 rounded bg-white/[0.08] mb-2" />
                    <div className="h-2.5 w-40 rounded bg-white/[0.05]" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : contextTypes.length === 0 ? (
        <div className="rounded-2xl py-16 text-center" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No types yet for {contextLabel}.</p>
          <button onClick={openCreateType} className="mt-3 text-sm font-semibold text-brand-teal hover:underline">Create the first type</button>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ type, items }) => (
            <div key={type.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-white/6">
                <div className="flex items-center gap-2.5 min-w-0">
                  <h3 className="text-sm font-bold text-slate-100 truncate">{type.name}</h3>
                  <Badge variant="default">{items.length}</Badge>
                  {!type.isActive && <Badge variant="secondary">Inactive</Badge>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openCreateTpl(type.id)} title="Add indicator" className="p-1.5 rounded-lg text-slate-500 hover:text-brand-teal hover:bg-brand-teal/10 transition-all"><Plus className="w-3.5 h-3.5" /></button>
                  <button onClick={() => openEditType(type)} title="Edit type" className="p-1.5 rounded-lg text-slate-500 hover:text-brand-teal hover:bg-brand-teal/10 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                  <button
                    onClick={async () => { if (await confirm({ title: 'Delete this type?', message: `"${type.name}" — only possible if it has no indicators.`, confirmLabel: 'Delete' })) deleteType.mutate(type.id); }}
                    title="Delete type" className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              {items.length === 0 ? (
                <p className="px-5 py-4 text-xs text-slate-600">No indicators in this type yet.</p>
              ) : (
                <div className="divide-y divide-white/5">
                  {items.map((t) => (
                    <div key={t.id} className="px-5 py-3.5 flex items-start justify-between gap-3 hover:bg-white/[0.02] transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-100">{t.name}</span>
                          {!t.isActive && <Badge variant="secondary">Inactive</Badge>}
                        </div>
                        <div className="flex items-start gap-1.5 mt-1 text-[0.72rem] text-slate-500">
                          <Calculator className="w-3 h-3 shrink-0 mt-0.5" />
                          <span className="font-mono">{t.formula || describeFormula(t.formulaType, t.multiplier, t.unit)}</span>
                        </div>
                        {(t.numeratorLabel || t.denominatorLabel) && (
                          <p className="text-[0.72rem] text-slate-500 mt-1 line-clamp-1">
                            {t.numeratorLabel}{t.denominatorLabel ? ` ÷ ${t.denominatorLabel}` : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEditTpl(t)} title="Edit" className="p-1.5 rounded-lg text-slate-500 hover:text-brand-teal hover:bg-brand-teal/10 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => toggleTpl.mutate(t)} title={t.isActive ? 'Deactivate' : 'Activate'} className="p-1.5 rounded-lg text-slate-500 hover:text-brand-teal hover:bg-brand-teal/10 transition-all"><Power className="w-3.5 h-3.5" /></button>
                        <button
                          onClick={async () => { if (await confirm({ title: 'Delete this indicator?', message: `"${t.name}" will be removed. Indicators with recorded data can't be deleted — deactivate instead.`, confirmLabel: 'Delete' })) deleteTpl.mutate(t.id); }}
                          title="Delete" className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Type modal ── */}
      <AnimatePresence>
        {typeModal && (
          <ModalShell onClose={() => setTypeModal(null)} title={typeModal.editing ? 'Edit type' : `New type — ${contextLabel}`}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Type name</Label>
                <input value={typeForm.name} onChange={(e) => setTypeForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Productivity" className={inputCls} style={{ color: 'var(--text-base)' }} />
              </div>
              <div className="space-y-1.5">
                <Label>Description (optional)</Label>
                <input value={typeForm.description} onChange={(e) => setTypeForm((p) => ({ ...p, description: e.target.value }))} className={inputCls} style={{ color: 'var(--text-base)' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Display order</Label>
                  <input type="number" value={typeForm.order} onChange={(e) => setTypeForm((p) => ({ ...p, order: Number(e.target.value) }))} className={inputCls} style={{ color: 'var(--text-base)' }} />
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer mt-7">
                  <input type="checkbox" checked={typeForm.isActive} onChange={(e) => setTypeForm((p) => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 accent-brand-teal" />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>Active</span>
                </label>
              </div>
            </div>
            <ModalFooter onCancel={() => setTypeModal(null)} onSave={() => saveType.mutate()} saving={saveType.isPending} disabled={!typeForm.name.trim()} editing={!!typeModal.editing} />
          </ModalShell>
        )}
      </AnimatePresence>

      {/* ── Template modal ── */}
      <AnimatePresence>
        {tplModal && (
          <ModalShell wide onClose={() => setTplModal(null)} title={tplModal.editing ? 'Edit indicator' : `New indicator — ${contextLabel}`}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={tplForm.typeId} onValueChange={(v) => setTpl('typeId', v)}>
                    <SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger>
                    <SelectContent>{contextTypes.map((ty) => <SelectItem key={ty.id} value={ty.id}>{ty.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Quality Indicator name</Label>
                  <input value={tplForm.name} onChange={(e) => setTpl('name', e.target.value)} placeholder="e.g. Bed Occupancy Rate" className={inputCls} style={{ color: 'var(--text-base)' }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Numerator definition</Label>
                  <textarea value={tplForm.numeratorLabel} onChange={(e) => setTpl('numeratorLabel', e.target.value)} rows={3} placeholder="What the numerator counts…" className={`${inputCls} resize-y`} style={{ color: 'var(--text-base)' }} />
                </div>
                <div className="space-y-1.5">
                  <Label>Denominator definition</Label>
                  <textarea value={tplForm.denominatorLabel} onChange={(e) => setTpl('denominatorLabel', e.target.value)} rows={3} placeholder="Leave blank for mean/median indicators" className={`${inputCls} resize-y`} style={{ color: 'var(--text-base)' }} />
                </div>
              </div>

              {/* Formula */}
              <div className="rounded-xl bg-white/[0.03] border border-white/6 p-3.5 space-y-3">
                <div className="flex items-center gap-1.5 text-[0.7rem] text-slate-500 uppercase tracking-widest font-bold">
                  <Calculator className="w-3.5 h-3.5" /> Calculation rule
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Formula type</Label>
                    <Select value={tplForm.formulaType} onValueChange={(v) => setTpl('formulaType', v as FormulaType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{FORMULA_TYPES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {tplForm.formulaType === 'RATIO' && (
                    <div className="space-y-1.5">
                      <Label>Multiplier</Label>
                      <Select value={String(tplForm.multiplier)} onValueChange={(v) => setTpl('multiplier', Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{MULTIPLIERS.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                  {tplForm.formulaType === 'CUSTOM' && (
                    <div className="space-y-1.5">
                      <Label>Expression (use n, d, m)</Label>
                      <input value={tplForm.customExpression} onChange={(e) => setTpl('customExpression', e.target.value)} placeholder="e.g. (n / d) * 60" className={`${inputCls} font-mono`} style={{ color: 'var(--text-base)' }} />
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Formula</Label>
                  <textarea value={tplForm.formula} onChange={(e) => setTpl('formula', e.target.value)} rows={2}
                    placeholder="e.g. (Number of patient falls/Total number of inpatient days)*1000"
                    className={`${inputCls} font-mono resize-y`} style={{ color: 'var(--text-base)' }} />
                  <p className="text-[0.66rem] text-slate-500">Shown to admins on the data-entry screen.</p>
                </div>
                <p className="text-[0.72rem] text-brand-teal/90 font-mono flex items-center gap-1.5">
                  <Calculator className="w-3 h-3" /> Computes as: {describeFormula(tplForm.formulaType, tplForm.multiplier, tplForm.unit)}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Unit</Label>
                  <input value={tplForm.unit} onChange={(e) => setTpl('unit', e.target.value)} placeholder="%, days, score…" className={inputCls} style={{ color: 'var(--text-base)' }} />
                </div>
                <div className="space-y-1.5">
                  <Label>Frequency</Label>
                  <input value={tplForm.frequency} onChange={(e) => setTpl('frequency', e.target.value)} placeholder="Monthly" className={inputCls} style={{ color: 'var(--text-base)' }} />
                </div>
                <div className="space-y-1.5">
                  <Label>Display order</Label>
                  <input type="number" value={tplForm.order} onChange={(e) => setTpl('order', Number(e.target.value))} className={inputCls} style={{ color: 'var(--text-base)' }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Target (optional)</Label>
                  <input type="number" value={tplForm.target} onChange={(e) => setTpl('target', e.target.value)} placeholder="e.g. 85" className={inputCls} style={{ color: 'var(--text-base)' }} />
                </div>
                <div className="space-y-1.5">
                  <Label>Direction</Label>
                  <Select value={tplForm.higherIsBetter ? 'high' : 'low'} onValueChange={(v) => setTpl('higherIsBetter', v === 'high')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">Higher is better</SelectItem>
                      <SelectItem value="low">Lower is better</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-[0.7rem] text-slate-500 -mt-2">Set a target to show red / amber / green status on the dashboard.</p>

              <div className="space-y-1.5">
                <Label>Source of data</Label>
                <input value={tplForm.sourceOfData} onChange={(e) => setTpl('sourceOfData', e.target.value)} placeholder="e.g. Midnight census" className={inputCls} style={{ color: 'var(--text-base)' }} />
              </div>
              <div className="space-y-1.5">
                <Label>Significance</Label>
                <textarea value={tplForm.significance} onChange={(e) => setTpl('significance', e.target.value)} rows={2} placeholder="Why this indicator matters…" className={`${inputCls} resize-y`} style={{ color: 'var(--text-base)' }} />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={tplForm.isActive} onChange={(e) => setTpl('isActive', e.target.checked)} className="w-4 h-4 accent-brand-teal" />
                <span className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>Active (available for data entry)</span>
              </label>
            </div>
            <ModalFooter
              onCancel={() => setTplModal(null)} onSave={() => saveTpl.mutate()} saving={saveTpl.isPending}
              disabled={!tplForm.typeId || !tplForm.name.trim()}
              editing={!!tplModal.editing}
            />
          </ModalShell>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Shared modal shell ──────────────────────────────────────────────────────

function ModalShell({ children, title, onClose, wide }: { children: React.ReactNode; title: string; onClose: () => void; wide?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className={cn('w-full max-h-[90vh] overflow-y-auto rounded-2xl p-6', wide ? 'max-w-2xl' : 'max-w-md')}
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold" style={{ color: 'var(--text-base)' }}>{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-all" style={{ color: 'var(--text-muted)' }}><X className="w-4 h-4" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function ModalFooter({ onCancel, onSave, saving, disabled, editing }: { onCancel: () => void; onSave: () => void; saving: boolean; disabled: boolean; editing: boolean }) {
  return (
    <div className="flex justify-end gap-2 mt-6">
      <button onClick={onCancel} className="px-3.5 py-2 rounded-xl text-sm transition-all" style={{ color: 'var(--text-base)' }}>Cancel</button>
      <button onClick={onSave} disabled={disabled || saving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-brand-teal disabled:opacity-50 hover:bg-brand-teal-dark transition-all">
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-4 h-4" />}
        {editing ? 'Save changes' : 'Create'}
      </button>
    </div>
  );
}
