/**
 * Client glue for the indicator formula calculator.
 *
 * The structured formula now comes from the template's stored `formulaSpec`
 * (seeded/authored in Setup); this module reads it and computes the result via
 * the SHARED engine — byte-identical to the server. Legacy rows that have no
 * stored spec fall back to a simple auto-derived 2-input ratio.
 *
 * Storage stays API-compatible: numerator inputs multiply into `numeratorValue`,
 * denominator inputs into `denominatorValue`, and the raw per-variable values go
 * as `inputValues` for round-trip editing.
 */
import {
  computeFromSpec, specInputKeys, cleanSamples,
  type FormulaSpec, type SpecTerm, type SpecValues,
} from '@nabh/shared';

export type FormulaType = 'RATIO' | 'MEAN' | 'MEDIAN' | 'CUSTOM';
export type Term = SpecTerm;
export type IndicatorSpec = FormulaSpec;
export { specInputKeys, cleanSamples };

export interface TemplateLike {
  name: string;
  departmentCode?: string | null;
  formulaType: FormulaType | string;
  multiplier: number;
  numeratorLabel: string | null;
  denominatorLabel: string | null;
  formulaSpec?: unknown;
}

const inp = (key: string, label: string): Term => ({ kind: 'input', key, label });

// Auto-derive a simple spec for legacy rows with no stored formulaSpec. Compound
// formulas always carry a stored spec, so there is no hardcoded formula logic here.
function autoSpec(t: TemplateLike): IndicatorSpec {
  if (t.formulaType === 'MEAN' || t.formulaType === 'MEDIAN') return { mode: 'list', stat: t.formulaType };
  if (t.formulaType === 'CUSTOM') return { mode: 'value', key: 'value', label: t.numeratorLabel || 'Value' };
  return {
    mode: 'ratio',
    numerator: [inp('num', t.numeratorLabel || 'Numerator')],
    denominator: [inp('den', t.denominatorLabel || 'Denominator')],
    scale: t.multiplier,
  };
}

/** Prefer the template's stored spec; fall back to auto-derive for un-seeded rows. */
export function buildSpec(t: TemplateLike): IndicatorSpec {
  const s = t.formulaSpec as FormulaSpec | null | undefined;
  if (s && typeof s === 'object' && 'mode' in s) return s;
  return autoSpec(t);
}

function product(terms: Term[], values: SpecValues): number | null {
  let p = 1, saw = false;
  for (const t of terms) {
    if (t.kind === 'const') { p *= t.value; continue; }
    const raw = values[t.key];
    if (raw == null || String(raw).trim() === '') return null;
    const v = Number(raw);
    if (!Number.isFinite(v)) return null;
    p *= v; saw = true;
  }
  return saw ? p : null;
}

export interface SpecResult {
  result: number | null;
  numeratorValue?: number;
  denominatorValue?: number;
  sampleValues?: number[];
}

/** Result via the SHARED engine + the numerator/denominator products for the API payload. */
export function computeSpec(spec: IndicatorSpec, values: Record<string, string>, samples: string[]): SpecResult {
  const result = computeFromSpec(spec, values, samples);
  if (spec.mode === 'list') return { result, sampleValues: cleanSamples(samples) };
  if (spec.mode === 'value') {
    const raw = values[spec.key];
    const v = raw != null && String(raw).trim() !== '' ? Number(raw) : NaN;
    return { result, numeratorValue: Number.isFinite(v) ? v : undefined };
  }
  const num = product(spec.numerator, values);
  const den = product(spec.denominator, values);
  return { result, numeratorValue: num ?? undefined, denominatorValue: den ?? undefined };
}

/** Canonical numeric map of the currently-filled inputs (dirty-checking + save). */
export function filledInputs(spec: IndicatorSpec, values: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of specInputKeys(spec)) {
    const raw = values[k];
    if (raw != null && String(raw).trim() !== '') { const v = Number(raw); if (Number.isFinite(v)) out[k] = v; }
  }
  return out;
}

export function stableStringify(o: Record<string, number>): string {
  return JSON.stringify(Object.keys(o).sort().reduce((a, k) => { a[k] = o[k]; return a; }, {} as Record<string, number>));
}
