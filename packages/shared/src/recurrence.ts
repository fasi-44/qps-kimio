// ─────────────────────────────────────────────────────────────
// Outlook-style meeting recurrence.
// Single source of truth shared by the API (series generation) and
// the web client (live preview / summary). Each occurrence becomes a
// concrete meeting row, so this only computes the calendar dates.
// ─────────────────────────────────────────────────────────────

export type RecurrenceFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type MonthlyMode = 'DAY_OF_MONTH' | 'NTH_WEEKDAY';
/** "first/second/third/fourth/last" — last is -1. */
export type Nth = 1 | 2 | 3 | 4 | -1;
/** What the nth-weekday picker is counting. */
export type NthKind = 'DAY' | 'WEEKDAY' | 'WEEKEND_DAY' | 'SPECIFIC';

export interface RecurrenceEnd {
  type: 'COUNT' | 'UNTIL';
  count?: number; // when type === 'COUNT'
  until?: string; // ISO date (yyyy-mm-dd) when type === 'UNTIL', inclusive
}

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  interval: number;          // every N days/weeks/months/years (>= 1)
  // DAILY
  weekdaysOnly?: boolean;    // "every weekday" (Mon–Fri); ignores interval
  // WEEKLY
  byWeekday?: number[];      // 0=Sun … 6=Sat
  // MONTHLY + YEARLY
  monthlyMode?: MonthlyMode;
  dayOfMonth?: number;       // 1..31 (DAY_OF_MONTH)
  nth?: Nth;                 // NTH_WEEKDAY
  nthKind?: NthKind;         // NTH_WEEKDAY
  nthWeekday?: number;       // 0..6, only when nthKind === 'SPECIFIC'
  // YEARLY
  month?: number;            // 1..12
  end: RecurrenceEnd;
}

/** Hard cap on generated meetings, regardless of rule (safety net). */
export const RECURRENCE_MAX = 60;

export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const NTH_LABELS: Record<string, string> = { '1': 'first', '2': 'second', '3': 'third', '4': 'fourth', '-1': 'last' };

// ─── date helpers ─────────────────────────────────────────────

const daysInMonth = (year: number, month0: number) => new Date(year, month0 + 1, 0).getDate();
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
/** Build a date at the given Y/M/D but keeping the reference's clock time. */
const atClock = (year: number, month0: number, day: number, ref: Date) =>
  new Date(year, month0, day, ref.getHours(), ref.getMinutes(), ref.getSeconds(), ref.getMilliseconds());
/** Midnight of a date — for inclusive "on or after start" / "on or before until" comparisons. */
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function matchesKind(dow: number, kind: NthKind, weekday?: number): boolean {
  switch (kind) {
    case 'DAY': return true;
    case 'WEEKDAY': return dow >= 1 && dow <= 5;
    case 'WEEKEND_DAY': return dow === 0 || dow === 6;
    case 'SPECIFIC': return dow === weekday;
  }
}

/** The nth (or last) day in a month matching the kind/weekday predicate, at the ref clock time. */
function nthWeekdayOfMonth(year: number, month0: number, nth: Nth, kind: NthKind, weekday: number | undefined, ref: Date): Date | null {
  const matches: number[] = [];
  const total = daysInMonth(year, month0);
  for (let day = 1; day <= total; day++) {
    const dow = new Date(year, month0, day).getDay();
    if (matchesKind(dow, kind, weekday)) matches.push(day);
  }
  const day = nth === -1 ? matches[matches.length - 1] : matches[nth - 1];
  return day ? atClock(year, month0, day, ref) : null;
}

// ─── generation ───────────────────────────────────────────────

/**
 * Generate the ordered list of occurrence dates for a rule, starting from `start`
 * (the first occurrence is always included when it satisfies the pattern's anchor).
 * Bounded by the rule's end condition and RECURRENCE_MAX.
 */
export function generateOccurrences(start: Date, rule: RecurrenceRule): Date[] {
  const cap = rule.end.type === 'COUNT'
    ? Math.min(Math.max(rule.end.count ?? 1, 1), RECURRENCE_MAX)
    : RECURRENCE_MAX;
  const untilMs = rule.end.type === 'UNTIL' && rule.end.until
    ? new Date(rule.end.until + 'T23:59:59.999').getTime()
    : Infinity;
  const startMs = dayStart(start).getTime();
  const interval = Math.max(1, rule.interval || 1);

  // The start date is always the first occurrence (like iCal DTSTART / Google
  // Calendar), even if it doesn't itself match the pattern. The pattern then
  // drives every subsequent occurrence, strictly after the start.
  const out: Date[] = [new Date(start)];
  const push = (d: Date | null): boolean => {
    if (!d) return true;                 // no candidate this block — keep going
    if (out.length >= cap) return false; // already full
    const ms = dayStart(d).getTime();
    if (ms <= startMs) return true;      // on/before start — already represented by the start itself
    if (ms > untilMs) return false;      // past the end date — stop
    out.push(d);
    return out.length < cap;             // stop once we hit the cap
  };

  // Block index guard so a pattern that never yields can't loop forever.
  const MAX_BLOCKS = RECURRENCE_MAX * 400;

  if (rule.freq === 'DAILY') {
    if (rule.weekdaysOnly) {
      let d = new Date(start);
      for (let i = 0; i < MAX_BLOCKS; i++, d = addDays(d, 1)) {
        const dow = d.getDay();
        if (dow >= 1 && dow <= 5 && !push(atClock(d.getFullYear(), d.getMonth(), d.getDate(), start))) break;
        if (dayStart(d).getTime() > untilMs) break;
      }
    } else {
      for (let i = 0; i < MAX_BLOCKS; i++) {
        const d = addDays(start, i * interval);
        if (!push(d)) break;
      }
    }
  } else if (rule.freq === 'WEEKLY') {
    const days = (rule.byWeekday && rule.byWeekday.length ? [...new Set(rule.byWeekday)] : [start.getDay()]).sort((a, b) => a - b);
    const anchor = addDays(start, -start.getDay()); // Sunday of the start's week
    for (let w = 0; w < MAX_BLOCKS; w++) {
      if (w % interval !== 0) continue;
      let stop = false;
      for (const dow of days) {
        const d = addDays(anchor, w * 7 + dow);
        if (!push(atClock(d.getFullYear(), d.getMonth(), d.getDate(), start))) { stop = true; break; }
      }
      if (stop) break;
      // Past the end? the last day of this week is the furthest we reached.
      if (dayStart(addDays(anchor, w * 7 + 6)).getTime() > untilMs && out.length) break;
      if (w * 7 > MAX_BLOCKS) break;
    }
  } else if (rule.freq === 'MONTHLY') {
    for (let k = 0; k < MAX_BLOCKS; k++) {
      const base = new Date(start.getFullYear(), start.getMonth() + k * interval, 1);
      const year = base.getFullYear();
      const month0 = base.getMonth();
      let d: Date | null;
      if (rule.monthlyMode === 'NTH_WEEKDAY') {
        d = nthWeekdayOfMonth(year, month0, rule.nth ?? 1, rule.nthKind ?? 'DAY', rule.nthWeekday, start);
      } else {
        const day = Math.min(rule.dayOfMonth ?? start.getDate(), daysInMonth(year, month0));
        d = atClock(year, month0, day, start);
      }
      if (!push(d)) break;
      if (dayStart(new Date(year, month0, daysInMonth(year, month0))).getTime() > untilMs && out.length) break;
    }
  } else { // YEARLY
    const month0 = (rule.month ?? start.getMonth() + 1) - 1;
    for (let k = 0; k < MAX_BLOCKS; k++) {
      const year = start.getFullYear() + k * interval;
      let d: Date | null;
      if (rule.monthlyMode === 'NTH_WEEKDAY') {
        d = nthWeekdayOfMonth(year, month0, rule.nth ?? 1, rule.nthKind ?? 'DAY', rule.nthWeekday, start);
      } else {
        const day = Math.min(rule.dayOfMonth ?? start.getDate(), daysInMonth(year, month0));
        d = atClock(year, month0, day, start);
      }
      if (!push(d)) break;
      if (dayStart(new Date(year, month0, daysInMonth(year, month0))).getTime() > untilMs && out.length) break;
    }
  }

  return out;
}

// ─── human-readable summary ───────────────────────────────────

function ordinalWeekdayPhrase(rule: RecurrenceRule): string {
  const nth = NTH_LABELS[String(rule.nth ?? 1)];
  const kind = rule.nthKind ?? 'DAY';
  const what =
    kind === 'DAY' ? 'day'
      : kind === 'WEEKDAY' ? 'weekday'
        : kind === 'WEEKEND_DAY' ? 'weekend day'
          : WEEKDAY_LABELS[rule.nthWeekday ?? 0];
  return `the ${nth} ${what}`;
}

/**
 * A plain-language description of the repeat pattern only (no count/end), e.g.
 * "Repeats on the first Monday of every month". The concrete first/last dates and
 * total count are shown separately so the reader isn't left to infer them.
 */
export function summarizeRecurrence(rule: RecurrenceRule, start: Date): string {
  const n = Math.max(1, rule.interval || 1);

  if (rule.freq === 'DAILY') {
    if (rule.weekdaysOnly) return 'Repeats every weekday (Mon–Fri)';
    return n === 1 ? 'Repeats every day' : `Repeats every ${n} days`;
  }
  if (rule.freq === 'WEEKLY') {
    const days = (rule.byWeekday && rule.byWeekday.length ? [...new Set(rule.byWeekday)] : [start.getDay()])
      .sort((a, b) => a - b).map((d) => WEEKDAY_SHORT[d]).join(', ');
    return `${n === 1 ? 'Repeats weekly' : `Repeats every ${n} weeks`} on ${days}`;
  }
  if (rule.freq === 'MONTHLY') {
    const every = n === 1 ? 'every month' : `every ${n} months`;
    return rule.monthlyMode === 'NTH_WEEKDAY'
      ? `Repeats on ${ordinalWeekdayPhrase(rule)} of ${every}`
      : `Repeats on day ${rule.dayOfMonth ?? start.getDate()} of ${every}`;
  }
  // YEARLY
  const month0 = (rule.month ?? start.getMonth() + 1) - 1;
  const every = n === 1 ? 'every year' : `every ${n} years`;
  return rule.monthlyMode === 'NTH_WEEKDAY'
    ? `Repeats on ${ordinalWeekdayPhrase(rule)} of ${MONTH_LABELS[month0]}, ${every}`
    : `Repeats on ${MONTH_LABELS[month0]} ${rule.dayOfMonth ?? start.getDate()}, ${every}`;
}
