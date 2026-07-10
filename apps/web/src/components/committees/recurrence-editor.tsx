'use client';

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  RecurrenceRule, RecurrenceFreq, generateOccurrences, summarizeRecurrence,
  WEEKDAY_LABELS, WEEKDAY_SHORT, MONTH_LABELS, RECURRENCE_MAX,
} from '@nabh/shared';
import { cn, formatDate } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import { CalendarClock } from 'lucide-react';

const FREQS: { value: RecurrenceFreq; label: string }[] = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
];

const NTH_OPTIONS = [
  { value: '1', label: 'first' },
  { value: '2', label: 'second' },
  { value: '3', label: 'third' },
  { value: '4', label: 'fourth' },
  { value: '-1', label: 'last' },
];

const KIND_OPTIONS = [
  { value: 'DAY', label: 'day' },
  { value: 'WEEKDAY', label: 'weekday' },
  { value: 'WEEKEND_DAY', label: 'weekend day' },
  ...WEEKDAY_LABELS.map((l, i) => ({ value: String(i), label: l })),
];

const numCls =
  'w-16 px-2.5 py-2 rounded-lg text-sm text-center bg-white/[0.04] border border-white/8 text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all';

/** Build a sensible starting rule from the meeting's start date. */
export function defaultRule(start: Date): RecurrenceRule {
  const nth = Math.min(Math.ceil(start.getDate() / 7), 4) as 1 | 2 | 3 | 4;
  return {
    freq: 'MONTHLY',
    interval: 1,
    weekdaysOnly: false,
    byWeekday: [start.getDay()],
    monthlyMode: 'DAY_OF_MONTH',
    dayOfMonth: start.getDate(),
    nth,
    nthKind: 'SPECIFIC',
    nthWeekday: start.getDay(),
    month: start.getMonth() + 1,
    end: { type: 'COUNT', count: 12 },
  };
}

function kindToValue(rule: RecurrenceRule): string {
  if (rule.nthKind === 'SPECIFIC') return String(rule.nthWeekday ?? 0);
  return rule.nthKind ?? 'DAY';
}
function valueToKind(value: string): Partial<RecurrenceRule> {
  if (value === 'DAY' || value === 'WEEKDAY' || value === 'WEEKEND_DAY') return { nthKind: value };
  return { nthKind: 'SPECIFIC', nthWeekday: Number(value) };
}

function Radio({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer">
      <span
        onClick={onChange}
        className={cn('w-4 h-4 rounded-full border flex items-center justify-center shrink-0', checked ? 'border-brand-teal' : 'border-slate-300 dark:border-white/25')}
      >
        {checked && <span className="w-2 h-2 rounded-full bg-brand-teal" />}
      </span>
      <span className="flex items-center gap-2 flex-wrap text-sm text-slate-300">{children}</span>
    </label>
  );
}

export function RecurrenceEditor({
  value, onChange, start,
}: {
  value: RecurrenceRule;
  onChange: (r: RecurrenceRule) => void;
  start: Date | null;
}) {
  const set = (patch: Partial<RecurrenceRule>) => onChange({ ...value, ...patch });
  const occurrences = start ? generateOccurrences(start, value) : [];
  const monthly = value.monthlyMode ?? 'DAY_OF_MONTH';

  const nthWeekdayRow = (
    <>
      the
      <Select value={String(value.nth ?? 1)} onValueChange={(v) => set({ nth: Number(v) as 1 | 2 | 3 | 4 | -1 })}>
        <SelectTrigger className="w-auto min-w-[90px]"><SelectValue /></SelectTrigger>
        <SelectContent>{NTH_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={kindToValue(value)} onValueChange={(v) => set(valueToKind(v))}>
        <SelectTrigger className="w-auto min-w-[110px]"><SelectValue /></SelectTrigger>
        <SelectContent>{KIND_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </>
  );

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-5">
      {/* Pattern selector */}
      <div className="flex flex-wrap gap-2">
        {FREQS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => set({ freq: f.value })}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all',
              value.freq === f.value ? 'text-brand-teal bg-brand-teal/10 border-brand-teal/30' : 'text-slate-400 border-white/8 hover:bg-white/5',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Pattern-specific controls */}
      <div className="space-y-3">
        {value.freq === 'DAILY' && (
          <div className="space-y-3">
            <Radio checked={!value.weekdaysOnly} onChange={() => set({ weekdaysOnly: false })}>
              every
              <input type="number" min={1} max={99} value={value.interval}
                onChange={(e) => set({ interval: Math.max(1, Number(e.target.value)) })} className={numCls} />
              day(s)
            </Radio>
            <Radio checked={!!value.weekdaysOnly} onChange={() => set({ weekdaysOnly: true })}>
              every weekday
            </Radio>
          </div>
        )}

        {value.freq === 'WEEKLY' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap text-sm text-slate-300">
              every
              <input type="number" min={1} max={99} value={value.interval}
                onChange={(e) => set({ interval: Math.max(1, Number(e.target.value)) })} className={numCls} />
              week(s) on:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_SHORT.map((lbl, i) => {
                const active = (value.byWeekday ?? []).includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      const cur = value.byWeekday ?? [];
                      const next = active ? cur.filter((d) => d !== i) : [...cur, i];
                      set({ byWeekday: next.length ? next : (start ? [start.getDay()] : [i]) });
                    }}
                    className={cn(
                      'w-10 h-9 rounded-lg text-xs font-bold border transition-all',
                      active ? 'text-brand-teal bg-brand-teal/10 border-brand-teal/30' : 'text-slate-400 border-white/8 hover:bg-white/5',
                    )}
                    title={WEEKDAY_LABELS[i]}
                  >
                    {lbl[0]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {value.freq === 'MONTHLY' && (
          <div className="space-y-3">
            <Radio checked={monthly === 'DAY_OF_MONTH'} onChange={() => set({ monthlyMode: 'DAY_OF_MONTH' })}>
              day
              <input type="number" min={1} max={31} value={value.dayOfMonth ?? 1}
                onChange={(e) => set({ dayOfMonth: Math.min(31, Math.max(1, Number(e.target.value))) })} className={numCls} />
              of every
              <input type="number" min={1} max={99} value={value.interval}
                onChange={(e) => set({ interval: Math.max(1, Number(e.target.value)) })} className={numCls} />
              month(s)
            </Radio>
            <Radio checked={monthly === 'NTH_WEEKDAY'} onChange={() => set({ monthlyMode: 'NTH_WEEKDAY' })}>
              {nthWeekdayRow}
              of every
              <input type="number" min={1} max={99} value={value.interval}
                onChange={(e) => set({ interval: Math.max(1, Number(e.target.value)) })} className={numCls} />
              month(s)
            </Radio>
          </div>
        )}

        {value.freq === 'YEARLY' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap text-sm text-slate-300">
              every
              <input type="number" min={1} max={99} value={value.interval}
                onChange={(e) => set({ interval: Math.max(1, Number(e.target.value)) })} className={numCls} />
              year(s)
            </div>
            <Radio checked={monthly === 'DAY_OF_MONTH'} onChange={() => set({ monthlyMode: 'DAY_OF_MONTH' })}>
              on
              <Select value={String((value.month ?? 1))} onValueChange={(v) => set({ month: Number(v) })}>
                <SelectTrigger className="w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTH_LABELS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
              <input type="number" min={1} max={31} value={value.dayOfMonth ?? 1}
                onChange={(e) => set({ dayOfMonth: Math.min(31, Math.max(1, Number(e.target.value))) })} className={numCls} />
            </Radio>
            <Radio checked={monthly === 'NTH_WEEKDAY'} onChange={() => set({ monthlyMode: 'NTH_WEEKDAY' })}>
              {nthWeekdayRow}
              of
              <Select value={String((value.month ?? 1))} onValueChange={(v) => set({ month: Number(v) })}>
                <SelectTrigger className="w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTH_LABELS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </Radio>
          </div>
        )}
      </div>

      {/* Range of recurrence */}
      <div className="pt-3 border-t border-white/6 space-y-3">
        <p className="text-[0.7rem] font-bold text-slate-500 uppercase tracking-widest">Range of recurrence</p>
        <Radio checked={value.end.type === 'COUNT'} onChange={() => set({ end: { type: 'COUNT', count: value.end.count ?? 12 } })}>
          end after
          <input
            type="number" min={1} max={RECURRENCE_MAX} value={value.end.count ?? 12}
            onChange={(e) => set({ end: { type: 'COUNT', count: Math.min(RECURRENCE_MAX, Math.max(1, Number(e.target.value))) } })}
            className={numCls}
          />
          occurrence(s)
        </Radio>
        <Radio
          checked={value.end.type === 'UNTIL'}
          onChange={() => set({ end: { type: 'UNTIL', until: value.end.until ?? (start ? toInput(start) : '') } })}
        >
          end by
          <DatePicker
            value={value.end.until ?? ''}
            onChange={(v) => set({ end: { type: 'UNTIL', until: v } })}
            min={start ? toInput(start) : undefined}
            placeholder="End date"
            className="w-40"
          />
        </Radio>
      </div>

      {/* Live, plain-language summary + concrete preview */}
      {start && (
        <div className="pt-3 border-t border-white/6">
          {occurrences.length === 0 ? (
            <p className="flex items-center gap-2 text-xs text-amber-400">
              <CalendarClock className="w-4 h-4 shrink-0" />
              No meetings match this pattern — adjust the pattern or the end date.
            </p>
          ) : (
            <div className="rounded-lg bg-brand-teal/5 border border-brand-teal/15 p-3 space-y-2.5">
              <div className="flex items-start gap-2">
                <CalendarClock className="w-4 h-4 shrink-0 mt-0.5 text-brand-teal" />
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-semibold text-slate-200">
                    {occurrences.length} meeting{occurrences.length === 1 ? '' : 's'}
                    {occurrences.length > 1 && <> · {fmtLong(occurrences[0])} → {fmtLong(occurrences[occurrences.length - 1])}</>}
                  </p>
                  <p className="text-xs text-slate-500">
                    1st meeting on <span className="text-slate-300 font-medium">{fmtLong(occurrences[0])}</span>
                    {occurrences.length > 1 && <>, then {summarizeRecurrence(value, start).replace(/^Repeats /, 'repeats ')}</>}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {occurrences.map((d, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md text-[0.7rem] font-medium text-brand-teal bg-brand-teal/10 border border-brand-teal/20">
                    {fmtChip(d)}
                  </span>
                ))}
              </div>
              {occurrences.length === RECURRENCE_MAX && (
                <p className="text-[0.7rem] text-amber-400">Limited to the first {RECURRENCE_MAX} meetings.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function toInput(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
const fmtLong = (d: Date) => formatDate(d);
const fmtChip = (d: Date) => formatDate(d);
