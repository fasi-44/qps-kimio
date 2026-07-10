/**
 * Shared formula rendering for indicators — used by both the admin data-entry
 * screen (`/indicators`) and the super-admin Setup screen (`/kpi-templates`) so
 * the two never diverge. `FormulaView` renders a spec as a real stacked fraction
 * (never prose); the label/visual helpers are exported for the calculator too.
 */
import { Fragment, type ReactNode } from 'react';
import type { Term, IndicatorSpec } from '@/lib/indicator-spec';

// A compact label — drops the verbose "Inclusion/Exclusion" clauses (the full
// text stays in the hover tooltip) so the formula reads cleanly.
export const shortLabel = (s: string) => {
  const trimmed = s.split(/\s*(?:Inclusion|Exclusion|Inclusions|Exclusions)\b\s*[:\-–—]*/i)[0].trim();
  return trimmed || s;
};

// The label shown under a calculator input. Show the indicator's real
// numerator/denominator description (the source-of-truth text from the KPI
// document), trimmed of its Inclusion/Exclusion clauses (the full text stays in
// the hover tooltip). Fall back to a generic token only when a term has no label.
export const GENERIC_LABEL: Record<string, string> = { num: 'Numerator', den: 'Denominator', value: 'Value' };
export const displayLabel = (term: Extract<Term, { kind: 'input' }>) =>
  shortLabel(term.label) || GENERIC_LABEL[term.key] || 'Value';

export const Op = ({ children }: { children: ReactNode }) => (
  <span className="text-slate-500 text-sm font-medium px-0.5 self-center">{children}</span>
);

/** Stacks a numerator row over a denominator row with a fraction bar. */
export function Fraction({ top, bottom }: { top: ReactNode; bottom?: ReactNode }) {
  if (!bottom) return <div className="flex items-center gap-1.5 flex-wrap">{top}</div>;
  return (
    <div className="inline-flex flex-col items-center">
      <div className="flex items-end gap-1.5 flex-wrap justify-center pb-1.5">{top}</div>
      <div className="h-[2px] w-full rounded self-stretch" style={{ background: 'var(--text-muted)' }} />
      <div className="flex items-start gap-1.5 flex-wrap justify-center pt-1.5">{bottom}</div>
    </div>
  );
}

/** A row of spec terms as plain text — variable names joined by ×, constants as numbers. */
export const termsText = (terms: Term[]) =>
  terms.map((t, i) => (
    <Fragment key={i}>
      {i > 0 && <span className="text-slate-500 px-1">×</span>}
      {t.kind === 'const'
        ? <span className="text-slate-400 font-semibold">{t.value}</span>
        : <span className="text-slate-300">{shortLabel(t.label)}</span>}
    </Fragment>
  ));

/** Where the source PDF puts the ×scale multiplier. Read straight from the raw
 *  formula text: it sits on the whole ratio (OUTSIDE) iff the formula ends with
 *  "×scale" (e.g. "(falls/days)*1000"); otherwise it lives INSIDE the numerator
 *  (e.g. "(bed days *100/beds*days)"). Both compute the same value — this only
 *  controls where it is drawn so the fraction matches the PDF per indicator.
 *  Accepts * × x X as the multiply sign; scale 1 or no formula → not in numerator. */
export const scaleInNumerator = (formula: string | null | undefined, scale: number): boolean => {
  if (scale === 1 || !formula) return false;
  const outside = new RegExp(`[*×xX]\\s*${scale}\\s*$`).test(formula.trim());
  return !outside;
};

/** Shows the formula the way it reads mathematically: a stacked fraction with a
 *  bar, × scale and the resulting unit — mirrors the calculator on the right.
 *  `scaleInNum` places the ×scale inside the numerator vs. on the whole ratio. */
export function FormulaView({ spec, unit, scaleInNum = false }: { spec: IndicatorSpec; unit: string | null; scaleInNum?: boolean }) {
  if (spec.mode === 'list') {
    return (
      <p className="text-[0.82rem] leading-relaxed">
        <span className="font-semibold text-slate-200">{spec.stat === 'MEAN' ? 'Mean' : 'Median'}</span>
        <span className="text-slate-300"> of the entered values</span>
        {unit && <span className="text-slate-500"> ({unit})</span>}
      </p>
    );
  }
  if (spec.mode === 'value') {
    const generic = GENERIC_LABEL[spec.key] || spec.label === 'Value';
    return (
      <p className="text-[0.82rem] leading-relaxed text-slate-300">
        {generic ? 'Reported value' : shortLabel(spec.label)}
        {unit && <span className="text-slate-500"> ({unit})</span>}
      </p>
    );
  }
  // Where the PDF puts ×scale (see scaleInNumerator): inside the numerator for
  // "(bed days ×100/beds×days)", or — for "(falls/days)×1000" — on the WHOLE ratio.
  // In the latter case wrap the fraction in parentheses and keep ×scale on the same
  // line, exactly like the PDF, so it can never be misread as part of the denominator.
  const topRow = (
    <div className="flex items-baseline gap-x-1 flex-wrap justify-center leading-snug">
      {termsText(spec.numerator)}
      {scaleInNum && spec.scale !== 1 && <><span className="text-slate-500 px-1">×</span><span className="text-slate-400 font-semibold">{spec.scale}</span></>}
    </div>
  );
  const bottomRow = spec.denominator.length
    ? <div className="flex items-baseline gap-x-1 flex-wrap justify-center leading-snug">{termsText(spec.denominator)}</div>
    : undefined;
  const scaleOutside = !scaleInNum && spec.scale !== 1;
  return (
    <div className="flex items-center gap-2 flex-wrap text-[0.82rem]">
      {scaleOutside ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-slate-400 font-thin" style={{ fontSize: '2.3em', lineHeight: 0.8 }}>(</span>
          <Fraction top={topRow} bottom={bottomRow} />
          <span className="text-slate-400 font-thin" style={{ fontSize: '2.3em', lineHeight: 0.8 }}>)</span>
          <span className="text-slate-400 font-semibold whitespace-nowrap">× {spec.scale}</span>
        </span>
      ) : (
        <Fraction top={topRow} bottom={bottomRow} />
      )}
      {unit && <span className="text-slate-500 self-center whitespace-nowrap">→ {unit}</span>}
    </div>
  );
}
