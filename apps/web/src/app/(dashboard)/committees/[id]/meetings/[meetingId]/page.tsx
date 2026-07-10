'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Loader2, MapPin, Video, CalendarDays, XCircle, Save,
  FileText, Plus, Check, X, MessageSquareWarning, Send, Trash2,
  ClipboardCheck, Upload, Undo2, ExternalLink,
  ListTodo, AlertTriangle, Paperclip, RotateCcw, Lock, ArrowRightCircle, Repeat, Pencil, Printer,
} from 'lucide-react';
import { summarizeRecurrence, generateOccurrences, type RecurrenceRule } from '@nabh/shared';
import { api, ApiError, fileUrl as docUrl, fileName } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { confirm } from '@/hooks/use-confirm';
import { formatDate } from '@/lib/utils';
import { FileUpload } from '@/components/ui/file-upload';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Typeahead } from '@/components/ui/typeahead';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth.store';

interface Meeting {
  id: string; title: string; scheduledDate: string; time: string | null;
  venue: string | null; meetingLink: string | null; mode: string; status: string; isRecurring: boolean;
  recurrenceRule: string | null;
  attendanceDocs: string[];
  committee: { id: string; name: string; status: string };
}

/** Render the stored recurrence rule (JSON, or legacy "FREQ:count") as a clear phrase. */
function describeRecurrence(rule: string | null, start: string): string | null {
  if (!rule) return null;
  try {
    const parsed = JSON.parse(rule) as RecurrenceRule;
    const startDate = new Date(start);
    const occ = generateOccurrences(startDate, parsed);
    const span = occ.length > 1 ? ` (${formatDate(occ[0])} → ${formatDate(occ[occ.length - 1])})` : '';
    return `${summarizeRecurrence(parsed, startDate)} · ${occ.length} meeting${occ.length === 1 ? '' : 's'}${span}`;
  } catch {
    const [freq, count] = rule.split(':');
    return `Repeats ${freq?.toLowerCase().replace('_', '-')}${count ? ` · ${count} meetings` : ''}`;
  }
}
interface Member {
  id: string; membershipType: string; nomineeName: string | null;
  positionType: { name: string };
  user: { id: string; name: string } | null;
  designation: { name: string } | null;
}
interface Attendance { memberId: string; status: string }
interface AgendaItem {
  id: string; title: string; description: string | null; status: string;
  reviewComment: string | null; version: number; supportingDocs: string[];
  submittedBy: { id: string; name: string } | null;
}

const AGENDA_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'success' | 'warning'> = {
  SUBMITTED: 'secondary', ACCEPTED: 'success', REJECTED: 'destructive',
  CLARIFICATION_REQUESTED: 'warning', PUBLISHED: 'default',
};

interface MinuteEntry {
  id: string; agendaItemId: string | null;
  discussionSummary: string | null; decisions: string | null; recommendations: string | null;
  agendaItem: { id: string; title: string } | null;
}
interface Minutes {
  id: string; method: 'DIRECT' | 'UPLOAD'; status: string; fileUrl: string | null;
  version: number; publishedAt: string | null;
  approvedBy: { id: string; name: string } | null;
  entries: MinuteEntry[];
}
const MINUTES_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning'> = {
  DRAFT: 'secondary', UNDER_REVIEW: 'warning', APPROVED: 'success', PUBLISHED: 'default',
};
type EntryDraft = { discussionSummary: string; decisions: string; recommendations: string };

interface ActionItemRow {
  id: string; actionCode: string; description: string; status: string; priority: string;
  dueDate: string | null; department: string | null; evidenceUrls: string[];
  isOverdue: boolean; daysOverdue: number;
  responsibleUser: { id: string; name: string } | null;
  meeting: { id: string; title: string } | null;
}
interface UserName { id: string; name: string; designation: string | null }

const ACTION_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  OPEN: 'secondary', IN_PROGRESS: 'warning', PARTIALLY_COMPLETED: 'warning',
  COMPLETED: 'success', CLOSED: 'default', OVERDUE: 'destructive',
};
const PRIORITY_VARIANT: Record<string, 'secondary' | 'warning' | 'destructive'> = {
  LOW: 'secondary', MEDIUM: 'secondary', HIGH: 'warning', CRITICAL: 'destructive',
};
const PROGRESS_STATUSES = ['OPEN', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'COMPLETED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const ATT_STATUSES = ['PRESENT', 'ABSENT', 'LEAVE_OF_ABSENCE', 'INVITED_GUEST'];
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  SCHEDULED: 'default', RESCHEDULED: 'secondary', CANCELLED: 'destructive', COMPLETED: 'secondary',
};

function memberLabel(m: Member) {
  return m.membershipType === 'NOMINATION' ? (m.user?.name ?? m.nomineeName ?? '—') : (m.designation?.name ?? '—');
}

function esc(s: string | null | undefined): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/** Build a clean, print-optimised HTML document for the meeting (committee, agenda, actions). */
function buildMeetingPrintHtml(opts: {
  committeeName: string;
  purpose: string | null;
  meeting: Meeting;
  agenda: AgendaItem[];
  raised: ActionItemRow[];
  carried: ActionItemRow[];
}): string {
  const { committeeName, purpose, meeting, agenda, raised, carried } = opts;

  const metaRows = [
    ['Date', `${formatDate(meeting.scheduledDate)}${meeting.time ? ` · ${meeting.time}` : ''}`],
    ['Mode', meeting.mode],
    meeting.venue ? ['Venue', meeting.venue] : null,
    ['Status', meeting.status],
  ].filter(Boolean) as [string, string][];

  const agendaHtml = agenda.length
    ? `<ol class="agenda">${agenda.map((a) => `
        <li>
          <div class="ag-title">${esc(a.title)} <span class="tag">${esc(a.status.replace(/_/g, ' '))}</span></div>
          ${a.description ? `<div class="ag-desc">${esc(a.description)}</div>` : ''}
          <div class="ag-meta">Submitted by ${esc(a.submittedBy?.name ?? '—')}</div>
        </li>`).join('')}</ol>`
    : `<p class="empty">No agenda items.</p>`;

  const actionRows = (rows: ActionItemRow[], carriedFlag: boolean) => rows.map((a) => `
    <tr>
      <td class="mono">${esc(a.actionCode)}</td>
      <td>${esc(a.description)}${carriedFlag && a.meeting ? `<div class="sub">from ${esc(a.meeting.title)}</div>` : ''}</td>
      <td>${esc(a.responsibleUser?.name ?? 'Unassigned')}</td>
      <td>${esc(a.priority)}</td>
      <td>${esc(a.status.replace(/_/g, ' '))}</td>
      <td>${a.dueDate ? esc(formatDate(a.dueDate)) : '—'}</td>
    </tr>`).join('');

  const actionTable = (title: string, rows: ActionItemRow[], carriedFlag: boolean) => rows.length
    ? `<h3>${esc(title)} (${rows.length})</h3>
       <table class="actions">
         <thead><tr><th>Code</th><th>Description</th><th>Responsible</th><th>Priority</th><th>Status</th><th>Due</th></tr></thead>
         <tbody>${actionRows(rows, carriedFlag)}</tbody>
       </table>`
    : '';

  const actionsHtml = (raised.length || carried.length)
    ? `${actionTable('Raised in this meeting', raised, false)}${actionTable('Carried forward', carried, true)}`
    : `<p class="empty">No action items.</p>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<title>${esc(meeting.title)} — ${esc(committeeName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 32px 36px; font-size: 12.5px; line-height: 1.5; }
  h1 { font-size: 20px; margin: 0 0 2px; color: #0f172a; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin: 26px 0 12px; }
  h3 { font-size: 12.5px; color: #334155; margin: 16px 0 6px; }
  .committee { font-size: 13px; color: #475569; font-weight: 600; margin-bottom: 18px; }
  .purpose { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; color: #334155; }
  table.meta { border-collapse: collapse; margin-top: 4px; }
  table.meta td { padding: 2px 0; vertical-align: top; }
  table.meta td.k { color: #64748b; width: 90px; font-weight: 600; }
  ol.agenda { margin: 0; padding-left: 20px; }
  ol.agenda li { margin-bottom: 10px; }
  .ag-title { font-weight: 600; color: #0f172a; }
  .ag-desc { color: #475569; margin-top: 2px; }
  .ag-meta { color: #94a3b8; font-size: 11px; margin-top: 2px; }
  .tag { display: inline-block; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 5px; padding: 1px 6px; margin-left: 6px; vertical-align: middle; }
  table.actions { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  table.actions th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; border-bottom: 1.5px solid #cbd5e1; padding: 6px 8px; }
  table.actions td { padding: 6px 8px; border-bottom: 1px solid #eef2f6; vertical-align: top; }
  .mono { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 11px; color: #64748b; white-space: nowrap; }
  .sub { color: #94a3b8; font-size: 11px; margin-top: 2px; }
  .empty { color: #94a3b8; font-style: italic; }
  .footer { margin-top: 36px; padding-top: 10px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 10.5px; }
  @media print { body { padding: 0; } @page { margin: 18mm 16mm; } }
</style></head>
<body>
  <h1>${esc(meeting.title)}</h1>
  <div class="committee">${esc(committeeName)}</div>

  ${purpose ? `<h2>Purpose</h2><div class="purpose">${esc(purpose)}</div>` : ''}

  <h2>Meeting Details</h2>
  <table class="meta">${metaRows.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>

  <h2>Agenda</h2>
  ${agendaHtml}

  <h2>Action Items</h2>
  ${actionsHtml}

  <div class="footer">Generated ${esc(formatDate(new Date()))} · ${esc(committeeName)}</div>
  <script>window.onload = function () { window.focus(); window.print(); };</script>
</body></html>`;
}

export default function MeetingDetailPage() {
  const { id, meetingId } = useParams<{ id: string; meetingId: string }>();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'ADMIN' || user?.role === 'HOD';

  const { data: meeting, isLoading } = useQuery<Meeting>({
    queryKey: ['meeting', meetingId], queryFn: () => api.get(`/meetings/${meetingId}`),
  });
  const { data: committee } = useQuery<{ id: string; name: string; purpose: string | null }>({
    queryKey: ['committee', id], queryFn: () => api.get(`/committees/${id}`),
  });
  const { data: membersData } = useQuery<Member[]>({
    queryKey: ['committee-members', id], queryFn: () => api.get(`/committees/${id}/members`),
  });
  const { data: attendanceData } = useQuery<Attendance[]>({
    queryKey: ['meeting-attendance', meetingId], queryFn: () => api.get(`/meetings/${meetingId}/attendance`),
  });
  const members = membersData ?? [];
  const attendance = attendanceData ?? [];

  // Archived / inactive committees are read-only (matches the backend guard).
  const readOnly = !!meeting && meeting.committee.status !== 'ACTIVE';
  const canWrite = canManage && !readOnly;

  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [attendanceDocs, setAttendanceDocs] = useState<string[]>([]);
  // Attendance is captured one of two ways: per-member marking OR an uploaded sheet
  const [attendanceMode, setAttendanceMode] = useState<'MANUAL' | 'UPLOAD'>('MANUAL');
  const attModeInit = useRef(false);
  // Depend on the raw query data (stable refs from react-query), not the `?? []`
  // fallbacks — those mint a new array every render and would loop this effect.
  useEffect(() => {
    const map: Record<string, string> = {};
    (membersData ?? []).forEach((m) => { map[m.id] = 'ABSENT'; });
    (attendanceData ?? []).forEach((a) => { map[a.memberId] = a.status; });
    setStatuses(map);
  }, [membersData, attendanceData]);
  useEffect(() => {
    setAttendanceDocs(meeting?.attendanceDocs ?? []);
    // Pick the initial mode once from saved data; don't fight later user toggles.
    if (meeting && !attModeInit.current) {
      attModeInit.current = true;
      setAttendanceMode((meeting.attendanceDocs?.length ?? 0) > 0 ? 'UPLOAD' : 'MANUAL');
    }
  }, [meeting?.attendanceDocs, meeting]);

  const saveAttendance = useMutation({
    mutationFn: () => api.post(`/meetings/${meetingId}/attendance`, attendanceMode === 'UPLOAD'
      ? { entries: [], attendanceDocs }
      : { entries: members.map((m) => ({ memberId: m.id, status: statuses[m.id] ?? 'ABSENT' })), attendanceDocs: [] }),
    onSuccess: () => {
      toast.success('Attendance saved');
      qc.invalidateQueries({ queryKey: ['meeting-attendance', meetingId] });
      qc.invalidateQueries({ queryKey: ['meeting', meetingId] });
    },
    onError: (e) => toast.error('Failed to save', e instanceof ApiError ? e.message : undefined),
  });

  const cancelMeeting = useMutation({
    mutationFn: () => api.post(`/meetings/${meetingId}/cancel`, {}),
    onSuccess: () => { toast.success('Meeting cancelled'); qc.invalidateQueries({ queryKey: ['meeting', meetingId] }); },
    onError: (e) => toast.error('Failed', e instanceof ApiError ? e.message : undefined),
  });

  // ── Agenda ──
  const { data: agenda = [] } = useQuery<AgendaItem[]>({
    queryKey: ['meeting-agenda', meetingId], queryFn: () => api.get(`/meetings/${meetingId}/agenda`),
  });
  const [agendaForm, setAgendaForm] = useState({ title: '', description: '', supportingDocs: [] as string[] });
  const [addingAgenda, setAddingAgenda] = useState(false);
  const invalidateAgenda = () => qc.invalidateQueries({ queryKey: ['meeting-agenda', meetingId] });

  const submitAgenda = useMutation({
    mutationFn: () => api.post(`/meetings/${meetingId}/agenda`, {
      title: agendaForm.title,
      description: agendaForm.description || undefined,
      supportingDocs: agendaForm.supportingDocs.length ? agendaForm.supportingDocs : undefined,
    }),
    onSuccess: () => { toast.success('Agenda item submitted'); setAgendaForm({ title: '', description: '', supportingDocs: [] }); setAddingAgenda(false); invalidateAgenda(); },
    onError: (e) => toast.error('Failed to submit', e instanceof ApiError ? e.message : undefined),
  });
  const reviewAgenda = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: string }) => api.post(`/agenda/${id}/review`, { decision }),
    onSuccess: () => { toast.success('Agenda updated'); invalidateAgenda(); },
    onError: (e) => toast.error('Failed', e instanceof ApiError ? e.message : undefined),
  });
  const deleteAgenda = useMutation({
    mutationFn: (id: string) => api.delete(`/agenda/${id}`),
    onSuccess: () => { toast.success('Agenda item deleted'); invalidateAgenda(); },
    onError: (e) => toast.error('Failed', e instanceof ApiError ? e.message : undefined),
  });
  const publishAgenda = useMutation({
    mutationFn: () => api.post(`/meetings/${meetingId}/agenda/publish`, {}),
    onSuccess: (r: any) => { toast.success(`Published ${r?.published ?? ''} item(s)`); invalidateAgenda(); },
    onError: (e) => toast.error('Failed to publish', e instanceof ApiError ? e.message : undefined),
  });

  // ── Minutes ──
  const { data: minutes } = useQuery<Minutes | null>({
    queryKey: ['meeting-minutes', meetingId], queryFn: () => api.get(`/meetings/${meetingId}/minutes`),
  });
  const invalidateMinutes = () => qc.invalidateQueries({ queryKey: ['meeting-minutes', meetingId] });

  const [method, setMethod] = useState<'DIRECT' | 'UPLOAD'>('DIRECT');
  const [fileUrl, setFileUrl] = useState('');
  const [entryDrafts, setEntryDrafts] = useState<Record<string, EntryDraft>>({});

  // Direct-entry slots: one per published agenda item, else a single general slot
  const publishedAgenda = agenda.filter((a) => a.status === 'PUBLISHED');
  const minutesSlots = publishedAgenda.length
    ? publishedAgenda.map((a) => ({ key: a.id, agendaItemId: a.id as string | null, title: a.title }))
    : [{ key: 'general', agendaItemId: null as string | null, title: 'General discussion' }];

  useEffect(() => {
    if (minutes) { setMethod(minutes.method); setFileUrl(minutes.fileUrl ?? ''); }
    const drafts: Record<string, EntryDraft> = {};
    (minutes?.entries ?? []).forEach((e) => {
      const key = e.agendaItemId ?? 'general';
      drafts[key] = {
        discussionSummary: e.discussionSummary ?? '', decisions: e.decisions ?? '', recommendations: e.recommendations ?? '',
      };
    });
    setEntryDrafts(drafts);
  }, [minutes]);

  const setEntry = (key: string, field: keyof EntryDraft, value: string) =>
    setEntryDrafts((p) => {
      const cur = p[key] ?? { discussionSummary: '', decisions: '', recommendations: '' };
      return { ...p, [key]: { ...cur, [field]: value } };
    });

  const saveMinutes = useMutation({
    mutationFn: () => api.put(`/meetings/${meetingId}/minutes`, method === 'UPLOAD'
      ? { method: 'UPLOAD', fileUrl }
      : {
          method: 'DIRECT',
          entries: minutesSlots.map((s) => ({
            agendaItemId: s.agendaItemId ?? undefined,
            discussionSummary: entryDrafts[s.key]?.discussionSummary || undefined,
            decisions: entryDrafts[s.key]?.decisions || undefined,
            recommendations: entryDrafts[s.key]?.recommendations || undefined,
          })),
        }),
    onSuccess: () => { toast.success('Minutes saved'); invalidateMinutes(); },
    onError: (e) => toast.error('Failed to save', e instanceof ApiError ? e.message : undefined),
  });

  const transitionMinutes = useMutation({
    mutationFn: (action: string) => api.post(`/meetings/${meetingId}/minutes/transition`, { action }),
    onSuccess: () => { toast.success('Minutes updated'); invalidateMinutes(); },
    onError: (e) => toast.error('Failed', e instanceof ApiError ? e.message : undefined),
  });

  const minutesStatus = minutes?.status ?? null;
  const minutesEditable = canWrite && (!minutes || minutesStatus === 'DRAFT');

  // ── Action items ──
  const { data: actionsData } = useQuery<{ raised: ActionItemRow[]; carriedForward: ActionItemRow[] }>({
    queryKey: ['meeting-actions', meetingId], queryFn: () => api.get(`/meetings/${meetingId}/actions`),
  });
  const { data: actionUsers = [] } = useQuery<UserName[]>({
    queryKey: ['user-names'], queryFn: () => api.get('/users/names'), enabled: canManage,
  });
  const invalidateActions = () => qc.invalidateQueries({ queryKey: ['meeting-actions', meetingId] });

  const [addingAction, setAddingAction] = useState(false);
  const [actionForm, setActionForm] = useState({ description: '', responsibleUserId: '', priority: 'MEDIUM', dueDate: '' });
  // "Carry to this meeting" — pick the new due date in a modal
  const [carryTarget, setCarryTarget] = useState<ActionItemRow | null>(null);
  const [carryDate, setCarryDate] = useState('');
  // "Evidence" — upload supporting documents in a modal
  const [evidenceTarget, setEvidenceTarget] = useState<ActionItemRow | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<string[]>([]);
  // Edit an action item (full CRUD)
  const [editTarget, setEditTarget] = useState<ActionItemRow | null>(null);
  const [editActionForm, setEditActionForm] = useState({ description: '', responsibleUserId: '', priority: 'MEDIUM', dueDate: '' });
  const openEditAction = (a: ActionItemRow) => {
    setEditTarget(a);
    setEditActionForm({
      description: a.description,
      responsibleUserId: a.responsibleUser?.id ?? '',
      priority: a.priority,
      dueDate: a.dueDate ? a.dueDate.slice(0, 10) : '',
    });
  };

  const createAction = useMutation({
    mutationFn: () => api.post(`/committees/${id}/actions`, {
      description: actionForm.description,
      meetingId,
      source: 'AGENDA',
      responsibleUserId: actionForm.responsibleUserId || undefined,
      priority: actionForm.priority,
      dueDate: actionForm.dueDate || undefined,
    }),
    onSuccess: () => { toast.success('Action created'); setActionForm({ description: '', responsibleUserId: '', priority: 'MEDIUM', dueDate: '' }); setAddingAction(false); invalidateActions(); },
    onError: (e) => toast.error('Failed', e instanceof ApiError ? e.message : undefined),
  });
  const updateActionStatus = useMutation({
    mutationFn: ({ actionId, status }: { actionId: string; status: string }) => api.patch(`/actions/${actionId}/status`, { status }),
    onSuccess: () => { toast.success('Status updated'); invalidateActions(); },
    onError: (e) => toast.error('Failed', e instanceof ApiError ? e.message : undefined),
  });
  const addActionEvidence = useMutation({
    mutationFn: ({ actionId, urls }: { actionId: string; urls: string[] }) => api.post(`/actions/${actionId}/evidence`, { evidenceUrls: urls }),
    onSuccess: () => { toast.success('Evidence added'); setEvidenceTarget(null); setEvidenceFiles([]); invalidateActions(); },
    onError: (e) => toast.error('Failed', e instanceof ApiError ? e.message : undefined),
  });
  const closeAction = useMutation({
    mutationFn: (actionId: string) => api.post(`/actions/${actionId}/close`, {}),
    onSuccess: () => { toast.success('Action closed'); invalidateActions(); },
    onError: (e) => toast.error('Failed', e instanceof ApiError ? e.message : undefined),
  });
  const reopenAction = useMutation({
    mutationFn: (actionId: string) => api.post(`/actions/${actionId}/reopen`, {}),
    onSuccess: () => { toast.success('Action reopened'); invalidateActions(); },
    onError: (e) => toast.error('Failed', e instanceof ApiError ? e.message : undefined),
  });
  const carryForward = useMutation({
    mutationFn: ({ actionId, decision, newDueDate }: { actionId: string; decision: string; newDueDate?: string }) =>
      api.post(`/actions/${actionId}/carry-forward`, { decision, newDueDate, toMeetingId: meetingId }),
    onSuccess: () => { toast.success('Action carried forward'); setCarryTarget(null); setCarryDate(''); invalidateActions(); },
    onError: (e) => toast.error('Failed', e instanceof ApiError ? e.message : undefined),
  });
  const updateAction = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch(`/actions/${editTarget!.id}`, data),
    onSuccess: () => { toast.success('Action updated'); setEditTarget(null); invalidateActions(); },
    onError: (e) => toast.error('Failed', e instanceof ApiError ? e.message : undefined),
  });
  const deleteAction = useMutation({
    mutationFn: (actionId: string) => api.delete(`/actions/${actionId}`),
    onSuccess: () => { toast.success('Action deleted'); invalidateActions(); },
    onError: (e) => toast.error('Failed', e instanceof ApiError ? e.message : undefined),
  });

  const renderAction = (a: ActionItemRow, carried: boolean) => {
    const canEditStatus = !readOnly && (canManage || a.responsibleUser?.id === user?.id);
    return (
      <div key={a.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[0.7rem] font-mono text-slate-500">{a.actionCode}</span>
              <span className="text-sm font-semibold text-slate-200">{a.description}</span>
              <Badge variant={PRIORITY_VARIANT[a.priority] ?? 'secondary'}>{a.priority}</Badge>
              <Badge variant={ACTION_STATUS_VARIANT[a.status] ?? 'secondary'}>{a.status.replace(/_/g, ' ')}</Badge>
              {a.isOverdue && (
                <span className="inline-flex items-center gap-1 text-[0.7rem] font-semibold text-red-400">
                  <AlertTriangle className="w-3 h-3" /> {a.daysOverdue}d overdue
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {a.responsibleUser?.name ?? 'Unassigned'}
              {a.dueDate ? ` · due ${formatDate(a.dueDate)}` : ''}
              {a.evidenceUrls.length ? ` · ${a.evidenceUrls.length} evidence` : ''}
              {carried && a.meeting ? ` · from ${a.meeting.title}` : ''}
            </p>
          </div>
          {canWrite && (
            <div className="flex items-center gap-1 shrink-0">
              {a.status !== 'CLOSED' && (
                <button onClick={() => openEditAction(a)} title="Edit" className="p-1.5 rounded-lg text-slate-500 hover:text-brand-teal hover:bg-brand-teal/10 transition-all">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={async () => { if (await confirm({ title: 'Delete this action item?', message: `${a.actionCode} and its history will be permanently deleted.`, confirmLabel: 'Delete' })) deleteAction.mutate(a.id); }}
                title="Delete"
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canEditStatus && a.status !== 'CLOSED' && (
            <div className="w-40">
              <Select value={a.status} onValueChange={(v) => updateActionStatus.mutate({ actionId: a.id, status: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{PROGRESS_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {canEditStatus && a.status !== 'CLOSED' && (
            <button
              onClick={() => { setEvidenceTarget(a); setEvidenceFiles([]); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 bg-white/5 border border-white/8 hover:bg-white/10 transition-all"
            >
              <Paperclip className="w-3 h-3" /> Evidence
            </button>
          )}
          {canWrite && a.status !== 'CLOSED' && (
            <button onClick={() => closeAction.mutate(a.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all">
              <Lock className="w-3 h-3" /> Close
            </button>
          )}
          {canWrite && a.status === 'CLOSED' && (
            <button onClick={() => reopenAction.mutate(a.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all">
              <RotateCcw className="w-3 h-3" /> Reopen
            </button>
          )}
          {canWrite && carried && a.status !== 'CLOSED' && (
            <>
              <button onClick={() => carryForward.mutate({ actionId: a.id, decision: 'ESCALATE' })} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all">
                Escalate
              </button>
              <button
                onClick={() => { setCarryTarget(a); setCarryDate(''); }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 bg-white/5 border border-white/8 hover:bg-white/10 transition-all"
              >
                <ArrowRightCircle className="w-3 h-3" /> Carry to this meeting
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const raised = actionsData?.raised ?? [];
  const carriedForward = actionsData?.carriedForward ?? [];

  const handlePrint = () => {
    if (!meeting) return;
    const html = buildMeetingPrintHtml({
      committeeName: committee?.name ?? meeting.committee.name,
      purpose: committee?.purpose ?? null,
      meeting,
      agenda,
      raised,
      carried: carriedForward,
    });
    const w = window.open('', '_blank');
    if (!w) {
      toast.error('Unable to open print window', 'Please allow pop-ups for this site.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  if (isLoading || !meeting) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-brand-teal" /></div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3">
        <Link href={`/committees/${id}/meetings`} className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-all mt-1">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-extrabold text-slate-100">{meeting.title}</h1>
            <Badge variant={STATUS_VARIANT[meeting.status] ?? 'secondary'}>{meeting.status}</Badge>
            {meeting.isRecurring && <Badge variant="secondary"><Repeat className="w-3 h-3 mr-1" />Recurring</Badge>}
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
            <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{formatDate(meeting.scheduledDate)}{meeting.time ? ` · ${meeting.time}` : ''}</span>
            {meeting.venue && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{meeting.venue}</span>}
            {meeting.meetingLink && (
              <a
                href={meeting.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-brand-teal hover:underline"
              >
                <Video className="w-3.5 h-3.5" />Join link
              </a>
            )}
            <span>{meeting.mode}</span>
          </div>
          {meeting.isRecurring && describeRecurrence(meeting.recurrenceRule, meeting.scheduledDate) && (
            <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
              <Repeat className="w-3 h-3 shrink-0" />{describeRecurrence(meeting.recurrenceRule, meeting.scheduledDate)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrint}
            title="Print / Save as PDF"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-300 hover:text-brand-teal hover:bg-brand-teal/10 border border-white/8 transition-all"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          {canWrite && meeting.status !== 'CANCELLED' && (
            <button
              onClick={async () => {
                if (await confirm({
                  title: 'Cancel this meeting?',
                  message: 'Members will be notified that the meeting is cancelled.',
                  confirmLabel: 'Cancel meeting',
                  cancelLabel: 'Keep',
                })) cancelMeeting.mutate();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-red-400 hover:bg-red-500/10 border border-white/8 transition-all"
            >
              <XCircle className="w-4 h-4" /> Cancel
            </button>
          )}
        </div>
      </motion.div>

      {readOnly && (
        <div className="rounded-2xl px-4 py-3 flex items-center gap-2.5 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
          <Lock className="w-4 h-4 shrink-0" />
          This committee is {meeting.committee.status.toLowerCase()} — meetings are read-only.
        </div>
      )}

      {/* Agenda */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2"><FileText className="w-4 h-4 text-slate-500" />Agenda ({agenda.length})</h2>
          <div className="flex items-center gap-3">
            {canWrite && agenda.some((a) => a.status === 'ACCEPTED') && (
              <button onClick={() => publishAgenda.mutate()} disabled={publishAgenda.isPending} className="flex items-center gap-1.5 text-xs font-semibold text-brand-teal hover:underline disabled:opacity-50">
                <Send className="w-3.5 h-3.5" /> Publish accepted
              </button>
            )}
            {!readOnly && (
              <button onClick={() => setAddingAgenda((v) => !v)} className="flex items-center gap-1.5 text-xs font-semibold text-brand-teal hover:underline">
                <Plus className="w-3.5 h-3.5" /> Add item
              </button>
            )}
          </div>
        </div>

        {addingAgenda && (
          <div className="px-5 py-4 border-b border-white/6 bg-white/[0.02] space-y-3">
            <input
              value={agendaForm.title}
              onChange={(e) => setAgendaForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Agenda title"
              className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/8 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all"
            />
            <textarea
              value={agendaForm.description}
              onChange={(e) => setAgendaForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Description (optional)"
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/8 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all resize-none"
            />
            <div>
              <p className="text-[0.72rem] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Supporting documents (optional)</p>
              <FileUpload value={agendaForm.supportingDocs} onChange={(urls) => setAgendaForm((p) => ({ ...p, supportingDocs: urls }))} />
            </div>
            <p className="text-[0.7rem] text-slate-600">
              Approvers (Chairperson / Vice-Chairperson / Member Secretary / Admin) have their items auto-approved; others go for review.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setAddingAgenda(false)} className="px-3.5 py-2 rounded-xl text-sm text-slate-400 hover:text-slate-200 transition-all">Cancel</button>
              <button onClick={() => submitAgenda.mutate()} disabled={!agendaForm.title || submitAgenda.isPending} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-brand-teal disabled:opacity-50 hover:bg-brand-teal-dark transition-all">
                {submitAgenda.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Submit
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-white/5">
          {agenda.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No agenda items submitted</p>
          ) : (
            agenda.map((a) => {
              const reviewable = canWrite && a.status !== 'PUBLISHED';
              const canDelete = !readOnly && a.status !== 'PUBLISHED' && (user?.role === 'ADMIN' || a.submittedBy?.id === user?.id);
              return (
                <div key={a.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-200">{a.title}</span>
                        <Badge variant={AGENDA_VARIANT[a.status] ?? 'secondary'}>{a.status.replace(/_/g, ' ')}</Badge>
                        {a.version > 1 && <span className="text-[0.65rem] text-slate-600">v{a.version}</span>}
                      </div>
                      {a.description && <p className="text-xs text-slate-500 mt-1">{a.description}</p>}
                      {a.supportingDocs?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {a.supportingDocs.map((u) => (
                            <a key={u} href={docUrl(u)} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.7rem] text-brand-teal bg-brand-teal/10 border border-brand-teal/20 hover:bg-brand-teal/20 transition-all">
                              <Paperclip className="w-3 h-3" />{fileName(u)}
                            </a>
                          ))}
                        </div>
                      )}
                      <p className="text-[0.7rem] text-slate-600 mt-1">Submitted by {a.submittedBy?.name ?? '—'}</p>
                      {a.reviewComment && <p className="text-xs text-amber-400/80 mt-1">Review: {a.reviewComment}</p>}
                    </div>
                    {canDelete && (
                      <button onClick={async () => { if (await confirm({ title: 'Delete this agenda item?', message: `"${a.title}" will be permanently removed.`, confirmLabel: 'Delete' })) deleteAgenda.mutate(a.id); }} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {reviewable && (
                    <div className="flex items-center gap-2 mt-2.5">
                      <button onClick={() => reviewAgenda.mutate({ id: a.id, decision: 'ACCEPTED' })} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all">
                        <Check className="w-3 h-3" /> Accept
                      </button>
                      <button onClick={() => reviewAgenda.mutate({ id: a.id, decision: 'REJECTED' })} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all">
                        <X className="w-3 h-3" /> Reject
                      </button>
                      <button onClick={() => reviewAgenda.mutate({ id: a.id, decision: 'CLARIFICATION_REQUESTED' })} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all">
                        <MessageSquareWarning className="w-3 h-3" /> Clarify
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Attendance */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
          <h2 className="text-sm font-bold text-slate-200">Attendance ({members.length})</h2>
          {canWrite && (
            <button
              onClick={() => saveAttendance.mutate()}
              disabled={saveAttendance.isPending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-brand-teal disabled:opacity-50 hover:bg-brand-teal-dark transition-all"
            >
              {saveAttendance.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </button>
          )}
        </div>
        {/* Mode toggle: mark per-member OR upload a signed sheet */}
        {canWrite && (
          <div className="flex items-center gap-2 px-5 pt-4">
            {(['MANUAL', 'UPLOAD'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setAttendanceMode(m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${attendanceMode === m ? 'text-brand-teal bg-brand-teal/10 border-brand-teal/25' : 'text-slate-400 bg-white/5 border-white/8 hover:text-slate-200'}`}
              >
                {m === 'MANUAL' ? <Check className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
                {m === 'MANUAL' ? 'Mark manually' : 'Upload sheet'}
              </button>
            ))}
          </div>
        )}

        {(canWrite ? attendanceMode === 'UPLOAD' : attendanceDocs.length > 0) ? (
          /* ── Uploaded attendance sheet ── */
          <div className="px-5 py-4 space-y-2">
            {canWrite ? (
              <>
                <FileUpload value={attendanceDocs} onChange={setAttendanceDocs} />
                <p className="text-[0.7rem] text-slate-600">Click <span className="text-slate-400 font-medium">Save</span> above to store the uploaded attendance sheet.</p>
              </>
            ) : (
              <ul className="space-y-1.5">
                {attendanceDocs.map((u) => (
                  <li key={u} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-white/[0.04] border border-white/8">
                    <Paperclip className="w-4 h-4 shrink-0 text-brand-teal" />
                    <a href={docUrl(u)} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 truncate text-slate-200 hover:underline">{fileName(u)}</a>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          /* ── Per-member marking ── */
          <div className="divide-y divide-white/5">
            {members.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                No members on this committee. <Link href={`/committees/${id}`} className="text-brand-teal hover:underline">Add members</Link>
              </p>
            ) : (
              members.map((m) => (
                <div key={m.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-slate-200 truncate">{memberLabel(m)}</span>
                    <span className="text-xs text-slate-500 ml-2">{m.positionType.name}</span>
                  </div>
                  <div className="w-44 shrink-0">
                    <Select
                      value={statuses[m.id] ?? 'ABSENT'}
                      onValueChange={(v) => setStatuses((p) => ({ ...p, [m.id]: v }))}
                      disabled={!canWrite}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ATT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Minutes */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6 flex-wrap gap-3">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-slate-500" />
            Minutes of Meeting
            {minutes && <Badge variant={MINUTES_VARIANT[minutes.status] ?? 'secondary'}>{minutes.status.replace(/_/g, ' ')}</Badge>}
          </h2>
          {canWrite && (
            <div className="flex items-center gap-2">
              {minutesEditable && (
                <button onClick={() => saveMinutes.mutate()} disabled={saveMinutes.isPending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-brand-teal disabled:opacity-50 hover:bg-brand-teal-dark transition-all">
                  {saveMinutes.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                </button>
              )}
              {minutesStatus === 'DRAFT' && (
                <button onClick={() => transitionMinutes.mutate('SUBMIT')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all">
                  <Send className="w-3.5 h-3.5" /> Submit for review
                </button>
              )}
              {minutesStatus === 'UNDER_REVIEW' && (
                <>
                  <button onClick={() => transitionMinutes.mutate('SEND_BACK')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                    <Undo2 className="w-3.5 h-3.5" /> Send back
                  </button>
                  <button onClick={() => transitionMinutes.mutate('APPROVE')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all">
                    <Check className="w-3.5 h-3.5" /> Approve
                  </button>
                </>
              )}
              {minutesStatus === 'APPROVED' && (
                <button onClick={() => transitionMinutes.mutate('PUBLISH')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-brand-teal bg-brand-teal/10 border border-brand-teal/20 hover:bg-brand-teal/20 transition-all">
                  <Send className="w-3.5 h-3.5" /> Publish
                </button>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Method toggle (only while editable) */}
          {minutesEditable && (
            <div className="flex items-center gap-2">
              {(['DIRECT', 'UPLOAD'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${method === m ? 'text-brand-teal bg-brand-teal/10 border-brand-teal/25' : 'text-slate-400 bg-white/5 border-white/8 hover:text-slate-200'}`}
                >
                  {m === 'DIRECT' ? <FileText className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
                  {m === 'DIRECT' ? 'Direct entry' : 'Upload document'}
                </button>
              ))}
            </div>
          )}

          {/* Editable: Upload */}
          {minutesEditable && method === 'UPLOAD' && (
            <FileUpload
              value={fileUrl ? [fileUrl] : []}
              onChange={(urls) => setFileUrl(urls[0] ?? '')}
              multiple={false}
            />
          )}

          {/* Editable: Direct entries */}
          {minutesEditable && method === 'DIRECT' && (
            <div className="space-y-4">
              {minutesSlots.map((s) => (
                <div key={s.key} className="rounded-xl border border-white/8 p-3.5 space-y-2.5">
                  <p className="text-xs font-bold text-slate-300">{s.title}</p>
                  {(['discussionSummary', 'decisions', 'recommendations'] as const).map((field) => (
                    <textarea
                      key={field}
                      value={entryDrafts[s.key]?.[field] ?? ''}
                      onChange={(e) => setEntry(s.key, field, e.target.value)}
                      placeholder={field === 'discussionSummary' ? 'Discussion summary' : field === 'decisions' ? 'Decisions taken' : 'Recommendations'}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.04] border border-white/8 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all resize-none"
                    />
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Read-only view */}
          {minutes && !minutesEditable && (
            <div className="space-y-4">
              {minutes.method === 'UPLOAD' ? (
                minutes.fileUrl ? (
                  <a href={docUrl(minutes.fileUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-brand-teal hover:underline">
                    <ExternalLink className="w-4 h-4" /> {fileName(minutes.fileUrl)}
                  </a>
                ) : <p className="text-sm text-slate-500">No document uploaded</p>
              ) : minutes.entries.length === 0 ? (
                <p className="text-sm text-slate-500">No minute entries recorded</p>
              ) : (
                minutes.entries.map((e) => (
                  <div key={e.id} className="rounded-xl border border-white/8 p-3.5 space-y-2">
                    <p className="text-xs font-bold text-slate-300">{e.agendaItem?.title ?? 'General discussion'}</p>
                    {e.discussionSummary && <p className="text-sm text-slate-400"><span className="text-slate-600">Discussion: </span>{e.discussionSummary}</p>}
                    {e.decisions && <p className="text-sm text-slate-400"><span className="text-slate-600">Decisions: </span>{e.decisions}</p>}
                    {e.recommendations && <p className="text-sm text-slate-400"><span className="text-slate-600">Recommendations: </span>{e.recommendations}</p>}
                  </div>
                ))
              )}
              {minutes.approvedBy && <p className="text-xs text-slate-600">Approved by {minutes.approvedBy.name}{minutes.publishedAt ? ` · published ${formatDate(minutes.publishedAt)}` : ''}</p>}
            </div>
          )}

          {!minutes && !minutesEditable && <p className="text-sm text-slate-500">Minutes have not been recorded yet</p>}
        </div>
      </div>

      {/* Action items */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2"><ListTodo className="w-4 h-4 text-slate-500" />Action Items ({raised.length})</h2>
          {canWrite && (
            <button onClick={() => { setActionForm({ description: '', responsibleUserId: '', priority: 'MEDIUM', dueDate: '' }); setAddingAction(true); }} className="flex items-center gap-1.5 text-xs font-semibold text-brand-teal hover:underline">
              <Plus className="w-3.5 h-3.5" /> Add action
            </button>
          )}
        </div>

        <div className="p-4 space-y-3">
          {raised.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No action items raised in this meeting</p>
          ) : (
            raised.map((a) => renderAction(a, false))
          )}
        </div>

        {carriedForward.length > 0 && (
          <>
            <div className="px-5 py-2.5 bg-white/[0.02] border-y border-white/6">
              <p className="text-xs font-bold text-amber-400/80 uppercase tracking-widest">Carried forward — open items ({carriedForward.length})</p>
            </div>
            <div className="p-4 space-y-3">
              {carriedForward.map((a) => renderAction(a, true))}
            </div>
          </>
        )}
      </div>

      {/* Carry-forward — pick the new due date */}
      <AnimatePresence>
        {carryTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            onClick={() => setCarryTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="w-full max-w-sm rounded-2xl p-6"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-bold" style={{ color: 'var(--text-base)' }}>Carry forward to this meeting</h2>
                <button onClick={() => setCarryTarget(null)} className="p-1.5 rounded-lg hover:bg-white/10 transition-all" style={{ color: 'var(--text-muted)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                <span className="font-mono text-xs">{carryTarget.actionCode}</span> — {carryTarget.description}
              </p>
              <label className="block text-[0.72rem] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>New due date</label>
              <DatePicker value={carryDate} onChange={setCarryDate} placeholder="Select new due date" />
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setCarryTarget(null)} className="px-3.5 py-2 rounded-xl text-sm transition-all" style={{ color: 'var(--text-base)' }}>Cancel</button>
                <button
                  onClick={() => carryForward.mutate({ actionId: carryTarget.id, decision: 'MODIFY_DUE_DATE', newDueDate: carryDate })}
                  disabled={!carryDate || carryForward.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-brand-teal disabled:opacity-50 hover:bg-brand-teal-dark transition-all"
                >
                  {carryForward.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightCircle className="w-4 h-4" />}
                  Carry forward
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add evidence — capture the URL */}
      <AnimatePresence>
        {evidenceTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            onClick={() => setEvidenceTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="w-full max-w-sm rounded-2xl p-6"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-bold" style={{ color: 'var(--text-base)' }}>Add evidence</h2>
                <button onClick={() => setEvidenceTarget(null)} className="p-1.5 rounded-lg hover:bg-white/10 transition-all" style={{ color: 'var(--text-muted)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                <span className="font-mono text-xs">{evidenceTarget.actionCode}</span> — {evidenceTarget.description}
              </p>
              <label className="block text-[0.72rem] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Evidence documents</label>
              <FileUpload value={evidenceFiles} onChange={setEvidenceFiles} />
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setEvidenceTarget(null)} className="px-3.5 py-2 rounded-xl text-sm transition-all" style={{ color: 'var(--text-base)' }}>Cancel</button>
                <button
                  onClick={() => addActionEvidence.mutate({ actionId: evidenceTarget.id, urls: evidenceFiles })}
                  disabled={!evidenceFiles.length || addActionEvidence.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-brand-teal disabled:opacity-50 hover:bg-brand-teal-dark transition-all"
                >
                  {addActionEvidence.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                  Add evidence
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add action item */}
      <AnimatePresence>
        {addingAction && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            onClick={() => setAddingAction(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="w-full max-w-md rounded-2xl p-6"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold" style={{ color: 'var(--text-base)' }}>Add action item</h2>
                <button onClick={() => setAddingAction(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-all" style={{ color: 'var(--text-muted)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[0.72rem] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Description</label>
                  <textarea
                    value={actionForm.description}
                    autoFocus
                    onChange={(e) => setActionForm((p) => ({ ...p, description: e.target.value }))}
                    rows={2}
                    placeholder="What needs to be done?"
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/8 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all resize-y"
                    style={{ color: 'var(--text-base)' }}
                  />
                </div>
                <div>
                  <label className="block text-[0.72rem] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Responsible person</label>
                  <Typeahead
                    value={actionForm.responsibleUserId}
                    onSelect={(v) => setActionForm((p) => ({ ...p, responsibleUserId: v }))}
                    placeholder="Responsible person…"
                    options={actionUsers.map((u) => ({ id: u.id, label: u.name, sublabel: u.designation ?? undefined }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[0.72rem] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Priority</label>
                    <Select value={actionForm.priority} onValueChange={(v) => setActionForm((p) => ({ ...p, priority: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-[0.72rem] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Due date</label>
                    <DatePicker value={actionForm.dueDate} onChange={(v) => setActionForm((p) => ({ ...p, dueDate: v }))} placeholder="Optional" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setAddingAction(false)} className="px-3.5 py-2 rounded-xl text-sm transition-all" style={{ color: 'var(--text-base)' }}>Cancel</button>
                <button
                  onClick={() => createAction.mutate()}
                  disabled={!actionForm.description.trim() || createAction.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-brand-teal disabled:opacity-50 hover:bg-brand-teal-dark transition-all"
                >
                  {createAction.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit action item */}
      <AnimatePresence>
        {editTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            onClick={() => setEditTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="w-full max-w-md rounded-2xl p-6"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold" style={{ color: 'var(--text-base)' }}>Edit action — <span className="font-mono text-xs">{editTarget.actionCode}</span></h2>
                <button onClick={() => setEditTarget(null)} className="p-1.5 rounded-lg hover:bg-white/10 transition-all" style={{ color: 'var(--text-muted)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[0.72rem] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Description</label>
                  <textarea
                    value={editActionForm.description}
                    onChange={(e) => setEditActionForm((p) => ({ ...p, description: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/8 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all resize-y"
                    style={{ color: 'var(--text-base)' }}
                  />
                </div>
                <div>
                  <label className="block text-[0.72rem] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Responsible person</label>
                  <Typeahead
                    value={editActionForm.responsibleUserId}
                    onSelect={(v) => setEditActionForm((p) => ({ ...p, responsibleUserId: v }))}
                    placeholder="Responsible person…"
                    options={actionUsers.map((u) => ({ id: u.id, label: u.name, sublabel: u.designation ?? undefined }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[0.72rem] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Priority</label>
                    <Select value={editActionForm.priority} onValueChange={(v) => setEditActionForm((p) => ({ ...p, priority: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-[0.72rem] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Due date</label>
                    <DatePicker value={editActionForm.dueDate} onChange={(v) => setEditActionForm((p) => ({ ...p, dueDate: v }))} placeholder="Optional" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setEditTarget(null)} className="px-3.5 py-2 rounded-xl text-sm transition-all" style={{ color: 'var(--text-base)' }}>Cancel</button>
                <button
                  onClick={() => updateAction.mutate({
                    description: editActionForm.description,
                    responsibleUserId: editActionForm.responsibleUserId || null,
                    priority: editActionForm.priority,
                    dueDate: editActionForm.dueDate || undefined,
                  })}
                  disabled={!editActionForm.description.trim() || updateAction.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-brand-teal disabled:opacity-50 hover:bg-brand-teal-dark transition-all"
                >
                  {updateAction.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
