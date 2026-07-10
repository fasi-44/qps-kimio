/**
 * Indicator formula engine — the single source of truth for how a structured
 * formula is validated and computed. Shared by the API (persisting entries) and
 * the web (live calculator preview) so the two can never drift.
 *
 * A `FormulaSpec` captures the shape of the calculation as data:
 *   ratio → (product of numerator inputs × scale) ÷ (product of denominator inputs)
 *   list  → mean / median of a list of sample values
 *   value → the single entered value (a count / measured figure)
 *
 * NOTE (Phase 0): this module is intentionally dormant — nothing imports it yet.
 * Later phases wire it into the API compute path and the web calculator.
 */

export type SpecTerm =
  | { kind: 'input'; key: string; label: string }
  | { kind: 'const'; value: number };

export type FormulaSpec =
  | { mode: 'ratio'; numerator: SpecTerm[]; denominator: SpecTerm[]; scale: number }
  | { mode: 'list'; stat: 'MEAN' | 'MEDIAN' }
  | { mode: 'value'; key: string; label: string };

/** Entered values, keyed by input variable. Accepts strings (web drafts) or numbers (API). */
export type SpecValues = Record<string, number | string | null | undefined>;

/** Round to 4 dp to strip floating-point noise (matches the existing compute). */
const round = (n: number): number => Math.round((n + Number.EPSILON) * 1e4) / 1e4;

function toNumber(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Every input variable key the spec expects (deterministic order). */
export function specInputKeys(spec: FormulaSpec): string[] {
  if (spec.mode === 'value') return [spec.key];
  if (spec.mode === 'list') return [];
  return [...spec.numerator, ...spec.denominator]
    .filter((t): t is Extract<SpecTerm, { kind: 'input' }> => t.kind === 'input')
    .map((t) => t.key);
}

/** Multiply a run of terms; null if any referenced input is missing/invalid. */
function product(terms: SpecTerm[], values: SpecValues): number | null {
  let p = 1;
  let sawInput = false;
  for (const t of terms) {
    if (t.kind === 'const') { p *= t.value; continue; }
    const n = toNumber(values[t.key]);
    if (n === null) return null;
    p *= n;
    sawInput = true;
  }
  return sawInput ? p : null;
}

export function cleanSamples(samples: Array<number | string>): number[] {
  return samples.map(toNumber).filter((n): n is number => n !== null);
}

/** Compute the indicator's result from its spec + entered values. Null when not computable. */
export function computeFromSpec(
  spec: FormulaSpec,
  values: SpecValues,
  samples: Array<number | string> = [],
): number | null {
  if (spec.mode === 'list') {
    const v = cleanSamples(samples);
    if (!v.length) return null;
    if (spec.stat === 'MEAN') return round(v.reduce((a, b) => a + b, 0) / v.length);
    const s = [...v].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
  }
  if (spec.mode === 'value') {
    const n = toNumber(values[spec.key]);
    return n === null ? null : round(n);
  }
  const num = product(spec.numerator, values);
  const den = product(spec.denominator, values);
  if (num === null || den === null || den === 0) return null;
  return round((num * spec.scale) / den);
}

// ─── Validation ──────────────────────────────────────────────────────────────

export interface ValidationResult { ok: boolean; error?: string }
const OK: ValidationResult = { ok: true };
const fail = (error: string): ValidationResult => ({ ok: false, error });

/** Structural check — run when a Super-Admin saves a template (formula validation). */
export function validateSpec(spec: unknown): ValidationResult {
  if (!spec || typeof spec !== 'object') return fail('formulaSpec must be an object');
  const s = spec as FormulaSpec;

  if (s.mode === 'value') {
    return s.key && typeof s.key === 'string' ? OK : fail('value formula needs an input key');
  }
  if (s.mode === 'list') {
    return s.stat === 'MEAN' || s.stat === 'MEDIAN' ? OK : fail('list formula stat must be MEAN or MEDIAN');
  }
  if (s.mode === 'ratio') {
    if (!Array.isArray(s.numerator) || !s.numerator.some((t) => t?.kind === 'input'))
      return fail('numerator must contain at least one input');
    if (!Array.isArray(s.denominator)) return fail('denominator must be an array');
    if (typeof s.scale !== 'number' || !Number.isFinite(s.scale)) return fail('scale must be a finite number');
    const keys = new Set<string>();
    for (const t of [...s.numerator, ...s.denominator]) {
      if (t?.kind === 'input') {
        if (!t.key) return fail('every input needs a key');
        if (keys.has(t.key)) return fail(`duplicate input key "${t.key}"`);
        keys.add(t.key);
      } else if (t?.kind === 'const') {
        if (typeof t.value !== 'number' || !Number.isFinite(t.value)) return fail('constant must be a finite number');
      } else {
        return fail('each term must be an input or a constant');
      }
    }
    return OK;
  }
  return fail('unknown formula mode');
}

/** Check entered values against the spec — run when an Admin saves an entry (input validation). */
export function validateInputs(
  spec: FormulaSpec,
  values: SpecValues,
  samples: Array<number | string> = [],
): ValidationResult {
  if (spec.mode === 'list') {
    return cleanSamples(samples).length ? OK : fail('enter at least one value');
  }
  for (const k of specInputKeys(spec)) {
    if (toNumber(values[k]) === null) return fail(`missing or invalid value for "${k}"`);
  }
  return OK;
}

/** Output sanity — a computed result must be a finite number. */
export function validateResult(n: number | null): boolean {
  return n !== null && Number.isFinite(n);
}
