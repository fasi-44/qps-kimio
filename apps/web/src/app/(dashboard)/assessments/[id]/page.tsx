'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Edit,
  Download,
  ClipboardList,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  CalendarDays,
  User,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface AssessmentFull {
  id: string;
  status: string;
  institutionAssessmentId?: string | null;
  department: { id: string; name: string; code: string };
  quarter: string;
  year: number;
  type: string;
  assessor: { id: string; name: string; email: string };
  assesseeName: string;
  assessorNames: string[];
  startDate: string;
  endDate: string;
  assessmentDate: string;
  notes: string | null;
  totalNqasScore: number;
  maxNqasScore: number;
  totalClientScore: number;
  maxClientScore: number;
  compliancePct: number;
  completedSections: string[] | number;
  sections: {
    sectionCode: string;
    sectionName: string;
    sectionOrder: number;
    completed: boolean;
    score: number;
    maxScore: number;
    pct: number;
  }[];
  latestReview: {
    action: string;
    remarks: string | null;
    reviewer: { name: string };
    createdAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'warning' | 'success' | 'destructive'; icon: React.ElementType }> = {
  DRAFT:       { label: 'Draft',       variant: 'secondary',    icon: FileText },
  IN_PROGRESS: { label: 'In Progress', variant: 'warning',      icon: Loader2 },
  SUBMITTED:   { label: 'Submitted',   variant: 'default',      icon: ClipboardList },
  APPROVED:    { label: 'Approved',    variant: 'success',      icon: CheckCircle2 },
  REJECTED:    { label: 'Rejected',    variant: 'destructive',  icon: XCircle },
  SENT_BACK:   { label: 'Sent Back',   variant: 'warning',      icon: RotateCcw },
};

function scoreColor(pct: number) {
  if (pct >= 80) return '#22C55E';
  if (pct >= 60) return '#F59E0B';
  if (pct >= 40) return '#F97316';
  return '#EF4444';
}

function ScoreRing({ pct, size = 80 }: { pct: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = scoreColor(pct);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--inner-border)" strokeWidth={7} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} className="score-ring" />
    </svg>
  );
}

export default function AssessmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const qc = useQueryClient();
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | 'sendBack' | null>(null);
  const [reviewPending, setReviewPending] = useState(false);

  // Determine where the back button should go
  // Use browser history if available; otherwise fall back based on data
  const handleBack = (instAssessmentId?: string | null) => {
    if (instAssessmentId) {
      router.push(`/assessment-cycles/${instAssessmentId}`);
    } else {
      router.push('/assessments');
    }
  };

  const { data: assessment, isLoading } = useQuery<AssessmentFull>({
    queryKey: ['assessment', id],
    queryFn: () => api.get(`/assessments/${id}`),
  });

  const { data: scoreBreakdown } = useQuery({
    queryKey: ['assessment-breakdown', id],
    queryFn: () => api.get<{ areas: any[] }>(`/scores/assessment/${id}/breakdown`),
    enabled: !!id,
  });

  const canReview = user?.role === 'HOD' || user?.role === 'ADMIN';
  const canEdit = assessment &&
    ['DRAFT', 'IN_PROGRESS', 'SENT_BACK'].includes(assessment.status) &&
    (user?.role === 'ADMIN' ||
      (user?.role === 'ASSESSOR' && assessment.assessor?.id === user.id));

  const handleReview = async (action: 'approve' | 'reject' | 'sendBack') => {
    setReviewAction(action);
    setReviewPending(true);
    const endpoint = action === 'sendBack' ? 'send-back' : action;
    try {
      await api.post(`/approvals/${id}/${endpoint}`, { remarks: reviewRemarks });
      toast.success(
        action === 'approve' ? 'Assessment approved' : action === 'reject' ? 'Assessment rejected' : 'Sent back for revision',
      );
      qc.invalidateQueries({ queryKey: ['assessment', id] });
      qc.invalidateQueries({ queryKey: ['assessments'] });
      setReviewAction(null);
      setReviewRemarks('');
    } catch (err) {
      toast.error('Action failed', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setReviewPending(false);
    }
  };

  const handleExport = async () => {
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/exports/assessment/${id}/excel`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assessment_${id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 text-brand-teal animate-spin" />
    </div>
  );

  if (!assessment) return null;

  const sc = STATUS_CONFIG[assessment.status] ?? STATUS_CONFIG.DRAFT;

  // completedSections comes from API as string[] (section codes); totalSections = sections.length
  const completedCount = Array.isArray(assessment.completedSections)
    ? (assessment.completedSections as string[]).length
    : (assessment.completedSections as number) ?? 0;
  const totalCount = assessment.sections?.length ?? 0;

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-4 flex-wrap">
        <button
          onClick={() => handleBack(assessment?.institutionAssessmentId)}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-all border border-transparent hover:border-white/10 mt-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-extrabold text-slate-100">{assessment.department.name}</h1>
            <Badge variant={sc.variant}><sc.icon className="w-3 h-3" />{sc.label}</Badge>
          </div>
          <p className="text-slate-500 text-sm mt-1">{assessment.quarter} {assessment.year} · {assessment.type} · {assessment.department.code}</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Link href={`/assessments/${id}/wizard`} className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-300 bg-white/6 hover:bg-white/10 border border-white/10 transition-all">
              <Edit className="w-3.5 h-3.5" /> Continue
            </Link>
          )}
          {!canEdit && user?.role === 'ASSESSOR' && (
            <Link href={`/assessments/${id}/wizard`} className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-brand-teal bg-brand-teal/10 border border-brand-teal/20 hover:bg-brand-teal/15 transition-all">
              Preview Scores
            </Link>
          )}
          {assessment.status === 'APPROVED' && (
            <button onClick={handleExport} className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-300 bg-white/6 hover:bg-white/10 border border-white/10 transition-all">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          )}
        </div>
      </motion.div>

      {/* Score overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid sm:grid-cols-3 gap-4"
      >
        {/* Big score ring */}
        <div
          className="sm:col-span-1 rounded-2xl p-6 flex flex-col items-center justify-center"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        >
          <div className="relative mb-2">
            <ScoreRing pct={assessment.compliancePct} size={96} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black tabular-nums" style={{ color: scoreColor(assessment.compliancePct) }}>
                {assessment.compliancePct.toFixed(1)}%
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-600 text-center">Overall Compliance</p>
          <p className="text-sm font-semibold text-slate-400 mt-1">
            {assessment.totalNqasScore}/{assessment.maxNqasScore} pts
          </p>
        </div>

        {/* Section progress */}
        <div
          className="sm:col-span-2 rounded-2xl p-5"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        >
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Section Scores</p>
          <div className="space-y-3">
            {assessment.sections.slice(0, 6).map((s) => (
              <div key={s.sectionCode} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-36 shrink-0">
                  {s.completed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-white/15 shrink-0" />
                  )}
                  <span className="text-xs text-slate-500 truncate">{s.sectionName}</span>
                </div>
                <div className="flex-1 h-1.5 rounded-full bg-white/6 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${s.pct}%`, background: scoreColor(s.pct) }}
                  />
                </div>
                <span className="text-xs font-semibold tabular-nums w-10 text-right" style={{ color: scoreColor(s.pct) }}>
                  {s.pct.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Meta info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
      >
        {[
          { icon: User, label: 'Assessee', value: assessment.assesseeName },
          { icon: User, label: 'Assessors', value: assessment.assessorNames.join(', ') },
          { icon: CalendarDays, label: 'Period', value: `${new Date(assessment.startDate).toLocaleDateString('en-IN')} – ${new Date(assessment.endDate).toLocaleDateString('en-IN')}` },
          { icon: ClipboardList, label: 'Sections done', value: `${completedCount}/${totalCount}` },
        ].map((item) => (
          <div key={item.label} className="flex items-start gap-2.5">
            <item.icon className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-[0.68rem] text-slate-600 font-medium uppercase tracking-wider">{item.label}</p>
              <p className="text-sm text-slate-300 font-medium mt-0.5">{item.value}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Latest review */}
      {assessment.latestReview && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl p-5"
          style={{
            background: assessment.status === 'APPROVED' ? 'rgba(34,197,94,0.12)' : assessment.status === 'REJECTED' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
            border: `1px solid ${assessment.status === 'APPROVED' ? 'rgba(34,197,94,0.25)' : assessment.status === 'REJECTED' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <sc.icon className="w-4 h-4" style={{ color: assessment.status === 'APPROVED' ? '#22C55E' : assessment.status === 'REJECTED' ? '#EF4444' : '#F59E0B' }} />
            <span className="text-sm font-semibold text-slate-300">
              {sc.label} by {assessment.latestReview.reviewer.name}
            </span>
            <span className="text-xs text-slate-600 ml-auto">
              {new Date(assessment.latestReview.createdAt).toLocaleDateString('en-IN')}
            </span>
          </div>
          {assessment.latestReview.remarks && (
            <p className="text-sm text-slate-400 pl-6">{assessment.latestReview.remarks}</p>
          )}
        </motion.div>
      )}

      {/* Standards compliance table */}
      {scoreBreakdown?.areas && scoreBreakdown.areas.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--card-border)' }}>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Standard-wise Compliance</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[0.72rem]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <th className="text-left px-4 py-2.5 font-bold text-slate-500 w-16">Ref No</th>
                  <th className="text-left px-4 py-2.5 font-bold text-slate-500">Area of Concern &amp; Standards</th>
                  <th className="text-center px-4 py-2.5 font-bold text-slate-500 w-28">NQAS Score</th>
                </tr>
              </thead>
              <tbody>
                {(scoreBreakdown.areas as any[]).map((area: any) => (
                  <React.Fragment key={`area-${area.areaCode}`}>
                    <tr style={{ background: 'var(--inner-bg)', borderBottom: '1px solid var(--card-border)' }}>
                      <td colSpan={3} className="px-4 py-2 font-bold text-slate-400 uppercase tracking-wide text-[0.65rem]">
                        Area {area.areaCode} — {area.areaName}
                        <span className="ml-3 font-mono text-[0.6rem] font-normal text-slate-500">{area.obtained}/{area.max} pts</span>
                      </td>
                    </tr>
                    {(area.standards as any[]).map((std: any) => (
                      <tr key={std.code} style={{ borderBottom: '1px solid var(--inner-border)' }}
                        className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-2 text-center font-mono font-bold text-slate-500">{std.code}</td>
                        <td className="px-4 py-2 text-slate-300">{std.name}</td>
                        <td className="px-4 py-2 text-center">
                          {std.max === 0 ? (
                            <span className="text-slate-600">N/A</span>
                          ) : (
                            <div>
                              <span className="font-bold tabular-nums" style={{ color: std.pct >= 80 ? '#22C55E' : std.pct >= 60 ? '#F59E0B' : std.pct >= 40 ? '#F97316' : '#EF4444' }}>
                                {std.pct}%
                              </span>
                              <div className="text-[0.6rem] text-slate-600 tabular-nums">{std.obtained}/{std.max}</div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* HOD review panel */}
      {canReview && assessment.status === 'SUBMITTED' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl p-6"
          style={{ background: 'var(--card-bg)', border: '1px solid rgba(14,165,233,0.25)' }}
        >
          <h2 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-brand-teal" />
            Review Assessment
          </h2>
          <Textarea
            value={reviewRemarks}
            onChange={(e) => setReviewRemarks(e.target.value)}
            placeholder="Add review remarks (optional)…"
            rows={3}
            className="mb-4"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => handleReview('approve')}
              disabled={reviewPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-700 to-emerald-500 hover:shadow-lg hover:shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              {reviewPending && reviewAction === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Approve
            </button>
            <button
              onClick={() => handleReview('sendBack')}
              disabled={reviewPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-amber-300 bg-amber-500/10 border border-amber-500/25 hover:bg-amber-500/20 transition-all disabled:opacity-50"
            >
              {reviewPending && reviewAction === 'sendBack' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Send Back
            </button>
            <button
              onClick={() => handleReview('reject')}
              disabled={reviewPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-red-400 bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 transition-all disabled:opacity-50"
            >
              {reviewPending && reviewAction === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Reject
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
