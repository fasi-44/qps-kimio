'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { ArrowLeft, Loader2, Plus, Trash2, ListChecks } from 'lucide-react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { RecurrenceEditor, defaultRule } from '@/components/committees/recurrence-editor';
import { DatePicker } from '@/components/ui/date-picker';
import type { RecurrenceRule } from '@nabh/shared';

const MODES = ['PHYSICAL', 'ONLINE', 'HYBRID'];
const REMINDER_OPTIONS = [
  { hours: 168, label: '1 week before' },
  { hours: 24, label: '1 day before' },
  { hours: 2, label: '2 hours before' },
  { hours: 1, label: '1 hour before' },
];
const inputCls =
  'w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/8 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all';

export default function NewMeetingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user && user.role !== 'ADMIN' && user.role !== 'HOD') router.replace(`/committees/${id}`);
  }, [user, router, id]);

  // Archived / inactive committees are read-only — can't schedule meetings.
  const { data: committee } = useQuery<{ status: string }>({
    queryKey: ['committee', id],
    queryFn: () => api.get(`/committees/${id}`),
  });
  useEffect(() => {
    if (committee && committee.status !== 'ACTIVE') {
      toast.error('Committee is read-only', `This committee is ${committee.status.toLowerCase()}.`);
      router.replace(`/committees/${id}/meetings`);
    }
  }, [committee, router, id]);

  const [pending, setPending] = useState(false);
  // Active templates available for meeting reminders
  const { data: templates = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['email-templates', 'MEETING_REMINDER', 'active'],
    queryFn: () => api.get('/email-templates?category=MEETING_REMINDER&active=true'),
  });

  const [form, setForm] = useState({
    title: '', scheduledDate: '', time: '', venue: '', meetingLink: '', mode: 'PHYSICAL',
    agendaDeadline: '', isRecurring: false,
    sendEmail: false, reminderOffsets: [24] as number[], reminderTemplateId: '',
  });
  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const [recurrence, setRecurrence] = useState<RecurrenceRule | null>(null);
  const startDate = form.scheduledDate ? new Date(form.scheduledDate + 'T00:00:00') : null;
  const toggleRecurring = (checked: boolean) => {
    set('isRecurring', checked);
    if (checked && !recurrence) setRecurrence(defaultRule(startDate ?? new Date()));
  };
  const toggleOffset = (h: number) =>
    setForm((p) => ({
      ...p,
      reminderOffsets: p.reminderOffsets.includes(h)
        ? p.reminderOffsets.filter((x) => x !== h)
        : [...p.reminderOffsets, h].sort((a, b) => b - a),
    }));
  const needsVenue = form.mode === 'PHYSICAL' || form.mode === 'HYBRID';
  const needsLink = form.mode === 'ONLINE' || form.mode === 'HYBRID';

  const [agenda, setAgenda] = useState<{ title: string; description: string }[]>([]);
  const addAgendaRow = () => setAgenda((a) => [...a, { title: '', description: '' }]);
  const updateAgendaRow = (i: number, k: 'title' | 'description', v: string) =>
    setAgenda((a) => a.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));
  const removeAgendaRow = (i: number) => setAgenda((a) => a.filter((_, idx) => idx !== i));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      await api.post(`/committees/${id}/meetings`, {
        title: form.title,
        scheduledDate: new Date(form.scheduledDate).toISOString(),
        time: form.time || undefined,
        mode: form.mode,
        venue: needsVenue ? (form.venue || undefined) : undefined,
        meetingLink: needsLink ? (form.meetingLink || undefined) : undefined,
        agendaDeadline: form.agendaDeadline ? new Date(form.agendaDeadline).toISOString() : undefined,
        isRecurring: form.isRecurring,
        recurrence: form.isRecurring && recurrence ? recurrence : undefined,
        sendEmail: form.sendEmail,
        reminderOffsets: form.sendEmail ? form.reminderOffsets : undefined,
        reminderTemplateId: form.sendEmail && form.reminderTemplateId ? form.reminderTemplateId : undefined,
        agendaItems: (() => {
          const items = agenda
            .filter((a) => a.title.trim())
            .map((a) => ({ title: a.title.trim(), description: a.description.trim() || undefined }));
          return items.length ? items : undefined;
        })(),
      });
      toast.success(form.isRecurring ? 'Recurring meetings scheduled' : 'Meeting scheduled');
      router.push(`/committees/${id}/meetings`);
    } catch (err) {
      toast.error('Failed to schedule', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-6 sm:mb-8">
        <Link href={`/committees/${id}/meetings`} className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-all">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-slate-100">Schedule Meeting</h1>
          <p className="text-slate-500 text-sm mt-0.5">One-time or a recurring series</p>
        </div>
      </motion.div>

      <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} onSubmit={onSubmit} className="space-y-6">
        <div className="rounded-2xl p-4 sm:p-6 space-y-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <div className="space-y-2">
            <Label>Title</Label>
            <input value={form.title} onChange={(e) => set('title', e.target.value)} required placeholder="e.g. Q3 Review Meeting" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <DatePicker value={form.scheduledDate} onChange={(v) => set('scheduledDate', v)} placeholder="Select date" />
            </div>
            <div className="space-y-2">
              <Label>Time (optional)</Label>
              <input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} className={cn(inputCls, '[color-scheme:dark]')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Mode</Label>
            <Select value={form.mode} onValueChange={(v) => set('mode', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {needsVenue && (
            <div className="space-y-2">
              <Label>Venue{form.mode === 'HYBRID' ? ' (optional)' : ''}</Label>
              <input value={form.venue} onChange={(e) => set('venue', e.target.value)} placeholder="e.g. Board Room" className={inputCls} />
            </div>
          )}

          {needsLink && (
            <div className="space-y-2">
              <Label>Meeting link{form.mode === 'HYBRID' ? ' (optional)' : ''}</Label>
              <input
                type="url"
                value={form.meetingLink}
                onChange={(e) => set('meetingLink', e.target.value)}
                placeholder="https://meet.google.com/… or Zoom/Teams URL"
                className={inputCls}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Agenda Submission Deadline (optional)</Label>
            <DatePicker value={form.agendaDeadline} onChange={(v) => set('agendaDeadline', v)} placeholder="Select deadline" />
          </div>

          {/* Agenda items — created already approved & published */}
          <div className="pt-2 border-t border-white/6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-300 font-medium">Agenda items (optional)</span>
              </div>
              <button type="button" onClick={addAgendaRow} className="flex items-center gap-1.5 text-xs font-semibold text-brand-teal hover:underline">
                <Plus className="w-3.5 h-3.5" /> Add item
              </button>
            </div>
            {agenda.length === 0 ? (
              <p className="text-[0.7rem] text-slate-600">Items added here are approved &amp; published immediately on creation.</p>
            ) : (
              <div className="space-y-3">
                {agenda.map((row, i) => (
                  <div key={i} className="rounded-xl border border-white/8 bg-white/[0.02] p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[0.7rem] font-bold text-slate-500">#{i + 1}</span>
                      <input
                        value={row.title}
                        onChange={(e) => updateAgendaRow(i, 'title', e.target.value)}
                        placeholder="Agenda title"
                        className={cn(inputCls, 'flex-1 h-9')}
                      />
                      <button type="button" onClick={() => removeAgendaRow(i)} className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <textarea
                      value={row.description}
                      onChange={(e) => updateAgendaRow(i, 'description', e.target.value)}
                      placeholder="Description (optional)"
                      rows={2}
                      className={cn(inputCls, 'resize-y')}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-white/6 space-y-4">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form.isRecurring} onChange={(e) => toggleRecurring(e.target.checked)} className="w-4 h-4 accent-brand-teal" />
              <span className="text-sm text-slate-300 font-medium">Recurring series</span>
            </label>
            {form.isRecurring && recurrence && (
              <>
                {!form.scheduledDate && <p className="text-xs text-amber-400">Pick a start date above to preview the occurrences.</p>}
                <RecurrenceEditor value={recurrence} onChange={setRecurrence} start={startDate} />
              </>
            )}
          </div>

          <div className="pt-2 border-t border-white/6 space-y-4">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form.sendEmail} onChange={(e) => set('sendEmail', e.target.checked)} className="w-4 h-4 accent-brand-teal" />
              <span className="text-sm text-slate-300 font-medium">Send email reminders to members</span>
            </label>
            {form.sendEmail && (
              <div className="space-y-2">
                <Label>When to send</Label>
                <div className="flex flex-wrap gap-2">
                  {REMINDER_OPTIONS.map((o) => {
                    const active = form.reminderOffsets.includes(o.hours);
                    return (
                      <button
                        key={o.hours}
                        type="button"
                        onClick={() => toggleOffset(o.hours)}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-xs font-medium border transition-all',
                          active
                            ? 'text-brand-teal bg-brand-teal/10 border-brand-teal/30'
                            : 'text-slate-400 border-white/8 hover:bg-white/5',
                        )}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-2 pt-1">
                  <Label>Email template</Label>
                  {templates.length === 0 ? (
                    <p className="text-xs text-amber-400">
                      No active templates.{' '}
                      <Link href="/email-templates" className="underline hover:text-amber-300">Create one</Link>{' '}
                      to send a formatted reminder.
                    </p>
                  ) : (
                    <Select value={form.reminderTemplateId} onValueChange={(v) => set('reminderTemplateId', v)}>
                      <SelectTrigger><SelectValue placeholder="Select a template…" /></SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <p className="text-[0.7rem] text-slate-600">
                  Members are emailed using the selected template when the meeting is scheduled. Selected lead times are stored for reminders before each occurrence.
                </p>
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={pending || !form.title || !form.scheduledDate}
          className={cn(
            'w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all duration-200 disabled:opacity-65 disabled:cursor-not-allowed',
            pending ? 'bg-brand-teal/60' : 'bg-brand-teal hover:bg-brand-teal-dark hover:shadow-xl hover:shadow-brand-teal/20 hover:scale-[1.01]',
          )}
        >
          {pending ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Scheduling…</span> : 'Schedule Meeting →'}
        </button>
      </motion.form>
    </div>
  );
}
