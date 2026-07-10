'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  Search,
  Download,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; role: string } | null;
}

const PURGE_OPTIONS = [
  { label: 'Older than 30 days', days: 30 },
  { label: 'Older than 60 days', days: 60 },
  { label: 'Older than 90 days', days: 90 },
  { label: 'Older than 180 days', days: 180 },
  { label: 'Older than 1 year', days: 365 },
];

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  LOGOUT: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  ASSESSMENT_APPROVED: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  ASSESSMENT_REJECTED: 'text-red-400 bg-red-500/10 border-red-500/20',
  ASSESSMENT_SENT_BACK: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
};

function actionColor(action: string) {
  if (ACTION_COLORS[action]) return ACTION_COLORS[action];
  if (action.includes('DELETE') || action.includes('REJECT')) return 'text-red-400 bg-red-500/10 border-red-500/20';
  if (action.includes('APPROV') || action.includes('CREATE') || action.includes('LOGIN')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (action.includes('UPDATE') || action.includes('SENT_BACK')) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
}

export default function AuditLogsPage() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgePending, setPurgePending] = useState(false);

  const limit = 50;

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (actionFilter) params.set('action', actionFilter);
  if (resourceFilter) params.set('resource', resourceFilter);
  if (fromDate) params.set('from', new Date(fromDate).toISOString());
  if (toDate) {
    const d = new Date(toDate);
    d.setHours(23, 59, 59, 999);
    params.set('to', d.toISOString());
  }

  const { data, isLoading } = useQuery<{ data: AuditLog[]; total: number; totalPages: number }>({
    queryKey: ['audit-logs', page, actionFilter, resourceFilter, fromDate, toDate],
    queryFn: () => api.get(`/audit?${params}`),
    enabled: user?.role === 'ADMIN',
  });

  const logs = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  const handleExport = () => {
    const exportParams = new URLSearchParams();
    if (actionFilter) exportParams.set('action', actionFilter);
    if (resourceFilter) exportParams.set('resource', resourceFilter);
    if (fromDate) exportParams.set('from', new Date(fromDate).toISOString());
    if (toDate) {
      const d = new Date(toDate);
      d.setHours(23, 59, 59, 999);
      exportParams.set('to', d.toISOString());
    }
    const token = useAuthStore.getState().accessToken;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
    const url = `${baseUrl}/audit/export?${exportParams}`;
    // Trigger download via a temporary anchor tag
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', '');
    // Pass auth header via a fetch + blob approach
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const objUrl = URL.createObjectURL(blob);
        a.href = objUrl;
        a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(objUrl);
      })
      .catch(() => toast.error('Export failed'));
  };

  const handlePurge = async (days: number) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    setPurgePending(true);
    try {
      const res = await api.delete<{ count: number; message: string }>(`/audit/purge?before=${cutoff.toISOString()}`);
      toast.success(`Purged ${res.count} log(s) older than ${days} days`);
      qc.invalidateQueries({ queryKey: ['audit-logs'] });
      setPurgeOpen(false);
    } catch (err) {
      toast.error('Purge failed', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setPurgePending(false);
    }
  };

  const resetFilters = () => {
    setActionFilter('');
    setResourceFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const hasFilters = actionFilter || resourceFilter || fromDate || toDate;

  if (user?.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-slate-500">Access denied</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-brand-teal" />
            Audit Logs
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Complete history of user actions across the platform
            {total > 0 && <span className="ml-2 text-slate-600">({total.toLocaleString()} entries)</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-300 bg-white/6 hover:bg-white/10 border border-white/10 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={() => setPurgeOpen((v) => !v)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-red-400 bg-red-500/8 hover:bg-red-500/15 border border-red-500/15 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Purge Old Logs
          </button>
        </div>
      </motion.div>

      {/* Purge panel */}
      {purgeOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-200">Purge Old Audit Logs</p>
              <p className="text-xs text-slate-500 mt-0.5">This action is permanent and cannot be undone. Choose a cutoff period:</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {PURGE_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                onClick={() => handlePurge(opt.days)}
                disabled={purgePending}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-red-400 border border-red-500/20 hover:bg-red-500/15 transition-all disabled:opacity-50"
              >
                {purgePending ? <Loader2 className="w-3 h-3 animate-spin" /> : opt.label}
              </button>
            ))}
            <button
              onClick={() => setPurgeOpen(false)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 border border-white/10 hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl p-4"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filters</span>
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="ml-auto text-xs text-brand-teal hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
            <input
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              placeholder="Filter by action…"
              className="w-full pl-8 pr-3 py-2 rounded-xl text-sm bg-white/[0.04] border border-white/8 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
            <input
              value={resourceFilter}
              onChange={(e) => { setResourceFilter(e.target.value); setPage(1); }}
              placeholder="Filter by resource…"
              className="w-full pl-8 pr-3 py-2 rounded-xl text-sm bg-white/[0.04] border border-white/8 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all"
            />
          </div>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 rounded-xl text-sm bg-white/[0.04] border border-white/8 text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all [color-scheme:dark]"
            title="From date"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 rounded-xl text-sm bg-white/[0.04] border border-white/8 text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all [color-scheme:dark]"
            title="To date"
          />
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
      >
        {/* Header row */}
        <div
          className="grid gap-4 px-5 py-3 text-[0.65rem] font-bold text-slate-600 uppercase tracking-widest"
          style={{
            gridTemplateColumns: '160px 1fr 130px 100px 140px',
            borderBottom: '1px solid var(--card-border)',
            background: 'var(--inner-bg)',
          }}
        >
          <span>Timestamp</span>
          <span>Action · Resource</span>
          <span>User</span>
          <span>Role</span>
          <span>IP Address</span>
        </div>

        <div className="divide-y" style={{ borderColor: 'var(--inner-border)' }}>
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="grid gap-4 px-5 py-3.5 animate-pulse"
                style={{ gridTemplateColumns: '160px 1fr 130px 100px 140px' }}
              >
                <div className="h-3.5 w-32 rounded bg-white/5" />
                <div className="space-y-1.5">
                  <div className="h-4 w-28 rounded bg-white/5" />
                  <div className="h-3 w-20 rounded bg-white/5" />
                </div>
                <div className="h-3.5 w-24 rounded bg-white/5" />
                <div className="h-4 w-14 rounded bg-white/5" />
                <div className="h-3.5 w-20 rounded bg-white/5" />
              </div>
            ))
          ) : logs.length ? (
            logs.map((log) => (
              <div
                key={log.id}
                className="grid gap-4 items-center px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
                style={{ gridTemplateColumns: '160px 1fr 130px 100px 140px' }}
              >
                <div className="text-[0.7rem] text-slate-500 tabular-nums font-mono">
                  {new Date(log.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div>
                  <span
                    className={cn(
                      'inline-flex items-center text-[0.65rem] font-bold px-1.5 py-0.5 rounded border',
                      actionColor(log.action),
                    )}
                  >
                    {log.action}
                  </span>
                  <div className="text-[0.7rem] text-slate-500 mt-0.5">
                    {log.resource}
                    {log.resourceId && <span className="ml-1.5 text-slate-600 font-mono">{log.resourceId.slice(0, 8)}…</span>}
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-300 font-medium truncate">{log.user?.name ?? '—'}</p>
                  <p className="text-[0.68rem] text-slate-600 truncate">{log.user?.email ?? ''}</p>
                </div>
                <div>
                  {log.user?.role && (
                    <span className={cn(
                      'text-[0.6rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border',
                      log.user.role === 'ADMIN' ? 'text-purple-400 bg-purple-500/10 border-purple-500/20' :
                      log.user.role === 'HOD' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                      'text-brand-teal bg-brand-teal/10 border-brand-teal/20',
                    )}>
                      {log.user.role}
                    </span>
                  )}
                </div>
                <div className="text-[0.7rem] text-slate-600 font-mono tabular-nums">
                  {log.ipAddress ?? '—'}
                </div>
              </div>
            ))
          ) : (
            <div className="py-16 text-center">
              <Shield className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No audit logs found</p>
              {hasFilters && (
                <button onClick={resetFilters} className="text-brand-teal text-sm mt-1 hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderTop: '1px solid var(--card-border)', background: 'var(--inner-bg)' }}
          >
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
              <span className="ml-2 text-slate-600">· {total.toLocaleString()} total entries</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
