/**
 * Formula parity + validation guard.
 *
 * For every seeded indicator it asserts:
 *   1. the stored `formulaSpec` is structurally valid (`validateSpec`), and
 *   2. computing via the shared engine (`computeFromSpec`) == the legacy engine
 *      (`apps/api/.../compute.ts`) across random inputs.
 *
 * Run:  pnpm --filter @nabh/database db:verify-formulas
 * Exits non-zero on any missing/invalid spec or mismatch (CI-friendly).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  computeFromSpec, validateSpec, specInputKeys, type FormulaSpec, type SpecTerm,
} from '../shared/src/formula';
import { computeIndicator } from '../../apps/api/src/modules/indicators/compute';

type Row = {
  name: string; formulaType: string; multiplier: number;
  customExpression?: string | null; formulaSpec?: FormulaSpec;
};

function productOf(terms: SpecTerm[], values: Record<string, number>): number | null {
  let p = 1, saw = false;
  for (const t of terms) {
    if (t.kind === 'const') p *= t.value;
    else { const v = values[t.key]; if (v == null) return null; p *= v; saw = true; }
  }
  return saw ? p : null;
}

const rnd = () => Math.floor(Math.random() * 1000) + 1;
const data: Row[] = JSON.parse(readFileSync(join(__dirname, 'prisma/seed/kpi-indicators.json'), 'utf8'));

let missing = 0, invalid = 0, mism = 0, trials = 0;
const notes: string[] = [];

for (const t of data) {
  const spec = t.formulaSpec;
  if (!spec) { missing++; if (notes.length < 25) notes.push(`NO SPEC: ${t.name}`); continue; }
  const v = validateSpec(spec);
  if (!v.ok) { invalid++; if (notes.length < 25) notes.push(`INVALID: ${t.name} — ${v.error}`); continue; }

  for (let i = 0; i < 40; i++) {
    const values: Record<string, number> = {};
    for (const k of specInputKeys(spec)) values[k] = rnd();
    const samples = spec.mode === 'list' ? Array.from({ length: 3 + (i % 5) }, rnd) : [];

    const neu = computeFromSpec(spec, values, samples);
    let num: number | null = null, den: number | null = null;
    if (spec.mode === 'ratio') { num = productOf(spec.numerator, values); den = productOf(spec.denominator, values); }
    else if (spec.mode === 'value') num = values[spec.key];
    const old = computeIndicator({
      formulaType: t.formulaType, multiplier: t.multiplier,
      numeratorValue: num, denominatorValue: den, sampleValues: samples,
      customExpression: t.customExpression ?? null,
    });

    trials++;
    const eq = (neu === null && old === null) || (neu != null && old != null && Math.abs(neu - old) < 1e-9);
    if (!eq) { mism++; if (notes.length < 25) notes.push(`MISMATCH: ${t.name} new=${neu} old=${old}`); }
  }
}

console.log(`Indicators: ${data.length} · no-spec: ${missing} · invalid: ${invalid} · trials: ${trials} · mismatches: ${mism}`);
notes.forEach((n) => console.log('  ' + n));
if (missing || invalid || mism) { console.error('\n❌ Formula guard FAILED.'); process.exit(1); }
console.log('\n✅ Formula guard passed — every spec is valid and matches the engine.');
