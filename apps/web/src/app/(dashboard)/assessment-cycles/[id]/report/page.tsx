'use client';

import { useRef, useState, Fragment } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer, Download, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── Score helpers ────────────────────────────────────────────────────────────

function scoreStyle(pct: number) {
  if (pct >= 80) return { bg: '#f0fdf4', text: '#166534', border: '#86efac', accent: '#22c55e', label: 'Excellent' };
  if (pct >= 60) return { bg: '#fffbeb', text: '#92400e', border: '#fcd34d', accent: '#f59e0b', label: 'Satisfactory' };
  if (pct >= 40) return { bg: '#fff7ed', text: '#9a3412', border: '#fdba74', accent: '#f97316', label: 'Partial' };
  return { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5', accent: '#ef4444', label: 'Poor' };
}

function ScoreCell({ pct, obtained, max }: { pct: number; obtained: number; max: number }) {
  if (max === 0) return (
    <td className="border border-slate-200 px-2 py-2 text-center bg-slate-50">
      <span className="text-[0.65rem] font-semibold text-slate-400">N/A</span>
    </td>
  );
  const s = scoreStyle(pct);
  return (
    <td style={{ background: s.bg, borderColor: '#e2e8f0' }} className="border px-1.5 py-1.5 text-center">
      <div className="text-xs font-black tabular-nums" style={{ color: s.text }}>{pct}%</div>
      <div className="text-[0.55rem] tabular-nums mt-0.5" style={{ color: s.text, opacity: 0.6 }}>{obtained}/{max}</div>
      <div className="mt-1 h-[3px] rounded-full overflow-hidden" style={{ background: `${s.accent}30` }}>
        <div style={{ width: `${pct}%`, background: s.accent }} className="h-full rounded-full" />
      </div>
    </td>
  );
}

// ─── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children, accent = '#1e3a5f' }: { children: React.ReactNode; accent?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div style={{ width: 4, height: 18, background: accent, borderRadius: 2, flexShrink: 0 }} />
      <span className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-600">{children}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface CycleReport {
  institutionAssessment: { name: string; quarter: string; year: number; [k: string]: any };
  departments: any[];
  areas: any[];
  programmeScores: any;
  standardsTable: any;
}

export default function AssessmentCycleReportPage() {
  const { id } = useParams<{ id: string }>();
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['assessment-cycle-report', id],
    queryFn: () => api.get<CycleReport>(`/institution-assessments/${id}/report`),
  });

  const handlePrint = () => window.print();

  const handleDownload = async () => {
    if (!printAreaRef.current || !data) return;
    setDownloading(true);
    try {
      const { toPng } = await import('html-to-image');
      const { default: jsPDF } = await import('jspdf');

      const dataUrl = await toPng(printAreaRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        style: { borderRadius: '0' },
      });

      // Load image to get natural dimensions
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve) => { img.onload = () => resolve(); });

      // Convert px → mm (96 dpi: 1px = 0.2646 mm); divide by pixelRatio
      const toMm = (px: number) => (px / 2) * 0.2646;
      const pdfW = toMm(img.naturalWidth);
      const pdfH = toMm(img.naturalHeight);

      const pdf = new jsPDF({
        orientation: pdfW > pdfH ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [pdfW, pdfH],
      });
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfW, pdfH);

      const { institutionAssessment: ia } = data as any;
      pdf.save(`NQAS-Report-${ia.name}-${ia.quarter}-${ia.year}.pdf`.replace(/\s+/g, '-'));
    } catch {
      // silent
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded bg-white/5" />
        <div className="h-96 rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (!data) return null;

  const { institutionAssessment: ia, departments, areas, programmeScores, standardsTable } = data;

  const hospitalAvg = departments.length > 0
    ? Math.round(departments.reduce((s: number, d: any) => s + d.compliancePct, 0) / departments.length)
    : 0;

  // Dept → area matrix
  const matrix: Record<string, Record<string, { obtained: number; max: number; pct: number }>> = {};
  for (const dept of departments) {
    matrix[dept.departmentCode] = {};
    for (const area of dept.areas) matrix[dept.departmentCode][area.code] = area;
  }

  // Hospital totals per area
  const hospitalAreas: Record<string, { obtained: number; max: number; pct: number }> = {};
  for (const area of areas as any[]) {
    let ob = 0; let mx = 0;
    for (const dept of departments) {
      const s = matrix[dept.departmentCode]?.[area.code];
      if (s) { ob += s.obtained; mx += s.max; }
    }
    hospitalAreas[area.code] = { obtained: ob, max: mx, pct: mx > 0 ? Math.round((ob / mx) * 100) : 0 };
  }

  // Area-of-concern scores per programme
  const PROGS = [
    { key: 'NQAS',    title: 'Hospital Quality Score Card',  subtitle: 'Area of Concern Wise', accent: '#1e3a5f' },
    { key: 'LAQSHYA', title: 'LaQshya Quality Score Card',   subtitle: 'Area of Concern Wise', accent: '#0e7490' },
    { key: 'MUSQAN',  title: 'MusQan Quality Score Card',    subtitle: 'Area of Concern Wise', accent: '#6d28d9' },
  ] as const;

  const progAreaScores: Record<string, {
    areaScores: Record<string, { obtained: number; max: number; pct: number }>;
    total: { obtained: number; max: number; pct: number };
  }> = {};
  for (const { key } of PROGS) {
    const progDepts = departments.filter((d: any) => (d.programmes ?? ['NQAS']).includes(key));
    if (progDepts.length === 0) continue;
    const areaScores: Record<string, { obtained: number; max: number; pct: number }> = {};
    for (const area of areas as any[]) {
      let ob = 0; let mx = 0;
      for (const dept of progDepts) {
        const s = matrix[dept.departmentCode]?.[area.code];
        if (s) { ob += s.obtained; mx += s.max; }
      }
      if (mx > 0) areaScores[area.code] = { obtained: ob, max: mx, pct: Math.round((ob / mx) * 100) };
    }
    const totOb = progDepts.reduce((s: number, d: any) => s + d.totalNqasScore, 0);
    const totMx = progDepts.reduce((s: number, d: any) => s + d.maxNqasScore, 0);
    progAreaScores[key] = {
      areaScores,
      total: { obtained: totOb, max: totMx, pct: totMx > 0 ? Math.round((totOb / totMx) * 100) : 0 },
    };
  }

  const hasLaqshyaStds = (standardsTable as any[])?.some((s: any) => s.laqshya !== null);
  const hasMusqanStds  = (standardsTable as any[])?.some((s: any) => s.musqan  !== null);

  return (
    <>
      {/* ─── Print + theme overrides ─────────────────────────────────── */}
      <style>{`
        @media print {
          nav, aside, header, .no-print { display: none !important; }
          main { padding: 0 !important; }
          .print-page { padding: 16px; box-shadow: none !important; border-radius: 0 !important; }
          body { background: white !important; }
          @page { size: A3 landscape; margin: 12mm; }
          .report-matrix { font-size: 9px; }
        }
        .print-page, .print-page * { color: inherit; }
        .print-page { color: #0f172a !important; }
      `}</style>

      {/* ─── Screen toolbar ─────────────────────────────────────────────── */}
      <div className="no-print mb-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 flex-wrap">
          <Link
            href={`/assessment-cycles/${id}`}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-all border border-transparent hover:border-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-extrabold text-slate-100">{ia.name}</h1>
            <p className="text-slate-500 text-sm">{ia.quarter} {ia.year} · {ia.type}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-white/10 text-slate-300 hover:bg-white/8 transition-all">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-brand-teal/10 border border-brand-teal/25 text-brand-teal hover:bg-brand-teal/15 transition-all disabled:opacity-50"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Download PDF
            </button>
          </div>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          REPORT BODY — white, print-safe
      ═══════════════════════════════════════════════════════════════ */}
      <div
        ref={printAreaRef}
        className="print-page bg-white rounded-2xl overflow-hidden"
        style={{ border: '1px solid #e2e8f0', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}
      >

        {/* ── GRAND HEADER ─────────────────────────────────────────── */}
        <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #1e40af 100%)' }} className="px-8 py-6">
          {/* Gold accent bar */}
          <div style={{ height: 3, background: 'linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b)', borderRadius: 2, marginBottom: 20, opacity: 0.9 }} />

          <div className="flex items-start justify-between gap-6">
            <div>
              <div style={{ color: '#fbbf24', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>
                National Quality Assurance Standards
              </div>
              <h1 style={{ color: '#f8fafc', fontSize: '1.35rem', fontWeight: 900, lineHeight: 1.2, margin: 0 }}>
                NQAS Assessment Report
              </h1>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 4 }}>{ia.name}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                {[
                  { label: 'Quarter', value: `${ia.quarter} ${ia.year}` },
                  { label: 'Type', value: ia.type },
                  { label: 'Departments', value: String(departments.length) },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
                    <span style={{ color: '#f1f5f9', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(255,255,255,0.08)', padding: '2px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Programme score strip */}
          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            {[
              { key: 'NQAS', label: 'Hospital Score', color: '#22c55e' },
              { key: 'LAQSHYA', label: 'LaQshya Score', color: '#38bdf8' },
              { key: 'MUSQAN', label: 'MusQan Score', color: '#a78bfa' },
            ].map(({ key, label, color }) => {
              const s = programmeScores?.[key];
              const active = s && s.deptCount > 0;
              return (
                <div key={key} style={{
                  background: active ? `${color}18` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${active ? color + '40' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 10,
                  padding: '10px 16px',
                  minWidth: 120,
                }}>
                  <div style={{ color: active ? color : '#475569', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
                  <div style={{ color: active ? '#f8fafc' : '#334155', fontSize: '1.4rem', fontWeight: 900, lineHeight: 1, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                    {active ? `${s!.pct}%` : 'N/A'}
                  </div>
                  {active && (
                    <div style={{ color: '#94a3b8', fontSize: '0.6rem', marginTop: 2 }}>
                      {s!.obtained}/{s!.max} pts · {s!.deptCount} depts
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── REPORT CONTENT ────────────────────────────────────────── */}
        <div className="p-6 space-y-7">

          {/* ── 1. Department Wise Score Card ──────────────────────── */}
          {departments.length > 0 && (() => {
            const COLS = 5;
            const chunks: any[][] = [];
            for (let i = 0; i < departments.length; i += COLS) chunks.push((departments as any[]).slice(i, i + COLS));

            const progCards = [
              { key: 'NQAS',    label: 'Hospital Score',  accent: '#1e3a5f', glow: '#1e3a5f' },
              { key: 'LAQSHYA', label: 'LaQshya Score',   accent: '#0e7490', glow: '#0e7490' },
              { key: 'MUSQAN',  label: 'MusQan Score',    accent: '#6d28d9', glow: '#6d28d9' },
            ].filter(({ key }) => programmeScores?.[key]?.deptCount > 0);

            return (
              <div>
                <SectionLabel accent="#1e3a5f">Hospital Score Card — Department Wise</SectionLabel>

                {/* Dept grid table */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                  <table className="w-full border-collapse text-[0.7rem]">
                    <tbody>
                      {chunks.map((chunk, ci) => {
                        const pad = COLS - chunk.length;
                        return (
                          <Fragment key={ci}>
                            <tr style={{ background: '#f8fafc' }}>
                              {chunk.map((dept: any) => (
                                <td key={dept.departmentCode} style={{ border: '1px solid #e2e8f0', color: '#1e293b' }} className="px-2 py-2 text-center font-bold leading-tight min-w-[90px] align-middle">
                                  {dept.departmentName.replace(' Oncology', '').replace(' (MusQan)', '').replace(' (LaQshya)', '')}
                                </td>
                              ))}
                              {Array.from({ length: pad }).map((_, i) => <td key={i} style={{ border: '1px solid #f1f5f9' }} />)}
                            </tr>
                            <tr>
                              {chunk.map((dept: any) => {
                                const pct = Math.round(dept.compliancePct);
                                const s = scoreStyle(pct);
                                return (
                                  <td key={dept.departmentCode} style={{ background: s.bg, color: s.text, border: '1px solid #e2e8f0' }} className="text-center align-middle py-2.5 px-2">
                                    <div style={{ fontSize: '1rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{pct > 0 ? `${pct}%` : '—'}</div>
                                    <div style={{ margin: '4px auto 0', width: '55%', height: 3, background: `${s.accent}30`, borderRadius: 2 }}>
                                      {pct > 0 && <div style={{ width: `${pct}%`, height: '100%', background: s.accent, borderRadius: 2 }} />}
                                    </div>
                                  </td>
                                );
                              })}
                              {Array.from({ length: pad }).map((_, i) => <td key={i} style={{ border: '1px solid #f1f5f9' }} />)}
                            </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Programme summary cards — below the table */}
                {progCards.length > 0 && (
                  <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                    {progCards.map(({ key, label, accent, glow }) => {
                      const s = programmeScores[key];
                      const st = scoreStyle(s.pct);
                      return (
                        <div key={key} style={{
                          flex: 1,
                          background: `linear-gradient(135deg, ${accent} 0%, ${accent}bb 100%)`,
                          borderRadius: 12,
                          padding: '14px 18px',
                          boxShadow: `0 4px 16px ${glow}30`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                        }}>
                          {/* Big score circle */}
                          <div style={{
                            width: 60, height: 60, borderRadius: '50%',
                            background: 'rgba(255,255,255,0.12)',
                            border: '2px solid rgba(255,255,255,0.25)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <span style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{s.pct}%</span>
                          </div>
                          {/* Details */}
                          <div style={{ flex: 1 }}>
                            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>{label}</div>
                            {/* Progress bar */}
                            <div style={{ height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3, marginBottom: 5 }}>
                              <div style={{ width: `${s.pct}%`, height: '100%', background: '#fff', borderRadius: 3, opacity: 0.9 }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.6rem', fontVariantNumeric: 'tabular-nums' }}>{s.obtained}/{s.max} pts</span>
                              <span style={{
                                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: 5, padding: '1px 7px',
                                color: '#fff', fontSize: '0.58rem', fontWeight: 700,
                              }}>{st.label}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── 2. Area of Concern Wise Score Cards (per programme) ── */}
          {PROGS.filter(({ key }) => !!progAreaScores[key]).map(({ key, title, subtitle, accent }) => {
            const { areaScores, total } = progAreaScores[key];
            const activeAreas = (areas as any[]).filter((a) => !!areaScores[a.code]);
            if (activeAreas.length === 0) return null;
            const ACOLS = 4;
            const areaChunks: any[][] = [];
            for (let i = 0; i < activeAreas.length; i += ACOLS) areaChunks.push(activeAreas.slice(i, i + ACOLS));
            // rowSpan covers 2 rows (name + score) × number of chunks
            const totalRows = areaChunks.length * 2;
            const ts = scoreStyle(total.pct);
            const scoreLabel = key === 'NQAS' ? 'Hospital Score' : key === 'MUSQAN' ? 'MusQan Score' : 'LaQshya Score';

            return (
              <div key={key}>
                <SectionLabel accent={accent}>{title} — {subtitle}</SectionLabel>
                <div style={{ border: `2px solid ${accent}22`, borderRadius: 12, overflow: 'hidden', boxShadow: `0 2px 12px ${accent}12` }}>
                  <table className="w-full border-collapse text-[0.7rem]">
                    <tbody>
                      {areaChunks.map((chunk, chunkIdx) => {
                        const pad = ACOLS - chunk.length;
                        return (
                          <Fragment key={chunkIdx}>
                            {/* Area name row */}
                            <tr style={{ background: '#f8fafc' }}>
                              {/* Tall score cell — only rendered on first chunk, spans all rows */}
                              {chunkIdx === 0 && (
                                <td
                                  rowSpan={totalRows}
                                  style={{
                                    background: `linear-gradient(160deg, ${accent} 0%, ${accent}bb 100%)`,
                                    border: `1px solid ${accent}`,
                                    textAlign: 'center',
                                    verticalAlign: 'middle',
                                    padding: '16px 10px',
                                    width: 100,
                                    minWidth: 95,
                                  }}
                                >
                                  <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                                    {scoreLabel}
                                  </div>
                                  <div style={{ color: '#fff', fontSize: '1.75rem', fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                                    {total.pct}%
                                  </div>
                                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.58rem', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
                                    {total.obtained}/{total.max} pts
                                  </div>
                                  {/* Progress bar */}
                                  <div style={{ margin: '10px auto 0', width: '65%', height: 5, background: 'rgba(255,255,255,0.2)', borderRadius: 3 }}>
                                    <div style={{ width: `${total.pct}%`, height: '100%', background: '#fff', borderRadius: 3, opacity: 0.9 }} />
                                  </div>
                                  {/* Score label */}
                                  <div style={{
                                    marginTop: 10, display: 'inline-block',
                                    background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                                    borderRadius: 6, padding: '2px 8px',
                                    color: '#fff', fontSize: '0.58rem', fontWeight: 700,
                                  }}>
                                    {ts.label}
                                  </div>
                                </td>
                              )}
                              {/* Area name cells */}
                              {chunk.map((area: any) => (
                                <td key={area.code} style={{ border: '1px solid #e2e8f0', color: '#1e293b', background: '#f8fafc' }} className="px-2 py-2 text-center font-bold leading-tight min-w-[100px] align-middle">
                                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 6, background: accent, color: '#fff', fontSize: '0.58rem', fontWeight: 900, marginBottom: 4 }}>
                                    {area.code}
                                  </div>
                                  <div style={{ fontSize: '0.68rem', color: '#334155', lineHeight: 1.3 }}>{area.name}</div>
                                </td>
                              ))}
                              {Array.from({ length: pad }).map((_, i) => <td key={i} style={{ border: '1px solid #f1f5f9', background: '#fafafa' }} />)}
                            </tr>
                            {/* Score row */}
                            <tr>
                              {chunk.map((area: any) => {
                                const s2 = areaScores[area.code];
                                const st = scoreStyle(s2.pct);
                                return (
                                  <td key={area.code} style={{ background: st.bg, border: '1px solid #e2e8f0' }} className="text-center align-middle py-2.5 px-2">
                                    <div style={{ color: st.text, fontSize: '1rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{s2.pct}%</div>
                                    <div style={{ color: st.text, fontSize: '0.55rem', opacity: 0.65, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{s2.obtained}/{s2.max}</div>
                                    <div style={{ margin: '5px auto 0', width: '60%', height: 3, background: `${st.accent}30`, borderRadius: 2 }}>
                                      <div style={{ width: `${s2.pct}%`, height: '100%', background: st.accent, borderRadius: 2 }} />
                                    </div>
                                  </td>
                                );
                              })}
                              {Array.from({ length: pad }).map((_, i) => <td key={i} style={{ border: '1px solid #f1f5f9', background: '#fafafa' }} />)}
                            </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {/* ── 3. Department × Area Matrix ───────────────────────── */}
          <div>
            <SectionLabel accent="#334155">Department Wise Compliance Matrix</SectionLabel>
            <div className="overflow-x-auto report-matrix" style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <table className="w-full border-collapse text-[0.7rem]">
                <thead>
                  <tr style={{ background: 'linear-gradient(90deg, #0f172a, #1e3a5f)' }}>
                    <th style={{ color: '#f8fafc', border: '1px solid #334155', padding: '10px 12px', textAlign: 'left', width: 160, fontSize: '0.72rem', fontWeight: 800 }}>
                      Area of Concern
                    </th>
                    {departments.map((dept: any) => (
                      <th key={dept.departmentCode} style={{ color: '#e2e8f0', border: '1px solid #334155', padding: '6px 8px', textAlign: 'center', minWidth: 80, fontWeight: 700 }}>
                        <div style={{ fontSize: '0.6rem', lineHeight: 1.3 }}>
                          {dept.departmentName.replace(' Oncology', '').replace(' (MusQan)', '')}
                        </div>
                        <div style={{ fontSize: '0.5rem', color: '#64748b', fontFamily: 'monospace', marginTop: 2 }}>{dept.departmentCode}</div>
                      </th>
                    ))}
                    <th style={{ color: '#fbbf24', border: '1px solid #334155', padding: '6px 8px', textAlign: 'center', minWidth: 80, fontWeight: 800 }}>
                      <div style={{ fontSize: '0.6rem' }}>Hospital</div>
                      <div style={{ fontSize: '0.5rem', opacity: 0.7 }}>TOTAL</div>
                    </th>
                  </tr>
                  {/* Overall compliance row */}
                  <tr style={{ background: '#f1f5f9' }}>
                    <td style={{ border: '1px solid #e2e8f0', padding: '6px 12px', fontWeight: 700, fontSize: '0.65rem', color: '#475569' }}>
                      Overall Compliance
                    </td>
                    {departments.map((dept: any) => {
                      const pct = Math.round(dept.compliancePct);
                      const s = scoreStyle(pct);
                      return (
                        <td key={dept.departmentCode} style={{ background: s.bg, color: s.text, border: '1px solid #e2e8f0' }} className="text-center py-1.5">
                          <div style={{ fontWeight: 900, fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>{pct > 0 ? `${pct}%` : '—'}</div>
                          <div style={{ fontSize: '0.5rem', opacity: 0.6 }}>Overall</div>
                        </td>
                      );
                    })}
                    {(() => {
                      const s = scoreStyle(hospitalAvg);
                      return (
                        <td style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}`, fontWeight: 900 }} className="text-center py-1.5">
                          <div style={{ fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>{hospitalAvg > 0 ? `${hospitalAvg}%` : '—'}</div>
                          <div style={{ fontSize: '0.5rem', opacity: 0.6 }}>Hospital</div>
                        </td>
                      );
                    })()}
                  </tr>
                </thead>
                <tbody>
                  {(areas as any[]).map((area, ai) => {
                    const h = hospitalAreas[area.code];
                    return (
                      <tr key={area.code} style={{ background: ai % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ border: '1px solid #e2e8f0', padding: '7px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 20, height: 20, borderRadius: 5, background: '#1e3a5f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 900, flexShrink: 0 }}>
                              {area.code}
                            </span>
                            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#1e293b', lineHeight: 1.3 }}>{area.name}</span>
                          </div>
                        </td>
                        {departments.map((dept: any) => {
                          const s = matrix[dept.departmentCode]?.[area.code];
                          return <ScoreCell key={dept.departmentCode} pct={s?.pct ?? 0} obtained={s?.obtained ?? 0} max={s?.max ?? 0} />;
                        })}
                        <ScoreCell pct={h?.pct ?? 0} obtained={h?.obtained ?? 0} max={h?.max ?? 0} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 4. Standards Compliance Table ─────────────────────── */}
          {standardsTable && standardsTable.length > 0 && (() => {
            const areaGroups: Record<string, { areaName: string; standards: any[] }> = {};
            for (const std of standardsTable as any[]) {
              if (!areaGroups[std.areaCode]) areaGroups[std.areaCode] = { areaName: std.areaName, standards: [] };
              areaGroups[std.areaCode].standards.push(std);
            }
            const colCount = 2 + (hasLaqshyaStds ? 1 : 0) + (hasMusqanStds ? 1 : 0);

            return (
              <div>
                <SectionLabel accent="#475569">Standard-wise Compliance</SectionLabel>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                  <table className="w-full border-collapse text-[0.7rem]">
                    <thead>
                      <tr style={{ background: '#1e3a5f' }}>
                        <th style={{ color: '#f8fafc', border: '1px solid #334155', padding: '8px 10px', textAlign: 'left', width: 64, fontWeight: 800 }}>Ref No</th>
                        <th style={{ color: '#f8fafc', border: '1px solid #334155', padding: '8px 12px', textAlign: 'left', fontWeight: 800 }}>Area of Concern &amp; Standards</th>
                        <th style={{ color: '#f8fafc', border: '1px solid #334155', padding: '8px 10px', textAlign: 'center', minWidth: 90, fontWeight: 800 }}>NQAS Score</th>
                        {hasLaqshyaStds && <th style={{ color: '#f8fafc', border: '1px solid #334155', padding: '8px 10px', textAlign: 'center', minWidth: 90, fontWeight: 800 }}>LaQshya Score</th>}
                        {hasMusqanStds  && <th style={{ color: '#f8fafc', border: '1px solid #334155', padding: '8px 10px', textAlign: 'center', minWidth: 90, fontWeight: 800 }}>MusQan Score</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(areaGroups).map(([areaCode, group]) => (
                        <Fragment key={areaCode}>
                          {/* Area header */}
                          <tr style={{ background: 'linear-gradient(90deg, #f1f5f9, #f8fafc)' }}>
                            <td colSpan={colCount} style={{ border: '1px solid #e2e8f0', padding: '7px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 20, height: 20, borderRadius: 5, background: '#334155', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 900, flexShrink: 0 }}>
                                  {areaCode}
                                </span>
                                <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  {group.areaName}
                                </span>
                              </div>
                            </td>
                          </tr>
                          {group.standards.map((std: any, si: number) => (
                            <tr key={std.code} style={{ background: si % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                              <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: '#475569', fontSize: '0.65rem' }}>
                                {std.code}
                              </td>
                              <td style={{ border: '1px solid #e2e8f0', padding: '6px 12px', color: '#334155', lineHeight: 1.4 }}>{std.name}</td>
                              {/* NQAS */}
                              {std.nqas ? (() => { const s = scoreStyle(std.nqas.pct); return (
                                <td style={{ background: s.bg, color: s.text, border: '1px solid #e2e8f0' }} className="text-center py-1.5">
                                  <div style={{ fontWeight: 900, fontSize: '0.75rem' }}>{std.nqas.pct}%</div>
                                  <div style={{ fontSize: '0.55rem', opacity: 0.65 }}>{std.nqas.obtained}/{std.nqas.max}</div>
                                </td>
                              ); })() : (
                                <td style={{ border: '1px solid #e2e8f0', background: '#f8fafc', color: '#94a3b8', textAlign: 'center', fontSize: '0.65rem' }}>N/A</td>
                              )}
                              {hasLaqshyaStds && (std.laqshya ? (() => { const s = scoreStyle(std.laqshya.pct); return (
                                <td style={{ background: s.bg, color: s.text, border: '1px solid #e2e8f0' }} className="text-center py-1.5">
                                  <div style={{ fontWeight: 900, fontSize: '0.75rem' }}>{std.laqshya.pct}%</div>
                                  <div style={{ fontSize: '0.55rem', opacity: 0.65 }}>{std.laqshya.obtained}/{std.laqshya.max}</div>
                                </td>
                              ); })() : (
                                <td style={{ border: '1px solid #e2e8f0', background: '#f8fafc', color: '#94a3b8', textAlign: 'center', fontSize: '0.65rem' }}>N/A</td>
                              ))}
                              {hasMusqanStds && (std.musqan ? (() => { const s = scoreStyle(std.musqan.pct); return (
                                <td style={{ background: s.bg, color: s.text, border: '1px solid #e2e8f0' }} className="text-center py-1.5">
                                  <div style={{ fontWeight: 900, fontSize: '0.75rem' }}>{std.musqan.pct}%</div>
                                  <div style={{ fontSize: '0.55rem', opacity: 0.65 }}>{std.musqan.obtained}/{std.musqan.max}</div>
                                </td>
                              ); })() : (
                                <td style={{ border: '1px solid #e2e8f0', background: '#f8fafc', color: '#94a3b8', textAlign: 'center', fontSize: '0.65rem' }}>N/A</td>
                              ))}
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ── Legend + Footer ───────────────────────────────────── */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Legend:</span>
              {[
                { label: 'Excellent ≥80%', pct: 85 },
                { label: 'Satisfactory ≥60%', pct: 65 },
                { label: 'Partial ≥40%', pct: 45 },
                { label: 'Poor <40%', pct: 20 },
              ].map(({ label, pct }) => {
                const s = scoreStyle(pct);
                return (
                  <div key={label} style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}`, borderRadius: 6, padding: '3px 9px', fontSize: '0.6rem', fontWeight: 700 }}>
                    {label}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: '0.6rem', color: '#94a3b8', textAlign: 'right' }}>
              <div style={{ fontWeight: 600 }}>Generated by NQAS Platform</div>
              <div>{ia.name} · {ia.quarter} {ia.year} · {new Date().toLocaleDateString('en-IN')}</div>
            </div>
          </div>

        </div>{/* /content */}
      </div>{/* /report body */}
    </>
  );
}
