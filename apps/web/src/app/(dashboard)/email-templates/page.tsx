'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail, Plus, Loader2, Pencil, Trash2, X, Save, Power, Code2, Eye,
  Bold, Italic, Underline, Heading, List, ListOrdered, Link2, Eraser, Type,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { confirm } from '@/hooks/use-confirm';
import { cn, formatDate } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface EmailTemplate {
  id: string; name: string; description: string | null; subject: string; body: string;
  category: string; isActive: boolean; createdAt: string;
  createdBy: { id: string; name: string } | null;
}

const CATEGORIES = [
  { value: 'MEETING_REMINDER', label: 'Meeting reminder' },
  { value: 'GENERAL', label: 'General' },
];
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

// Placeholders the meeting reminder pipeline substitutes at send time.
const MEETING_VARIABLES = [
  ['{{memberName}}', 'Recipient member name'],
  ['{{committeeName}}', 'Committee name'],
  ['{{meetingTitle}}', 'Meeting title'],
  ['{{meetingDate}}', 'Date (DD/MM/YYYY)'],
  ['{{meetingTime}}', 'Time, if set'],
  ['{{venue}}', 'Venue, if set'],
  ['{{meetingLink}}', 'Join link, if online/hybrid'],
  ['{{mode}}', 'PHYSICAL / ONLINE / HYBRID'],
];

// Realistic values used to render previews (mirrors the server-side variables).
const SAMPLE_VARS: Record<string, string> = {
  memberName: 'Dr. Asha Rao',
  committeeName: 'Hospital Infection Control Committee',
  meetingTitle: 'Q3 Review Meeting',
  meetingDate: '15/07/2026',
  meetingTime: '15:00',
  venue: 'Board Room, 2nd Floor',
  meetingLink: 'https://meet.google.com/abc-defg-hij',
  mode: 'HYBRID',
};

/** Mirror of the server's renderTemplate — substitutes {{var}} tokens, leaves unknowns visible. */
function renderTemplate(input: string, vars: Record<string, string>): string {
  return input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key: string) => (vars[key] ?? m));
}

/** Renders a template's subject + HTML body with sample data, body isolated in a sandboxed iframe. */
function TemplatePreview({ subject, body }: { subject: string; body: string }) {
  const rSubject = renderTemplate(subject, SAMPLE_VARS);
  const rBody = renderTemplate(body, SAMPLE_VARS);
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-white/[0.03] border border-white/6 px-3 py-2">
        <p className="text-[0.7rem] text-slate-600 uppercase tracking-widest font-bold mb-0.5">Subject</p>
        <p className="text-sm text-slate-200">{rSubject || <span className="text-slate-600">—</span>}</p>
      </div>
      <div className="rounded-xl overflow-hidden border border-white/8 bg-white">
        <iframe title="Email preview" srcDoc={rBody} sandbox="" className="w-full h-80 bg-white" />
      </div>
      <p className="text-[0.7rem] text-slate-600">Rendered with sample data — actual emails use each member&apos;s details.</p>
    </div>
  );
}

/**
 * Dependency-free WYSIWYG editor for the email body. Writes HTML so non-technical
 * users never touch markup: a formatting toolbar + click-to-insert variable chips.
 * Uncontrolled contentEditable (initialised once on mount) so the caret never jumps.
 */
function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value || '';
    // Initialise once when the visual editor mounts; React must not re-sync innerHTML
    // on every keystroke or the cursor resets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sync = () => { if (ref.current) onChange(ref.current.innerHTML); };
  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    sync();
  };
  const insertVar = (token: string) => {
    ref.current?.focus();
    document.execCommand('insertText', false, token);
    sync();
  };
  const addLink = () => {
    const url = window.prompt('Link URL', 'https://');
    if (url) exec('createLink', url);
  };

  const Btn = ({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} /* keep the selection while clicking the toolbar */
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-md text-slate-300 hover:text-brand-teal hover:bg-brand-teal/10 transition-all"
    >
      {children}
    </button>
  );

  return (
    <div className="rounded-xl border border-white/8 overflow-hidden">
      <div className="flex items-center gap-0.5 flex-wrap px-2 py-1.5 border-b border-white/8 bg-white/[0.03]">
        <Btn onClick={() => exec('bold')} title="Bold"><Bold className="w-3.5 h-3.5" /></Btn>
        <Btn onClick={() => exec('italic')} title="Italic"><Italic className="w-3.5 h-3.5" /></Btn>
        <Btn onClick={() => exec('underline')} title="Underline"><Underline className="w-3.5 h-3.5" /></Btn>
        <span className="w-px h-4 bg-white/10 mx-1" />
        <Btn onClick={() => exec('formatBlock', 'H2')} title="Heading"><Heading className="w-3.5 h-3.5" /></Btn>
        <Btn onClick={() => exec('insertUnorderedList')} title="Bullet list"><List className="w-3.5 h-3.5" /></Btn>
        <Btn onClick={() => exec('insertOrderedList')} title="Numbered list"><ListOrdered className="w-3.5 h-3.5" /></Btn>
        <Btn onClick={addLink} title="Insert link"><Link2 className="w-3.5 h-3.5" /></Btn>
        <span className="w-px h-4 bg-white/10 mx-1" />
        <Btn onClick={() => exec('removeFormat')} title="Clear formatting"><Eraser className="w-3.5 h-3.5" /></Btn>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        className="min-h-[14rem] max-h-[22rem] overflow-y-auto px-4 py-3 bg-white text-slate-900 text-sm leading-relaxed focus:outline-none [&_h2]:text-lg [&_h2]:font-bold [&_h2]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-600 [&_a]:underline"
      />
      <div className="flex items-center gap-1.5 flex-wrap px-2 py-2 border-t border-white/8 bg-white/[0.03]">
        <span className="text-[0.65rem] text-slate-500 font-semibold uppercase tracking-widest mr-1">Insert:</span>
        {MEETING_VARIABLES.map(([token, desc]) => (
          <button
            key={token}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertVar(token)}
            title={desc}
            className="px-2 py-0.5 rounded-md text-[0.7rem] font-mono text-brand-teal bg-brand-teal/10 border border-brand-teal/20 hover:bg-brand-teal/20 transition-all"
          >
            {token}
          </button>
        ))}
      </div>
    </div>
  );
}

const inputCls =
  'w-full px-3 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/8 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all';

const DEFAULT_BODY = `<div style="font-family:sans-serif;max-width:560px;margin:auto;color:#1e293b;">
  <h2 style="color:#0A1628;">{{meetingTitle}}</h2>
  <p>Hello <strong>{{memberName}}</strong>,</p>
  <p>This is a reminder for the upcoming <strong>{{committeeName}}</strong> meeting:</p>
  <ul>
    <li><strong>Date:</strong> {{meetingDate}} {{meetingTime}}</li>
    <li><strong>Mode:</strong> {{mode}}</li>
    <li><strong>Venue:</strong> {{venue}}</li>
  </ul>
  <p>Please make arrangements to attend.</p>
</div>`;

type FormState = { name: string; description: string; subject: string; body: string; category: string; isActive: boolean };
const EMPTY_FORM: FormState = {
  name: '', description: '', subject: '', body: DEFAULT_BODY, category: 'MEETING_REMINDER', isActive: true,
};

export default function EmailTemplatesPage() {
  const qc = useQueryClient();
  const { data: templates = [], isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ['email-templates'], queryFn: () => api.get('/email-templates'),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['email-templates'] });

  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [previewing, setPreviewing] = useState<EmailTemplate | null>(null);
  const [bodyTab, setBodyTab] = useState<'visual' | 'html' | 'preview'>('visual');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const set = (k: keyof FormState, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const openCreate = () => { setForm(EMPTY_FORM); setBodyTab('visual'); setCreating(true); };
  const openEdit = (t: EmailTemplate) => {
    setForm({ name: t.name, description: t.description ?? '', subject: t.subject, body: t.body, category: t.category, isActive: t.isActive });
    setBodyTab('visual');
    setEditing(t);
  };
  const close = () => { setCreating(false); setEditing(null); };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        subject: form.subject,
        body: form.body,
        category: form.category,
        isActive: form.isActive,
      };
      return editing ? api.patch(`/email-templates/${editing.id}`, payload) : api.post('/email-templates', payload);
    },
    onSuccess: () => { toast.success(editing ? 'Template updated' : 'Template created'); close(); invalidate(); },
    onError: (e) => toast.error('Failed to save', e instanceof ApiError ? e.message : undefined),
  });

  const toggleActive = useMutation({
    mutationFn: (t: EmailTemplate) => api.patch(`/email-templates/${t.id}`, { isActive: !t.isActive }),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error('Failed', e instanceof ApiError ? e.message : undefined),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/email-templates/${id}`),
    onSuccess: () => { toast.success('Template deleted'); invalidate(); },
    onError: (e) => toast.error('Failed', e instanceof ApiError ? e.message : undefined),
  });

  const modalOpen = creating || !!editing;

  return (
    <div className="space-y-6 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-brand-teal/10 border border-brand-teal/20">
            <Mail className="w-5 h-5 text-brand-teal" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-100">Email Templates</h1>
            <p className="text-slate-500 text-sm mt-0.5">Reusable templates for meeting reminders &amp; notifications</p>
          </div>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-teal hover:bg-brand-teal-dark transition-all">
          <Plus className="w-4 h-4" /> New Template
        </button>
      </motion.div>

      {isLoading ? (
        <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-brand-teal" /></div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl py-16 text-center" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <Mail className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No email templates yet.</p>
          <button onClick={openCreate} className="mt-3 text-sm font-semibold text-brand-teal hover:underline">Create your first template</button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-5 flex flex-col gap-3"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-100 truncate">{t.name}</h3>
                    <Badge variant={t.isActive ? 'success' : 'secondary'}>{t.isActive ? 'Active' : 'Inactive'}</Badge>
                    <Badge variant="default">{CATEGORY_LABEL[t.category] ?? t.category}</Badge>
                  </div>
                  {t.description && <p className="text-xs text-slate-500 mt-1">{t.description}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(t)} title="Edit" className="p-1.5 rounded-lg text-slate-500 hover:text-brand-teal hover:bg-brand-teal/10 transition-all">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setPreviewing(t)} title="Preview" className="p-1.5 rounded-lg text-slate-500 hover:text-brand-teal hover:bg-brand-teal/10 transition-all">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => toggleActive.mutate(t)} title={t.isActive ? 'Deactivate' : 'Activate'} className="p-1.5 rounded-lg text-slate-500 hover:text-brand-teal hover:bg-brand-teal/10 transition-all">
                    <Power className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async () => { if (await confirm({ title: 'Delete this template?', message: `"${t.name}" will be permanently deleted and detached from any meetings using it.`, confirmLabel: 'Delete' })) deleteMutation.mutate(t.id); }}
                    title="Delete"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/6 px-3 py-2">
                <p className="text-[0.7rem] text-slate-600 uppercase tracking-widest font-bold mb-0.5">Subject</p>
                <p className="text-xs text-slate-300 truncate">{t.subject}</p>
              </div>
              <p className="text-[0.7rem] text-slate-600">
                {t.createdBy ? `By ${t.createdBy.name} · ` : ''}{formatDate(t.createdAt)}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            onClick={close}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold" style={{ color: 'var(--text-base)' }}>{editing ? 'Edit template' : 'New template'}</h2>
                <button onClick={close} className="p-1.5 rounded-lg hover:bg-white/10 transition-all" style={{ color: 'var(--text-muted)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Name</Label>
                    <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Standard meeting reminder" className={inputCls} style={{ color: 'var(--text-base)' }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={(v) => set('category', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Description (optional)</Label>
                  <input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Short note about when to use this template" className={inputCls} style={{ color: 'var(--text-base)' }} />
                </div>

                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  <input value={form.subject} onChange={(e) => set('subject', e.target.value)} placeholder="e.g. Reminder: {{meetingTitle}} on {{meetingDate}}" className={inputCls} style={{ color: 'var(--text-base)' }} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Email body</Label>
                    <div className="flex items-center gap-0.5 rounded-lg bg-white/5 border border-white/8 p-0.5">
                      {([
                        { id: 'visual', label: 'Visual', icon: Type },
                        { id: 'html', label: 'HTML', icon: Code2 },
                        { id: 'preview', label: 'Preview', icon: Eye },
                      ] as const).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setBodyTab(t.id)}
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
                            bodyTab === t.id ? 'bg-brand-teal text-white' : 'text-slate-400 hover:text-slate-200',
                          )}
                        >
                          <t.icon className="w-3.5 h-3.5" />
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {bodyTab === 'visual' ? (
                    <RichTextEditor value={form.body} onChange={(html) => set('body', html)} />
                  ) : bodyTab === 'html' ? (
                    <textarea
                      value={form.body}
                      onChange={(e) => set('body', e.target.value)}
                      rows={10}
                      spellCheck={false}
                      className={`${inputCls} font-mono text-xs leading-relaxed resize-y`}
                      style={{ color: 'var(--text-base)' }}
                    />
                  ) : (
                    <TemplatePreview subject={form.subject} body={form.body} />
                  )}
                  {bodyTab === 'visual' && (
                    <p className="text-[0.7rem] text-slate-600">
                      Type your message and use the toolbar to format it. Click a variable chip to drop in personalised details.
                    </p>
                  )}
                </div>

                {/* Variable reference (HTML mode only — Visual mode has insert chips) */}
                {bodyTab === 'html' && (
                  <div className="rounded-xl bg-white/[0.03] border border-white/6 p-3">
                    <p className="flex items-center gap-1.5 text-[0.7rem] text-slate-500 uppercase tracking-widest font-bold mb-2">
                      <Code2 className="w-3.5 h-3.5" /> Available variables
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {MEETING_VARIABLES.map(([token, desc]) => (
                        <div key={token} className="flex items-center gap-2 text-[0.7rem]">
                          <code className="text-brand-teal font-mono">{token}</code>
                          <span className="text-slate-600 truncate">{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="w-4 h-4 accent-brand-teal" />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>Active (available for selection on meetings)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button onClick={close} className="px-3.5 py-2 rounded-xl text-sm transition-all" style={{ color: 'var(--text-base)' }}>Cancel</button>
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={!form.name.trim() || !form.subject.trim() || !form.body.trim() || saveMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-brand-teal disabled:opacity-50 hover:bg-brand-teal-dark transition-all"
                >
                  {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editing ? 'Save changes' : 'Create template'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview-only modal (from a card) */}
      <AnimatePresence>
        {previewing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            onClick={() => setPreviewing(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2 text-base font-bold" style={{ color: 'var(--text-base)' }}>
                  <Eye className="w-4 h-4 text-brand-teal" /> {previewing.name}
                </h2>
                <button onClick={() => setPreviewing(null)} className="p-1.5 rounded-lg hover:bg-white/10 transition-all" style={{ color: 'var(--text-muted)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <TemplatePreview subject={previewing.subject} body={previewing.body} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
