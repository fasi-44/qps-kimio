'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MapPin,
  Building2,
  Shield,
  Layers,
  FileText,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface MappingImportResult { inserted: number; updated: number; errors: string[]; }

type AppModule = 'NQAS' | 'NABH' | 'KAYAKALPA';
type UserRole  = 'ADMIN' | 'HOD' | 'ASSESSOR';

interface RolePermission { role: UserRole; moduleAccess: AppModule[]; pageAccess: string[]; }

const MODULE_OPTIONS: { value: AppModule; label: string; color: string }[] = [
  { value: 'NQAS',      label: 'NQAS',      color: 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/30' },
  { value: 'NABH',      label: 'NABH',      color: 'text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/30' },
  { value: 'KAYAKALPA', label: 'Kayakalpa', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
];

const PAGE_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'dashboard',         label: 'Dashboard',    color: 'text-brand-teal bg-brand-teal/10 border-brand-teal/30' },
  { value: 'assessments',       label: 'Assessments',  color: 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/30' },
  { value: 'assessment-cycles', label: 'Cycles',       color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/30' },
  { value: 'approvals',         label: 'Approvals',    color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { value: 'reports',           label: 'Reports',      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  { value: 'users',             label: 'Users',        color: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/30' },
  { value: 'audit-logs',        label: 'Audit Logs',   color: 'text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/30' },
  { value: 'settings',          label: 'Settings',     color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30' },
];

const ROLE_DESC: Record<UserRole, string> = {
  ADMIN:    'Full platform access — users, settings, audit',
  HOD:      'Approve/reject assessments, view dashboard',
  ASSESSOR: 'Create and submit own assessments',
};

interface HospitalSettings {
  name: string; address: string; email: string; phone: string; nabh_reg_number: string | null;
}

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'var(--inner-bg)', border: '1px solid var(--card-border)' }}
      >
        <Icon className="w-4 h-4 text-brand-teal" />
      </div>
      <div>
        <h2 className="text-base font-bold text-slate-200">{title}</h2>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const [mappingFile, setMappingFile]   = useState<File | null>(null);
  const [importResult, setImportResult] = useState<MappingImportResult | null>(null);
  const [importPending, setImportPending] = useState(false);

  const { data: settings } = useQuery<HospitalSettings>({
    queryKey: ['hospital-settings'],
    queryFn:  () => api.get('/hospital/settings'),
  });
  const [form, setForm] = useState<Partial<HospitalSettings>>({});

  const handleSettingsSave = async () => {
    try {
      await api.patch('/hospital/settings', form);
      toast.success('Settings saved');
      qc.invalidateQueries({ queryKey: ['hospital-settings'] });
    } catch (err) {
      toast.error('Save failed', err instanceof ApiError ? err.message : '');
    }
  };

  const handleMappingImport = async () => {
    if (!mappingFile) return;
    setImportPending(true);
    setImportResult(null);
    const fd = new FormData();
    fd.append('file', mappingFile);
    try {
      const result = await api.upload<MappingImportResult>('/mappings/import', fd);
      setImportResult(result);
      toast.success(`Import complete: ${result.inserted} inserted, ${result.updated} updated`);
    } catch (err) {
      toast.error('Import failed', err instanceof ApiError ? err.message : '');
    } finally {
      setImportPending(false);
    }
  };

  const { data: rolePerms = [], isLoading: permsLoading } = useQuery<RolePermission[]>({
    queryKey: ['role-permissions'],
    queryFn:  () => api.get('/permissions/roles'),
  });

  const [permsDraft, setPermsDraft] = useState<Record<UserRole, AppModule[]>>({
    ADMIN:    ['NQAS', 'NABH', 'KAYAKALPA'],
    HOD:      ['NQAS'],
    ASSESSOR: ['NQAS'],
  });
  const [pageDraft, setPageDraft] = useState<Record<UserRole, string[]>>({
    ADMIN:    ['dashboard', 'assessments', 'assessment-cycles', 'approvals', 'reports', 'users', 'audit-logs', 'settings'],
    HOD:      ['dashboard', 'assessments', 'assessment-cycles', 'approvals', 'reports'],
    ASSESSOR: ['dashboard', 'assessments', 'assessment-cycles', 'reports'],
  });

  useEffect(() => {
    if (!rolePerms.length) return;
    const modDraft: Record<string, AppModule[]> = {};
    const pgDraft:  Record<string, string[]>    = {};
    rolePerms.forEach((rp) => { modDraft[rp.role] = rp.moduleAccess; pgDraft[rp.role] = rp.pageAccess ?? []; });
    setPermsDraft(modDraft as Record<UserRole, AppModule[]>);
    setPageDraft(pgDraft   as Record<UserRole, string[]>);
  }, [rolePerms]);

  const [permsSaving, setPermsSaving] = useState<UserRole | null>(null);

  const saveRolePerms = async (role: UserRole) => {
    setPermsSaving(role);
    try {
      await api.patch(`/permissions/roles/${role}`, { moduleAccess: permsDraft[role], pageAccess: pageDraft[role] });
      toast.success(`${role} permissions saved`);
      qc.invalidateQueries({ queryKey: ['role-permissions'] });
    } catch (err) {
      toast.error('Save failed', err instanceof ApiError ? err.message : '');
    } finally {
      setPermsSaving(null);
    }
  };

  const toggleModule = (role: UserRole, mod: AppModule) =>
    setPermsDraft((p) => {
      const cur = p[role] ?? [];
      return { ...p, [role]: cur.includes(mod) ? cur.filter((m) => m !== mod) : [...cur, mod] };
    });

  const togglePage = (role: UserRole, page: string) =>
    setPageDraft((p) => {
      const cur = p[role] ?? [];
      return { ...p, [role]: cur.includes(page) ? cur.filter((x) => x !== page) : [...cur, page] };
    });

  return (
    <div className="space-y-8 w-full">

      {/* ── Page header ─────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-extrabold text-slate-100">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Platform configuration and administration</p>
      </motion.div>

      {/* ── Row 1: Hospital Info (left) + Checklist Mapping (right) ─ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 items-start"
      >
        {/* Hospital Information */}
        <section>
          <SectionHeader
            icon={Building2}
            title="Hospital Information"
            description="Displayed on reports and exported documents"
          />
          <div
            className="rounded-2xl p-6 space-y-4"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
          >
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { key: 'name',            label: 'Hospital Name',    placeholder: 'Kidwai Memorial Institute of Oncology', full: true },
                { key: 'address',         label: 'Address',          placeholder: 'Full hospital address', full: true },
                { key: 'email',           label: 'Contact Email',    placeholder: 'admin@kmio.ac.in' },
                { key: 'phone',           label: 'Contact Phone',    placeholder: '+91-80-26569000' },
                { key: 'nabh_reg_number', label: 'NABH Reg. No.',    placeholder: 'NABH registration number (optional)', full: true },
              ].map(({ key, label, placeholder, full }) => (
                <div key={key} className={cn('space-y-1.5', full && 'sm:col-span-2')}>
                  <Label className="text-slate-500 text-xs">{label}</Label>
                  <input
                    value={(form as Record<string, string>)[key] ?? (settings as Record<string, string> | undefined)?.[key] ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    style={{ background: 'var(--inner-bg)', borderColor: 'var(--card-border)' }}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm border text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={handleSettingsSave}
              className="w-full py-2.5 rounded-xl font-bold text-sm text-white bg-brand-teal hover:bg-brand-teal-dark hover:shadow-lg hover:shadow-brand-teal/20 transition-all mt-2"
            >
              Save Settings
            </button>
          </div>
        </section>

        {/* Checklist Mapping */}
        <section>
          <SectionHeader
            icon={MapPin}
            title="Checklist Mapping"
            description="Map client checkpoints to NQAS Measurable Elements"
          />
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
          >
            <p className="text-xs text-slate-500 leading-relaxed">
              Re-importing is safe — existing mappings are updated, new ones are added, none deleted.
            </p>

            <label
              className={cn(
                'flex flex-col items-center justify-center gap-3 py-8 px-4 rounded-xl cursor-pointer transition-all duration-200 border-2 border-dashed',
                mappingFile ? 'border-brand-teal/40 bg-brand-teal/5' : 'hover:border-brand-teal/30',
              )}
              style={mappingFile ? undefined : { borderColor: 'var(--card-border)' }}
            >
              <input type="file" accept=".json" className="sr-only" onChange={(e) => setMappingFile(e.target.files?.[0] ?? null)} />
              <Upload className={cn('w-7 h-7', mappingFile ? 'text-brand-teal' : 'text-slate-500')} />
              {mappingFile ? (
                <div className="text-center">
                  <p className="text-sm font-semibold text-brand-teal truncate max-w-[180px]">{mappingFile.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{(mappingFile.size / 1024).toFixed(1)} KB · Click to change</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-400">Drop JSON or click to browse</p>
                  <p className="text-xs text-slate-500 mt-0.5">max 10 MB</p>
                </div>
              )}
            </label>

            <button
              onClick={handleMappingImport}
              disabled={!mappingFile || importPending}
              className={cn(
                'w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all',
                !mappingFile || importPending
                  ? 'opacity-50 cursor-not-allowed bg-slate-500/30'
                  : 'bg-brand-teal hover:bg-brand-teal-dark hover:shadow-lg hover:shadow-brand-teal/20',
              )}
            >
              {importPending
                ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Importing…</span>
                : 'Import Mapping'}
            </button>

            {importResult && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl p-4 space-y-2"
                style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">Import successful</p>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-emerald-600 dark:text-emerald-400"><strong>{importResult.inserted}</strong> inserted</span>
                  <span className="text-brand-teal"><strong>{importResult.updated}</strong> updated</span>
                </div>
                {importResult.errors.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-500 flex items-center gap-1.5 mb-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {importResult.errors.length} warnings
                    </p>
                    <ul className="space-y-0.5 max-h-28 overflow-y-auto">
                      {importResult.errors.map((e, i) => <li key={i} className="text-xs text-amber-500/80">{e}</li>)}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </section>
      </motion.div>

      {/* ── Row 2: Role Permissions — 3 cards side by side on desktop ─ */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <SectionHeader
          icon={Shield}
          title="Role Permissions"
          description="Control module and page access per role — changes apply at next login"
        />

        {permsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-brand-teal animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['ADMIN', 'HOD', 'ASSESSOR'] as UserRole[]).map((role) => (
              <div
                key={role}
                className="rounded-2xl p-5 space-y-4 flex flex-col"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
              >
                {/* Role header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-200">{role}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{ROLE_DESC[role]}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => saveRolePerms(role)}
                    disabled={permsSaving === role}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-700 to-violet-500 hover:shadow-lg hover:shadow-violet-500/20 disabled:opacity-50 transition-all shrink-0"
                  >
                    {permsSaving === role && <Loader2 className="w-3 h-3 animate-spin" />}
                    Save
                  </button>
                </div>

                {/* Module Access */}
                <div>
                  <p className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Layers className="w-3 h-3" /> Modules
                  </p>
                  <div className="flex gap-1.5">
                    {MODULE_OPTIONS.map(({ value, label, color }) => {
                      const active = (permsDraft[role] ?? []).includes(value);
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => toggleModule(role, value)}
                          style={active ? undefined : { borderColor: 'var(--card-border)' }}
                          className={cn(
                            'flex-1 py-1.5 rounded-lg text-[0.7rem] font-bold border transition-all',
                            active ? color : 'text-slate-500 hover:text-slate-400',
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {(permsDraft[role] ?? []).length === 0 && (
                    <p className="text-[0.68rem] text-amber-500 mt-1">⚠ No module access</p>
                  )}
                </div>

                {/* Page Access */}
                <div className="flex-1">
                  <p className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <FileText className="w-3 h-3" /> Pages
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {PAGE_OPTIONS.map(({ value, label, color }) => {
                      const active = (pageDraft[role] ?? []).includes(value);
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => togglePage(role, value)}
                          style={active ? undefined : { borderColor: 'var(--card-border)' }}
                          className={cn(
                            'py-1.5 rounded-lg text-[0.68rem] font-bold border transition-all truncate',
                            active ? color : 'text-slate-500 hover:text-slate-400',
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {(pageDraft[role] ?? []).length === 0 && (
                    <p className="text-[0.68rem] text-amber-500 mt-1">⚠ No page access</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.section>
    </div>
  );
}
