/**
 * Indicator formula engine.
 *
 * Turns an Admin's raw inputs into the indicator's result using the rule the
 * Super Admin defined on the template. Pure + dependency-free so it can run on
 * the save path here and be mirrored verbatim on the client for live preview.
 *
 *   RATIO  → (numerator * multiplier) / denominator   (multiplier = 1 / 100 / 1000)
 *   MEAN   → average of sampleValues
 *   MEDIAN → median of sampleValues
 *   CUSTOM → evaluate customExpression with variables n, d, m
 */

export type IndicatorFormulaType = 'RATIO' | 'MEAN' | 'MEDIAN' | 'CUSTOM';

export interface ComputeInput {
  formulaType: IndicatorFormulaType | string;
  multiplier?: number | null;
  numeratorValue?: number | null;
  denominatorValue?: number | null;
  sampleValues?: number[] | null;
  customExpression?: string | null;
}

function clean(values?: number[] | null): number[] {
  return (values ?? []).filter((v) => typeof v === 'number' && Number.isFinite(v));
}

/** Round to 4 decimals to strip floating-point noise; callers format for display. */
function round(n: number): number {
  return Math.round((n + Number.EPSILON) * 1e4) / 1e4;
}

/**
 * Evaluate a CUSTOM expression. Only `n` (numerator), `d` (denominator) and
 * `m` (multiplier) plus arithmetic are allowed — anything else is rejected so a
 * stored expression can never run arbitrary code.
 */
function evalCustom(expr: string | null | undefined, input: ComputeInput): number | null {
  if (!expr || !/^[0-9+\-*/().\s ndm]+$/.test(expr)) return null;
  const n = input.numeratorValue ?? 0;
  const d = input.denominatorValue ?? 0;
  const m = input.multiplier ?? 1;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function('n', 'd', 'm', `"use strict"; return (${expr});`);
    const out = fn(n, d, m);
    return typeof out === 'number' && Number.isFinite(out) ? round(out) : null;
  } catch {
    return null;
  }
}

export function computeIndicator(input: ComputeInput): number | null {
  switch (input.formulaType) {
    case 'RATIO': {
      const n = input.numeratorValue;
      const d = input.denominatorValue;
      if (n == null || d == null || d === 0) return null;
      const m = input.multiplier ?? 1;
      return round((n * m) / d);
    }
    case 'MEAN': {
      const v = clean(input.sampleValues);
      if (!v.length) return null;
      return round(v.reduce((a, b) => a + b, 0) / v.length);
    }
    case 'MEDIAN': {
      const v = clean(input.sampleValues).sort((a, b) => a - b);
      if (!v.length) return null;
      const mid = Math.floor(v.length / 2);
      return round(v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2);
    }
    case 'CUSTOM':
      return evalCustom(input.customExpression, input);
    default:
      return null;
  }
}
