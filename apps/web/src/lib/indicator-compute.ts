/**
 * Client display helpers for indicators — result formatting, RAG status vs a
 * target, and a human-readable formula description. The compute engine now lives
 * in @nabh/shared (`computeFromSpec`); this file no longer computes.
 */

export type FormulaType = 'RATIO' | 'MEAN' | 'MEDIAN' | 'CUSTOM';

/** A short human-readable description of a template's formula, for the Super-Admin UI. */
export function describeFormula(formulaType: string, multiplier?: number | null, unit?: string | null): string {
  const u = unit ? ` ${unit}` : '';
  switch (formulaType) {
    case 'RATIO': {
      const m = multiplier ?? 1;
      if (m === 100) return `(Numerator × 100) ÷ Denominator → %`;
      if (m === 1000) return `(Numerator × 1000) ÷ Denominator → per 1000`;
      if (m === 1) return `Numerator ÷ Denominator${u}`;
      return `(Numerator × ${m}) ÷ Denominator${u}`;
    }
    case 'MEAN':
      return `Mean (average) of entered values${u}`;
    case 'MEDIAN':
      return `Median of entered values${u}`;
    case 'CUSTOM':
      return `Custom formula${u}`;
    default:
      return '—';
  }
}

// ─── RAG (red / amber / green) status vs a target ────────────────────────────

export type Rag = 'green' | 'amber' | 'red' | null;

/**
 * Status of a value against its target. `higherIsBetter` flips the direction
 * (e.g. mortality rate is better when lower). Amber is the 10% near-miss band.
 * Returns null when there's no value or no target (status not applicable).
 */
export function ragStatus(value: number | null | undefined, target: number | null | undefined, higherIsBetter = true): Rag {
  if (value == null || target == null) return null;
  if (higherIsBetter) {
    if (value >= target) return 'green';
    if (value >= target * 0.9) return 'amber';
    return 'red';
  }
  if (value <= target) return 'green';
  if (value <= target * 1.1) return 'amber';
  return 'red';
}

export const RAG_COLOR: Record<'green' | 'amber' | 'red', string> = {
  green: '#10B981', amber: '#F59E0B', red: '#EF4444',
};

/** Pretty-print a computed result with a unit suffix. */
export function formatResult(value: number | null | undefined, unit?: string | null): string {
  if (value == null) return '—';
  const n = Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (!unit) return n;
  if (unit === '%') return `${n}%`;
  return `${n} ${unit}`;
}
