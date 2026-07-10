'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Save,
  Send,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Clock,
  ArrowLeft,
  HelpCircle,
} from 'lucide-react';
import Link from 'next/link';
import { api, ApiError, getToken, BASE_URL } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

/* ────────── Types ────────── */

interface SectionMeta {
  sectionCode: string;
  sectionName: string;
  sectionOrder: number;
  checkpointCount: number;
  completed: boolean;
}

interface Checkpoint {
  id: string;
  checkpointCode: string;
  description: string;
  evidenceRequired: string | null;
  maxScore: number;
  sectionCode: string;
  mapping: {
    meRef: string;
    checkpoint: string;
    maxScore: number;
    assessmentMethod: string;
    meansOfVerification: string | null;
    mappingType: string;
    standardCode: string;
    standardName: string;
    standardOrder: number;
  } | null;
}

interface SectionResponse {
  clientCheckpointId: string;
  clientScore: number;
  remarks: string;
  usedMethod?: string; // comma-separated selected methods e.g. "SI,OB"
}

const METHOD_LABELS: Record<string, string> = {
  SI: 'Staff Interview',
  OB: 'Observation',
  RR: 'Record Review',
  PI: 'Patient Interview',
};

/** Parse "SI/OB" or "SI, OB" → ["SI","OB"] */
function parseMethods(raw: string): string[] {
  return raw.split(/[/,\s]+/).map((m) => m.trim().toUpperCase()).filter(Boolean);
}

interface AssessmentDetail {
  id: string;
  status: string;
  assessorId: string;
  assessor: { id: string; name: string; email: string };
  department: { name: string; code: string };
  quarter: string;
  year: number;
  type: string;
  completedSections: number;
  totalSections: number;
  compliancePct: number;
  sections: SectionMeta[];
  institutionAssessment: { id: string; name: string; quarter: string; year: number; type: string } | null;
}

/* ────────── Score button config ────────── */
// Uses CSS vars from globals.css so colours work in both dark + ocean-blue light themes
const SCORE_OPTIONS = [
  {
    value: 0, label: '0', desc: 'Not met',
    activeStyle:   { background: 'var(--score-0-active)', borderColor: 'var(--score-0-border)', color: 'var(--score-0-text)' } as React.CSSProperties,
    inactiveStyle: { background: 'var(--score-0-bg)',     borderColor: 'var(--score-0-border)', color: 'var(--score-0-text)' } as React.CSSProperties,
    activeRing: 'ring-1 ring-red-400/40 scale-[1.04]',
  },
  {
    value: 1, label: '1', desc: 'Partial',
    activeStyle:   { background: 'var(--score-1-active)', borderColor: 'var(--score-1-border)', color: 'var(--score-1-text)' } as React.CSSProperties,
    inactiveStyle: { background: 'var(--score-1-bg)',     borderColor: 'var(--score-1-border)', color: 'var(--score-1-text)' } as React.CSSProperties,
    activeRing: 'ring-1 ring-amber-400/40 scale-[1.04]',
  },
  {
    value: 2, label: '2', desc: 'Fully met',
    activeStyle:   { background: 'var(--score-2-active)', borderColor: 'var(--score-2-border)', color: 'var(--score-2-text)' } as React.CSSProperties,
    inactiveStyle: { background: 'var(--score-2-bg)',     borderColor: 'var(--score-2-border)', color: 'var(--score-2-text)' } as React.CSSProperties,
    activeRing: 'ring-1 ring-emerald-400/40 scale-[1.04]',
  },
] as const;

function scoreColor(pct: number) {
  if (pct >= 80) return '#22C55E';
  if (pct >= 60) return '#F59E0B';
  if (pct >= 40) return '#F97316';
  return '#EF4444';
}

/* ────────── Auto-save debounce ────────── */
function useDebounce<T>(value: T, ms = 1500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debouncedValue;
}

/* ────────── Main wizard component ────────── */

export default function AssessmentWizardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [responses, setResponses] = useState<Record<string, SectionResponse>>({});
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [manualSaving, setManualSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Refs for stale-closure-safe access in event handlers (beforeunload, section change)
  const isDirtyRef = useRef(false);
  const responsesRef = useRef<Record<string, SectionResponse>>({});
  const currentSectionRef = useRef<SectionMeta | undefined>(undefined);
  const checkpointsRef = useRef<Checkpoint[]>([]);

  /* ── Fetch assessment meta (wizard includes sections) ── */
  const { data: assessment, isLoading: assessmentLoading } = useQuery<AssessmentDetail>({
    queryKey: ['assessment-wizard', id],
    queryFn: async () => {
      const data = await api.get<AssessmentDetail>(`/assessments/${id}/wizard`);
      // Auto-start only if this is the owner's own assessment
      const currentUserId = useAuthStore.getState().user?.id;
      if (data.status === 'DRAFT' && data.assessorId === currentUserId) {
        await api.post(`/assessments/${id}/start`, {});
        data.status = 'IN_PROGRESS';
      }
      return data;
    },
  });

  /* ── Read-only when viewing another assessor's assessment ── */
  const isReadOnly = !!assessment && !!user && assessment.assessorId !== user.id;

  /* ── Derived section info ── */
  const sections = assessment?.sections ?? [];
  const currentSection = sections[currentSectionIdx];

  /* ── Fetch section checkpoints ── */
  const { data: checkpoints = [], isLoading: checkpointsLoading } = useQuery<Checkpoint[]>({
    queryKey: ['section-checkpoints', id, currentSection?.sectionCode],
    queryFn: () =>
      api.get(`/assessments/${id}/sections/${currentSection.sectionCode}/checkpoints`),
    enabled: !!currentSection,
  });

  /* ── Fetch existing responses for current section ── */
  const { data: existingResponses } = useQuery<SectionResponse[]>({
    queryKey: ['section-responses', id, currentSection?.sectionCode],
    queryFn: () =>
      api.get(`/assessments/${id}/sections/${currentSection.sectionCode}/responses`),
    enabled: !!currentSection,
  });

  // Keep refs in sync with latest values (must be after derived constants above)
  useEffect(() => { responsesRef.current = responses; }, [responses]);
  useEffect(() => { currentSectionRef.current = currentSection; }, [currentSection]);
  useEffect(() => { checkpointsRef.current = checkpoints; }, [checkpoints]);

  /* ── Populate responses from server when section changes ── */
  useEffect(() => {
    if (existingResponses && currentSection) {
      const map: Record<string, SectionResponse> = {};
      existingResponses.forEach((r) => {
        map[r.clientCheckpointId] = r;
      });
      setResponses((prev) => ({ ...prev, ...map }));
    }
  }, [existingResponses, currentSection?.sectionCode]);

  /* ── Navigate to first incomplete section on load ── */
  useEffect(() => {
    if (assessment?.sections) {
      const firstIncomplete = assessment.sections.findIndex((s) => !s.completed);
      if (firstIncomplete >= 0) setCurrentSectionIdx(firstIncomplete);
    }
  }, [assessment?.sections.length]);

  /* ── Current section's response map ── */
  const sectionResponses = checkpoints.map((cp) => ({
    checkpoint: cp,
    response: responses[cp.id] ?? { clientCheckpointId: cp.id, clientScore: -1, remarks: '' },
  }));

  const allAnswered = sectionResponses.every((r) => r.response.clientScore >= 0);
  const sectionScore = sectionResponses.reduce((sum, r) => sum + Math.max(0, r.response.clientScore), 0);
  const sectionMaxScore = sectionResponses.reduce((sum, r) => sum + r.checkpoint.maxScore, 0);
  const sectionPct = sectionMaxScore > 0 ? (sectionScore / sectionMaxScore) * 100 : 0;

  /* ── Save mutation ── */
  const saveMutation = useMutation({
    mutationFn: (data: { sectionCode: string; responses: SectionResponse[] }) =>
      api.post(`/assessments/${id}/sections/responses`, data),
    onSuccess: () => {
      isDirtyRef.current = false;
      setAutoSaveStatus('saved');
      queryClient.invalidateQueries({ queryKey: ['assessment-wizard', id] });
      setTimeout(() => setAutoSaveStatus('idle'), 3000);
    },
    onError: () => {
      setAutoSaveStatus('error');
    },
  });

  /* ── Auto-save: fires only when user is idle for 5 s AND has unsaved changes ── */
  const debouncedResponses = useDebounce(responses, 5000);

  useEffect(() => {
    if (!currentSectionRef.current || !isDirtyRef.current || isReadOnly) return;
    const sectionData = checkpointsRef.current
      .map((cp) => responsesRef.current[cp.id])
      .filter(Boolean);
    if (sectionData.length === 0) return;

    setAutoSaveStatus('saving');
    saveMutation.mutate({
      sectionCode: currentSectionRef.current.sectionCode,
      responses: sectionData,
    });
  // Only debouncedResponses triggers this — section changes do NOT fire autosave
  }, [debouncedResponses]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Score change handler ── */
  const handleScore = useCallback((checkpointId: string, score: number) => {
    setResponses((prev) => ({
      ...prev,
      [checkpointId]: {
        clientCheckpointId: checkpointId,
        clientScore: score,
        remarks: prev[checkpointId]?.remarks ?? '',
      },
    }));
    isDirtyRef.current = true;
    setAutoSaveStatus('idle');
  }, []);

  const handleRemarks = useCallback((checkpointId: string, remarks: string) => {
    setResponses((prev) => ({
      ...prev,
      [checkpointId]: {
        ...prev[checkpointId],
        clientCheckpointId: checkpointId,
        clientScore: prev[checkpointId]?.clientScore ?? -1,
        remarks,
      },
    }));
    isDirtyRef.current = true;
    setAutoSaveStatus('idle');
  }, []);

  /* Toggle one method on/off; max 2 selected, min 1 when score already set */
  const handleMethod = useCallback((checkpointId: string, method: string, defaultMethod: string) => {
    setResponses((prev) => {
      const current = prev[checkpointId]?.usedMethod ?? defaultMethod;
      const selected = current ? current.split(',').filter(Boolean) : [];
      const idx = selected.indexOf(method);
      let next: string[];
      if (idx >= 0) {
        // deselect — only if more than 1 selected
        next = selected.length > 1 ? selected.filter((m) => m !== method) : selected;
      } else {
        // select — max 2
        next = selected.length < 2 ? [...selected, method] : [selected[1], method];
      }
      return {
        ...prev,
        [checkpointId]: {
          ...prev[checkpointId],
          clientCheckpointId: checkpointId,
          clientScore: prev[checkpointId]?.clientScore ?? -1,
          remarks: prev[checkpointId]?.remarks ?? '',
          usedMethod: next.join(','),
        },
      };
    });
    isDirtyRef.current = true;
    setAutoSaveStatus('idle');
  }, []);

  /* ── Save current section (shared by manual save, section-change, and beforeunload) ── */
  const saveCurrentSection = async (sectionCode: string, sectionData: any[]) => {
    if (sectionData.length === 0) return;
    await api.post(`/assessments/${id}/sections/responses`, {
      sectionCode,
      responses: sectionData,
    });
    isDirtyRef.current = false;
    setAutoSaveStatus('saved');
    queryClient.invalidateQueries({ queryKey: ['assessment-wizard', id] });
    setTimeout(() => setAutoSaveStatus('idle'), 2500);
  };

  /* ── Switch section — saves first if dirty ── */
  const handleSectionChange = async (newIdx: number) => {
    if (isDirtyRef.current && currentSectionRef.current && !isReadOnly) {
      const sectionData = checkpointsRef.current.map((cp) => ({
        clientCheckpointId: cp.id,
        clientScore: responsesRef.current[cp.id]?.clientScore ?? 0,
        remarks: responsesRef.current[cp.id]?.remarks ?? '',
        usedMethod: responsesRef.current[cp.id]?.usedMethod ?? undefined,
      }));
      setAutoSaveStatus('saving');
      try {
        await saveCurrentSection(currentSectionRef.current.sectionCode, sectionData);
      } catch {
        setAutoSaveStatus('error');
        toast.error('Save failed', 'Changes could not be saved before switching.');
      }
    }
    setCurrentSectionIdx(newIdx);
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── Manual save & advance ── */
  const handleSaveAndContinue = async () => {
    if (!currentSection || manualSaving) return;
    setManualSaving(true);
    setAutoSaveStatus('saving');

    const sectionData = checkpoints.map((cp) => ({
      clientCheckpointId: cp.id,
      clientScore: responses[cp.id]?.clientScore ?? 0,
      remarks: responses[cp.id]?.remarks ?? '',
      usedMethod: responses[cp.id]?.usedMethod ?? undefined,
    }));

    try {
      await saveCurrentSection(currentSection.sectionCode, sectionData);
      queryClient.invalidateQueries({ queryKey: ['section-responses', id, currentSection.sectionCode] });

      if (currentSectionIdx < sections.length - 1) {
        setCurrentSectionIdx((i) => i + 1);
        scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setShowSubmitConfirm(true);
      }
    } catch {
      setAutoSaveStatus('error');
      toast.error('Save failed', 'Please try again.');
    } finally {
      setManualSaving(false);
    }
  };

  /* ── Save on page exit if there are unsaved changes ── */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current || isReadOnly || !currentSectionRef.current) return;
      e.preventDefault();
      const sectionData = checkpointsRef.current
        .map((cp) => ({
          clientCheckpointId: cp.id,
          clientScore: responsesRef.current[cp.id]?.clientScore ?? 0,
          remarks: responsesRef.current[cp.id]?.remarks ?? '',
          usedMethod: responsesRef.current[cp.id]?.usedMethod ?? undefined,
        }))
        .filter((r) => r.clientScore >= 0);
      if (sectionData.length === 0) return;
      const token = getToken();
      // keepalive fetch survives page unload
      fetch(`${BASE_URL}/assessments/${id}/sections/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        keepalive: true,
        body: JSON.stringify({
          sectionCode: currentSectionRef.current.sectionCode,
          responses: sectionData,
        }),
      }).catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [id, isReadOnly]); // refs keep this up to date without re-registering

  /* ── Submit assessment ── */
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.post(`/assessments/${id}/submit`);
      toast.success('Assessment submitted', 'Sent to HOD for approval.');
      queryClient.invalidateQueries({ queryKey: ['assessment', id] });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      router.push(`/assessments/${id}`);
    } catch (err) {
      toast.error('Submit failed', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setSubmitting(false);
      setShowSubmitConfirm(false);
    }
  };

  /* ── Loading states ── */
  if (assessmentLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-brand-teal animate-spin" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
        <p className="text-slate-500">Assessment not found.</p>
        <Link href="/assessments" className="text-brand-teal text-sm mt-2 hover:underline">
          Back to list
        </Link>
      </div>
    );
  }

  const overallProgress = sections.length
    ? Math.round((sections.filter((s) => s.completed).length / sections.length) * 100)
    : 0;

  return (
    <div className="w-full">
      {/* ── Read-only banner ── */}
      {isReadOnly && (
        <div className="flex items-center gap-3 mb-4 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.20)' }}>
          <div className="w-2 h-2 rounded-full bg-brand-teal shrink-0" />
          <span className="text-brand-teal-light">
            Preview mode — assessed by <strong>{assessment.assessor.name}</strong>. Scores are read-only.
          </span>
        </div>
      )}

      {/* ── Top header bar ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-4 mb-6 flex-wrap"
      >
        <Link
          href={assessment.institutionAssessment?.id
            ? `/department-assessments/${assessment.institutionAssessment.id}`
            : '/assessments'}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-all border border-transparent hover:border-white/10 mt-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          {assessment.institutionAssessment && (
            <p className="text-xs text-brand-teal/80 font-semibold mb-1 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-teal/60" />
              {assessment.institutionAssessment.name}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-extrabold text-slate-100">
              {assessment.department.name}
            </h1>
            <span className="text-xs text-slate-400 font-mono">{assessment.department.code}</span>
            <span className="text-xs text-slate-600">·</span>
            <span className="text-xs text-slate-500">{assessment.quarter} {assessment.year} · {assessment.type}</span>
          </div>

          {/* Overall progress bar */}
          <div className="flex items-center gap-3 mt-2">
            <Progress value={overallProgress} className="flex-1 h-2" />
            <span className="text-xs text-slate-500 shrink-0 tabular-nums">
              {sections.filter(s => s.completed).length}/{sections.length} sections
            </span>
          </div>
        </div>

        {/* Auto-save indicator / read-only tag */}
        <div className="flex items-center gap-2 text-xs mt-1">
          {isReadOnly && (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg font-semibold text-brand-teal bg-brand-teal/10 border border-brand-teal/20">
              View only
            </span>
          )}
          {!isReadOnly && autoSaveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-slate-500">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving…
            </span>
          )}
          {!isReadOnly && autoSaveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" /> Saved
            </span>
          )}
          {!isReadOnly && autoSaveStatus === 'error' && (
            <span className="flex items-center gap-1 text-red-400">
              <AlertCircle className="w-3 h-3" /> Save failed
            </span>
          )}
          {!isReadOnly && autoSaveStatus === 'idle' && (
            <span className="flex items-center gap-1 text-slate-500">
              <Clock className="w-3 h-3" /> Auto-save on
            </span>
          )}
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-6 lg:items-start" style={{ minHeight: 0 }}>

        {/* ── Section sidebar ── */}
        <div
          className="rounded-2xl lg:sticky lg:top-4 lg:self-start"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            maxHeight: 'calc(100vh - 6rem)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div className="px-4 py-3 border-b border-white/6 shrink-0">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sections</p>
          </div>
          <div className="p-2 overflow-y-auto flex-1">
            {sections.map((section, i) => {
              const isActive = i === currentSectionIdx;
              const isDone = section.completed;
              // Extract area letter from sectionCode e.g. "EMERGENCY-A" → "A"
              const areaLetter = section.sectionCode.split('-').pop() ?? String(i + 1);
              // Strip "A. " style prefix from name so names don't all look the same
              const displayName = section.sectionName.replace(/^[A-Za-z]+\.\s*/, '');
              return (
                <button
                  key={section.sectionCode}
                  onClick={() => handleSectionChange(i)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group cursor-pointer',
                    isActive
                      ? 'bg-brand-teal/10 border border-brand-teal/20 text-brand-teal'
                      : 'hover:bg-white/5 border border-transparent text-slate-500 hover:text-slate-300',
                  )}
                >
                  <div
                    className={cn(
                      'w-6 h-6 rounded-lg flex items-center justify-center text-[0.65rem] font-bold shrink-0 transition-all',
                      isDone
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                        : isActive
                          ? 'bg-brand-teal/20 border border-brand-teal/30 text-brand-teal'
                          : 'bg-white/5 border border-white/10 text-slate-600',
                    )}
                  >
                    {isDone ? <Check className="w-3 h-3" /> : areaLetter}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{displayName || section.sectionName}</p>
                    <p className="text-[0.65rem] text-slate-500 mt-0.5">
                      {section.checkpointCount} items
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Checklist panel ── */}
        <div className="flex flex-col rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', height: 'calc(100vh - 11rem)' }}>
          {/* ── Scrollable content area ── */}
          <div ref={scrollAreaRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

          {/* Section header */}
          {currentSection && (
            <motion.div
              key={currentSection.sectionCode}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(to bottom, #00b4ff, #0284c7)' }} />
                    <span className="text-[0.6rem] font-bold uppercase tracking-widest" style={{ color: '#38bdf8' }}>Area of Concern</span>
                  </div>
                  <h2 className="text-xl font-extrabold text-slate-100 leading-tight">
                    {currentSection.sectionName.replace(/^[A-Za-z]+\.\s*/, '') || currentSection.sectionName}
                  </h2>
                  <p className="text-xs text-slate-600 mt-1">
                    {currentSection.checkpointCount} checkpoints
                  </p>
                </div>
                {sectionMaxScore > 0 && (
                  <div className="flex items-center gap-2">
                    <div
                      className="text-sm font-bold tabular-nums px-3 py-1.5 rounded-xl"
                      style={{
                        color: scoreColor(sectionPct),
                        background: `${scoreColor(sectionPct)}18`,
                        border: `1px solid ${scoreColor(sectionPct)}30`,
                      }}
                    >
                      {sectionScore}/{sectionMaxScore} pts · {sectionPct.toFixed(0)}%
                    </div>
                  </div>
                )}
              </div>

              {/* Section progress */}
              <div className="flex items-center gap-3 mb-5">
                <Progress
                  value={sectionResponses.filter(r => r.response.clientScore >= 0).length / sectionResponses.length * 100}
                  className="flex-1 h-1.5"
                />
                <span className="text-xs text-slate-600 shrink-0 tabular-nums">
                  {sectionResponses.filter(r => r.response.clientScore >= 0).length}/{sectionResponses.length}
                </span>
              </div>
            </motion.div>
          )}

          {/* Assessment method legend */}
          <div className="flex items-center gap-3 flex-wrap px-1 mb-3">
            <span className="text-[0.6rem] font-bold text-slate-600 uppercase tracking-widest shrink-0">Method legend:</span>
            {Object.entries(METHOD_LABELS).map(([code, label]) => (
              <span key={code} className="flex items-center gap-1">
                <span className="px-1.5 py-0.5 rounded text-[0.6rem] font-bold"
                  style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)', color: 'rgba(196,181,253,0.8)' }}>
                  {code}
                </span>
                <span className="text-[0.65rem] text-slate-600">{label}</span>
              </span>
            ))}
          </div>

          {/* Checkpoints */}
          <AnimatePresence mode="wait">
            {checkpointsLoading ? (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl p-5 animate-pulse"
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
                  >
                    <div className="h-3.5 w-3/4 rounded bg-white/5 mb-2" />
                    <div className="h-3 w-1/2 rounded bg-white/5 mb-4" />
                    <div className="flex gap-2">
                      {[0, 1, 2].map((j) => (
                        <div key={j} className="h-10 w-20 rounded-xl bg-white/5" />
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key={currentSection?.sectionCode}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-1"
              >
                {(() => {
                  // Group checkpoints by standard
                  const groups: { standardCode: string; standardName: string; standardOrder: number; items: typeof checkpoints }[] = [];
                  for (const cp of checkpoints) {
                    const code = cp.mapping?.standardCode ?? '';
                    const name = cp.mapping?.standardName ?? '';
                    const order = cp.mapping?.standardOrder ?? 0;
                    let grp = groups.find((g) => g.standardCode === code);
                    if (!grp) { grp = { standardCode: code, standardName: name, standardOrder: order, items: [] }; groups.push(grp); }
                    grp.items.push(cp);
                  }
                  groups.sort((a, b) => a.standardOrder - b.standardOrder);

                  return groups.map((grp, gi) => (
                    <div key={grp.standardCode || 'unmapped'} className="space-y-3">
                      {/* Standard heading */}
                      {grp.standardCode && (
                        <div className="flex items-center gap-3 px-1 pt-4 pb-1">
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="w-0.5 h-4 rounded-full" style={{ background: 'rgba(99,102,241,0.6)' }} />
                            <span className="text-[0.6rem] font-bold uppercase tracking-widest" style={{ color: 'rgba(165,180,252,0.6)' }}>Standard</span>
                            <div className="px-2 py-0.5 rounded-md text-[0.7rem] font-bold font-mono"
                              style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: 'rgba(165,180,252,1)' }}>
                              {grp.standardCode}
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-slate-300">{grp.standardName}</p>
                          <div className="h-px flex-1" style={{ background: 'rgba(99,102,241,0.12)' }} />
                        </div>
                      )}

                      {grp.items.map((cp, i) => {
                  const resp = responses[cp.id];
                  const scored = resp && resp.clientScore >= 0;

                  return (
                    <motion.div
                      key={cp.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={cn(
                        'rounded-2xl p-4 transition-all duration-200',
                        scored ? 'border border-brand-teal/20' : '',
                      )}
                      style={{
                        background: scored ? 'rgba(14,165,233,0.06)' : 'var(--inner-bg)',
                        border: scored ? undefined : '1px solid var(--inner-border)',
                      }}
                    >
                      {/* Checkpoint header */}
                      <div className="flex items-start gap-3 mb-3">
                        <span
                          className="text-[0.65rem] font-bold font-mono text-slate-400 mt-0.5 shrink-0 px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                        >
                          {cp.checkpointCode}
                        </span>
                        <p className="text-sm text-slate-300 leading-relaxed flex-1">
                          {cp.description}
                        </p>
                        {scored && (
                          <CheckCircle2 className="w-4 h-4 text-brand-teal/60 shrink-0 mt-0.5" />
                        )}
                      </div>

                      {/* Evidence hint */}
                      {cp.evidenceRequired && (
                        <div className="flex items-start gap-1.5 mb-3 text-xs text-slate-600">
                          <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500/60" />
                          <span>{cp.evidenceRequired}</span>
                        </div>
                      )}

                      {/* ME ref + method selector */}
                      {cp.mapping && (
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded-md text-[0.65rem] font-bold font-mono shrink-0"
                            style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.15)', color: 'rgba(56,189,248,0.8)' }}>
                            ME {cp.mapping.meRef}
                          </span>
                          {(() => {
                            const defaultMethod = parseMethods(cp.mapping?.assessmentMethod ?? '')[0] ?? 'SI';
                            const selectedRaw = resp?.usedMethod ?? defaultMethod;
                            const selected = selectedRaw ? selectedRaw.split(',').filter(Boolean) : [defaultMethod];
                            return (
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-[0.6rem] text-slate-500 uppercase tracking-widest mr-0.5">Method:</span>
                                {Object.keys(METHOD_LABELS).map((m) => {
                                  const isOn = selected.includes(m);
                                  return (
                                    <button
                                      key={m}
                                      type="button"
                                      title={METHOD_LABELS[m]}
                                      onClick={() => !isReadOnly && handleMethod(cp.id, m, defaultMethod)}
                                      disabled={isReadOnly}
                                      className={cn(
                                        'px-2 py-0.5 rounded text-[0.65rem] font-bold border transition-all',
                                        isReadOnly ? 'cursor-default' : 'cursor-pointer',
                                        isOn
                                          ? 'text-violet-300 bg-violet-500/20 border-violet-400/50'
                                          : 'text-slate-600 bg-white/3 border-white/8',
                                        !isReadOnly && !isOn && 'hover:text-slate-400',
                                      )}
                                    >
                                      {m}
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Means of Verification */}
                      {cp.mapping?.meansOfVerification && (
                        <div className="flex items-start gap-1.5 mb-2 px-2.5 py-1.5 rounded-lg text-xs"
                          style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}>
                          <HelpCircle className="w-3 h-3 shrink-0 mt-0.5 text-amber-500/60" />
                          <div>
                            <span className="text-[0.6rem] font-bold text-amber-500/50 uppercase tracking-widest block mb-0.5">Means of Verification</span>
                            <span className="text-slate-500">{cp.mapping.meansOfVerification}</span>
                          </div>
                        </div>
                      )}

                      {/* Score buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {SCORE_OPTIONS.slice(0, cp.maxScore + 1).map((opt) => {
                          const isSelected = resp?.clientScore === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => !isReadOnly && handleScore(cp.id, opt.value)}
                              disabled={isReadOnly}
                              className={cn(
                                'flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-bold transition-all duration-150',
                                isReadOnly ? 'cursor-default' : 'cursor-pointer',
                                isSelected ? opt.activeRing : '',
                              )}
                              style={{
                                ...(isSelected ? opt.activeStyle : opt.inactiveStyle),
                                opacity: isReadOnly && !isSelected ? 0.45 : 1,
                              }}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                              <span className="text-base leading-none">{opt.label}</span>
                              <span className="text-[0.7rem] font-normal opacity-80">{opt.desc}</span>
                            </button>
                          );
                        })}

                        {/* NA option */}
                        {!cp.mapping && (
                          <span className="text-[0.72rem] text-slate-500 px-2">N/A (unmapped)</span>
                        )}
                      </div>

                      {/* Remarks */}
                      <div className="mt-3">
                        {isReadOnly ? (
                          resp?.remarks ? (
                            <p className="text-xs text-slate-500 italic px-1 mt-1">{resp.remarks}</p>
                          ) : null
                        ) : (
                          <textarea
                            value={resp?.remarks ?? ''}
                            onChange={(e) => handleRemarks(cp.id, e.target.value)}
                            placeholder="Remarks or observations (optional)…"
                            rows={2}
                            className="w-full px-3 py-2 rounded-xl text-xs text-slate-400 bg-white/[0.03] border border-white/6 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-teal/20 focus:border-brand-teal/30 transition-all resize-none"
                          />
                        )}
                      </div>
                    </motion.div>
                  );
                      })}
                      {/* Divider after each standard group */}
                      {gi < groups.length - 1 && (
                        <div className="mt-4 mb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }} />
                      )}
                    </div>
                  ));
                })()}
              </motion.div>
            )}
          </AnimatePresence>

          {/* close scrollable area */}
          </div>

          {/* ── Stepper — always visible ── */}
          {currentSection && !checkpointsLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="shrink-0 flex items-center justify-between px-4 py-3 border-t border-white/8"
              style={{ background: 'var(--sidebar-bg)', backdropFilter: 'blur(8px)' }}
            >
              <button
                type="button"
                onClick={() => handleSectionChange(Math.max(0, currentSectionIdx - 1))}
                disabled={currentSectionIdx === 0 || manualSaving}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ color: 'var(--text-secondary, #94a3b8)', border: '1px solid var(--card-border)', background: 'var(--card-bg)' }}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <div className="flex items-center gap-3">
                {/* Read-only: just a close button */}
                {isReadOnly ? (
                  <Link
                    href={assessment.institutionAssessment?.id
                      ? `/department-assessments/${assessment.institutionAssessment.id}`
                      : '/assessments'}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-white/6 hover:bg-white/10 border border-white/10 transition-all"
                  >
                    Close Preview
                  </Link>
                ) : (
                <>
                {/* Manual save */}
                <button
                  type="button"
                  onClick={handleSaveAndContinue}
                  disabled={manualSaving}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ color: 'var(--text-secondary, #94a3b8)', border: '1px solid var(--card-border)', background: 'var(--card-bg)' }}
                >
                  {manualSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save
                </button>

                {/* Save & continue / finish */}
                {currentSectionIdx < sections.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleSaveAndContinue}
                    disabled={manualSaving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-brand-teal hover:bg-brand-teal-dark hover:shadow-lg hover:shadow-brand-teal/20 hover:scale-[1.02] transition-all disabled:opacity-60 disabled:scale-100"
                  >
                    {manualSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Save & Continue
                    {!manualSaving && <ChevronRight className="w-4 h-4" />}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSubmitConfirm(true)}
                    disabled={manualSaving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-700 to-emerald-500 hover:shadow-lg hover:shadow-emerald-500/20 hover:scale-[1.02] transition-all disabled:opacity-60"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Review & Submit
                  </button>
                )}
                </>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Submit confirmation modal ── */}
      <AnimatePresence>
        {showSubmitConfirm && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowSubmitConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="rounded-3xl p-8 w-full max-w-md"
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--card-border)',
                boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div
                  className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
                  style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}
                >
                  <Send className="w-6 h-6 text-emerald-400" />
                </div>
                <h2 className="text-xl font-extrabold text-slate-100 mb-2">Submit Assessment?</h2>
                <p className="text-slate-500 text-sm leading-relaxed">
                  This will send the assessment to HOD for approval. You won&apos;t be able to edit it after submission.
                </p>
              </div>

              {/* Quick stats */}
              <div
                className="grid grid-cols-3 gap-3 mb-6 p-4 rounded-2xl"
                style={{ background: 'var(--inner-bg)', border: '1px solid var(--inner-border)' }}
              >
                <div className="text-center">
                  <p className="text-xs text-slate-600">Sections</p>
                  <p className="text-lg font-bold text-slate-200">
                    {sections.filter((s) => s.completed).length}/{sections.length}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-600">Compliance</p>
                  <p
                    className="text-lg font-bold tabular-nums"
                    style={{ color: scoreColor(assessment.compliancePct) }}
                  >
                    {assessment.compliancePct.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-600">Period</p>
                  <p className="text-sm font-bold text-slate-300">
                    {assessment.quarter} {assessment.year}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSubmitConfirm(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-slate-400 bg-white/6 hover:bg-white/10 border border-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-700 to-emerald-500 hover:shadow-lg hover:shadow-emerald-500/20 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                  ) : (
                    <><Send className="w-4 h-4" /> Submit Now</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
