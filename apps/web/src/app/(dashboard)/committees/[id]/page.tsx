'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Loader2, UserPlus, Trash2, History, CalendarDays, Archive, Landmark, X, Check, Lock, RotateCcw,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { confirm } from '@/hooks/use-confirm';
import { formatDate } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Typeahead } from '@/components/ui/typeahead';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth.store';

interface Member {
  id: string;
  membershipType: 'DESIGNATION' | 'NOMINATION';
  nomineeName: string | null;
  isActive: boolean;
  positionType: { id: string; name: string };
  user: { id: string; name: string; email: string } | null;
  designation: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  incumbents: { id: string; name: string; email: string }[];
}
interface Committee {
  id: string; name: string; category: string | null; type: string | null;
  purpose: string | null; frequency: string; status: string;
  effectiveDate: string | null; expiryDate: string | null;
  members: Member[];
  _count: { meetings: number; actions: number };
}
interface PositionType { id: string; name: string; canApprove: boolean }
interface Designation { id: string; name: string }
interface UserName { id: string; name: string; designation: string | null; designationIds: string[] }
interface MemberSnapshot {
  position?: string | null;
  userName?: string | null;
  designation?: string | null;
  nomineeName?: string | null;
}
interface HistoryRow {
  id: string; changeType: string; changeReason: string | null; createdAt: string;
  changedBy: { name: string } | null;
  newValue: MemberSnapshot | null;
  previousValue: MemberSnapshot | null;
}

export default function CommitteeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'ADMIN' || user?.role === 'HOD';

  const [showHistory, setShowHistory] = useState(false);
  const [adding, setAdding] = useState(false);
  const EMPTY_FORM = {
    positionTypeId: '', membershipType: 'NOMINATION', userId: '', designationId: '', nomineeName: '',
    holderIds: [] as string[],
  };
  const [form, setForm] = useState(EMPTY_FORM);
  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));
  const toggleHolder = (uid: string) =>
    setForm((p) => ({
      ...p,
      holderIds: p.holderIds.includes(uid) ? p.holderIds.filter((x) => x !== uid) : [...p.holderIds, uid],
    }));
  const closeAdd = () => {
    setForm(EMPTY_FORM);
    setAdding(false);
  };

  const { data: committee, isLoading } = useQuery<Committee>({
    queryKey: ['committee', id],
    queryFn: () => api.get(`/committees/${id}`),
  });
  const { data: positions = [] } = useQuery<PositionType[]>({
    queryKey: ['committee-positions'], queryFn: () => api.get('/committee-positions'), enabled: canManage,
  });
  const { data: designations = [] } = useQuery<Designation[]>({
    queryKey: ['designations'], queryFn: () => api.get('/designations'), enabled: canManage,
  });
  const { data: userNames = [] } = useQuery<UserName[]>({
    queryKey: ['user-names'], queryFn: () => api.get('/users/names'), enabled: canManage,
  });
  const { data: history = [] } = useQuery<HistoryRow[]>({
    queryKey: ['committee-history', id], queryFn: () => api.get(`/committees/${id}/history`), enabled: showHistory,
  });

  const addMember = useMutation({
    mutationFn: async () => {
      if (form.membershipType === 'NOMINATION') {
        await api.post(`/committees/${id}/members`, {
          positionTypeId: form.positionTypeId,
          membershipType: 'NOMINATION',
          userId: form.userId,
          nomineeName: form.nomineeName || undefined,
        });
        return 1;
      }
      // Designation: add one member per selected holder, tagged with the title (seat)
      for (const uid of form.holderIds) {
        await api.post(`/committees/${id}/members`, {
          positionTypeId: form.positionTypeId,
          membershipType: 'DESIGNATION',
          designationId: form.designationId,
          userId: uid,
        });
      }
      return form.holderIds.length;
    },
    onSuccess: (count) => {
      toast.success(count === 1 ? 'Member added' : `${count} members added`);
      setForm(EMPTY_FORM);
      setAdding(false);
      qc.invalidateQueries({ queryKey: ['committee', id] });
    },
    onError: (e) => toast.error('Failed to add member', e instanceof ApiError ? e.message : undefined),
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => api.delete(`/committees/${id}/members/${memberId}`),
    onSuccess: () => {
      toast.success('Member removed');
      qc.invalidateQueries({ queryKey: ['committee', id] });
    },
    onError: (e) => toast.error('Failed to remove', e instanceof ApiError ? e.message : undefined),
  });

  const archive = useMutation({
    mutationFn: () => api.patch(`/committees/${id}/status`, { status: 'ARCHIVED' }),
    onSuccess: () => { toast.success('Committee archived'); qc.invalidateQueries({ queryKey: ['committee', id] }); },
    onError: (e) => toast.error('Failed', e instanceof ApiError ? e.message : undefined),
  });

  const activate = useMutation({
    mutationFn: () => api.patch(`/committees/${id}/status`, { status: 'ACTIVE' }),
    onSuccess: () => { toast.success('Committee reactivated'); qc.invalidateQueries({ queryKey: ['committee', id] }); },
    onError: (e) => toast.error('Failed', e instanceof ApiError ? e.message : undefined),
  });

  if (isLoading || !committee) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-brand-teal" />
      </div>
    );
  }

  // Users already holding an active seat — cannot be added again.
  const activeMemberIds = new Set(
    committee.members.filter((m) => m.isActive && m.user).map((m) => m.user!.id),
  );

  // Archived / inactive committees are read-only (matches the backend guard).
  const readOnly = committee.status !== 'ACTIVE';
  const canWrite = canManage && !readOnly;

  const canSubmitAdd = !!form.positionTypeId &&
    (form.membershipType === 'NOMINATION'
      ? !!form.userId
      : !!form.designationId && form.holderIds.length > 0);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3">
        <Link href="/committees" className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-all mt-1">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-extrabold text-slate-100">{committee.name}</h1>
            <Badge variant={committee.status === 'ACTIVE' ? 'default' : committee.status === 'ARCHIVED' ? 'destructive' : 'secondary'}>
              {committee.status}
            </Badge>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            {[committee.category, committee.type].filter(Boolean).join(' · ') || 'No category'} · {committee.frequency.replace('_', '-')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/committees/${id}/meetings`}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-brand-teal bg-brand-teal/10 border border-brand-teal/20 hover:bg-brand-teal/20 transition-all"
          >
            <CalendarDays className="w-4 h-4" />
            Meetings ({committee._count.meetings})
          </Link>
          {canManage && committee.status !== 'ACTIVE' && (
            <button
              onClick={async () => {
                if (await confirm({
                  title: 'Reactivate this committee?',
                  message: 'It will become active and editable again.',
                  confirmLabel: 'Activate',
                  tone: 'default',
                })) activate.mutate();
              }}
              disabled={activate.isPending}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50 transition-all"
              title="Reactivate committee"
            >
              {activate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Activate
            </button>
          )}
          {canManage && committee.status !== 'ARCHIVED' && (
            <button
              onClick={async () => {
                if (await confirm({
                  title: 'Archive this committee?',
                  message: 'It will be moved to archived status. You can still view its history.',
                  confirmLabel: 'Archive',
                })) archive.mutate();
              }}
              className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all border border-white/8"
              title="Archive committee"
            >
              <Archive className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>

      {readOnly && (
        <div className="rounded-2xl px-4 py-3 flex items-center gap-2.5 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
          <Lock className="w-4 h-4 shrink-0" />
          This committee is {committee.status.toLowerCase()} — it is read-only. Reactivate it to make changes.
        </div>
      )}

      {committee.purpose && (
        <div className="rounded-2xl p-5 text-sm text-slate-400" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Purpose</p>
          {committee.purpose}
        </div>
      )}

      {/* Members */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
          <h2 className="text-sm font-bold text-slate-200">Members ({committee.members.length})</h2>
          {canWrite && (
            <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs font-semibold text-brand-teal hover:underline">
              <UserPlus className="w-3.5 h-3.5" /> Add member
            </button>
          )}
        </div>

        <div className="divide-y divide-white/5">
          {committee.members.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No members yet</p>
          ) : (
            committee.members.map((m) => (
              <div key={m.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-200 truncate">
                      {m.user?.name ?? m.nomineeName ?? m.designation?.name ?? '—'}
                    </span>
                    <Badge variant="secondary">{m.positionType.name}</Badge>
                    {m.membershipType === 'DESIGNATION' && m.designation && (
                      <Badge variant="outline">{m.designation.name}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {m.membershipType === 'DESIGNATION'
                      ? `Holds title: ${m.designation?.name ?? '—'}${m.user?.email ? ` · ${m.user.email}` : ''}`
                      : (m.user?.email ?? 'Nominee')}
                  </p>
                </div>
                {canWrite && (
                  <button
                    onClick={async () => {
                      if (await confirm({
                        title: 'Remove this member?',
                        message: `${m.user?.name ?? m.nomineeName ?? m.designation?.name ?? 'This member'} will be removed from the committee.`,
                        confirmLabel: 'Remove',
                      })) removeMember.mutate(m.id);
                    }}
                    className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                    title="Remove member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* History */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        <button onClick={() => setShowHistory((v) => !v)} className="w-full flex items-center gap-2 px-5 py-4 text-sm font-bold text-slate-200 hover:bg-white/[0.02] transition-all">
          <History className="w-4 h-4 text-slate-500" />
          Membership History
          <span className="ml-auto text-xs text-slate-500">{showHistory ? 'Hide' : 'Show'}</span>
        </button>
        {showHistory && (
          <div className="divide-y divide-white/5 border-t border-white/6">
            {history.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500">No history recorded</p>
            ) : (
              history.map((h) => {
                const snap = h.newValue ?? h.previousValue;
                const who = snap?.userName ?? snap?.nomineeName ?? snap?.designation ?? '—';
                return (
                  <div key={h.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{h.changeType}</Badge>
                      <span className="text-slate-200 font-medium truncate">{who}</span>
                      {snap?.position && <span className="text-slate-500">· {snap.position}</span>}
                      {h.changeReason && <span className="text-slate-500">· {h.changeReason}</span>}
                    </div>
                    <span className="text-slate-600 shrink-0 text-right">
                      {h.changedBy?.name ?? 'System'} · {formatDate(h.createdAt)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Add member modal */}
      <AnimatePresence>
        {adding && (
          <Modal title="Add member" onClose={closeAdd}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Position</Label>
                <Select value={form.positionTypeId} onValueChange={(v) => set('positionTypeId', v)}>
                  <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
                  <SelectContent>
                    {positions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.canApprove ? ' (approver)' : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Membership Type</Label>
                <Select
                  value={form.membershipType}
                  onValueChange={(v) => setForm((p) => ({ ...p, membershipType: v, userId: '', designationId: '', holderIds: [] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOMINATION">Nomination (specific person)</SelectItem>
                    <SelectItem value="DESIGNATION">Designation (pick holders)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.membershipType === 'NOMINATION' ? (
                <div className="space-y-2">
                  <Label>Nominee</Label>
                  <Typeahead
                    value={form.userId}
                    onSelect={(v) => set('userId', v)}
                    placeholder="Search user by name…"
                    options={userNames
                      .filter((u) => !activeMemberIds.has(u.id))
                      .map((u) => ({ id: u.id, label: u.name, sublabel: u.designation ?? undefined }))}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Designation</Label>
                  <Typeahead
                    value={form.designationId}
                    onSelect={(v) => setForm((p) => ({ ...p, designationId: v, holderIds: [] }))}
                    placeholder="Search designation…"
                    options={designations.map((d) => ({ id: d.id, label: d.name }))}
                  />
                  {form.designationId && (() => {
                    const holders = userNames.filter((u) => u.designationIds.includes(form.designationId));
                    return (
                      <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
                        <p className="text-[0.68rem] font-bold text-slate-500 uppercase tracking-widest mb-2">
                          Select holders to add ({form.holderIds.length}/{holders.length})
                        </p>
                        {holders.length === 0 ? (
                          <p className="text-xs text-slate-500">
                            No active user has this title yet. Set it via the user&apos;s <span className="text-slate-300">Title</span> field in User Management.
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {holders.map((u) => {
                              const already = activeMemberIds.has(u.id);
                              const checked = form.holderIds.includes(u.id);
                              return (
                                <button
                                  key={u.id}
                                  type="button"
                                  disabled={already}
                                  onClick={() => toggleHolder(u.id)}
                                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors ${already ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5'}`}
                                >
                                  <span className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-brand-teal border-brand-teal' : 'border-slate-300 dark:border-white/25'}`}>
                                    {checked && <Check className="w-3 h-3 text-white" />}
                                  </span>
                                  <span className="min-w-0 truncate">
                                    <span className="text-sm text-slate-200">{u.name}</span>
                                    {u.designation && <span className="text-slate-500 text-xs ml-1.5">— {u.designation}</span>}
                                  </span>
                                  {already && <span className="ml-auto text-[0.65rem] text-slate-500 shrink-0">Already a member</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button onClick={closeAdd} className="px-3.5 py-2 rounded-xl text-sm text-slate-400 hover:text-slate-200 transition-all">Cancel</button>
                <button
                  onClick={() => addMember.mutate()}
                  disabled={!canSubmitAdd || addMember.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-brand-teal disabled:opacity-50 hover:bg-brand-teal-dark transition-all"
                >
                  {addMember.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Add member
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-slate-100">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/10 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}
