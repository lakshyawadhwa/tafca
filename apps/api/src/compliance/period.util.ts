/**
 * Pure period-computation logic for the compliance calendar.
 *
 * Zero I/O. Every function is deterministic and unit-tested (period.util.spec.ts).
 *
 * DATE MODEL
 * ----------
 * All dates are *calendar dates* in IST, represented as `Date` objects pinned
 * to UTC midnight (`Date.UTC(y, m, d)`). We never read local timezone fields.
 * "Today in IST" is computed by shifting the wall clock by +5:30 and taking
 * the UTC y/m/d of the result. This keeps the whole engine timezone-stable
 * regardless of where the server runs (Railway is UTC).
 *
 * SEED SEMANTICS (verified against prisma/seed/statutory-deadlines.ts)
 * -------------------------------------------------------------------
 * - MONTHLY   : fires every calendar month. `recurrenceDay` = day of the due
 *               month. The period it covers is the PREVIOUS calendar month
 *               (e.g. GSTR-1 due 11 May covers "Apr 2026").
 * - QUARTERLY : each quarter is a SEPARATE deadline code (Q1..Q4). It fires
 *               once per financial year. `quarterMonthOffset` is the 1-based
 *               month index within the Indian FY (April = 1 ... March = 12) at
 *               which the due date falls; `recurrenceDay` is the day.
 *               e.g. TDS_RETURN_Q1: offset 4 -> July, day 31 -> due 31 Jul.
 * - ANNUALLY  : fires once per calendar year at (`recurrenceMonth`,
 *               `recurrenceDay`).
 * - HALF_YEARLY: no seed data uses it; implemented defensively as two per FY.
 * - ONE_OFF   : never auto-generated.
 *
 * LABELLING
 * ---------
 * - MONTHLY period label = the covered (previous) month, "MMM YYYY".
 * - QUARTERLY / HALF_YEARLY / ANNUALLY label = the Indian FY the due date
 *   falls in, "FYaa-bb". The deadline NAME (e.g. "TDS Return - Q1 (Apr-Jun)")
 *   carries the quarter identity, so we do not try to reverse-engineer the
 *   quarter from the offset (the offsets are not uniquely mappable across
 *   deadline families). The DATE is always exact — that is what prevents a
 *   missed filing.
 */

export enum Recurrence {
  ONE_OFF = 'ONE_OFF',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  HALF_YEARLY = 'HALF_YEARLY',
  ANNUALLY = 'ANNUALLY',
}

export interface DeadlineRecurrence {
  recurrence: string; // RecurrenceType from Prisma/shared
  recurrenceDay: number | null;
  recurrenceMonth: number | null; // 1-12
  quarterMonthOffset: number | null; // 1-12, FY-month index
}

export interface DuePeriod {
  periodLabel: string;
  dueDate: Date; // UTC-midnight calendar date
}

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Current calendar date in IST, pinned to UTC midnight. */
export function istToday(now: Date = new Date()): Date {
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  return utcDate(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
}

/** Construct a UTC-midnight calendar date. month0 is 0-based; overflow is normalised. */
export function utcDate(year: number, month0: number, day: number): Date {
  return new Date(Date.UTC(year, month0, day));
}

/** Number of days in a given month (leap-aware). month0 is 0-based. */
export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** Clamp a day to the last valid day of the month (e.g. 31 -> 30 in April). */
function clampDay(year: number, month0: number, day: number): number {
  return Math.min(day, daysInMonth(year, month0));
}

/** Indian FY start year for a date: Jan-Mar belongs to the previous FY. */
export function fyStartYear(d: Date): number {
  const y = d.getUTCFullYear();
  const m0 = d.getUTCMonth();
  return m0 >= 3 ? y : y - 1;
}

/** "FYaa-bb" label for an FY start year (e.g. 2026 -> "FY26-27"). */
export function fyLabel(startYear: number): string {
  const a = String(startYear % 100).padStart(2, '0');
  const b = String((startYear + 1) % 100).padStart(2, '0');
  return `FY${a}-${b}`;
}

function inWindow(d: Date, start: Date, end: Date): boolean {
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

/**
 * Map a 1-based FY-month index to a calendar (year, month0) for a given FY.
 * FY months 1-9 = Apr..Dec of the start year; 10-12 = Jan..Mar of start+1.
 */
function fyMonthToCalendar(
  fyStart: number,
  fyMonthIndex: number,
): { year: number; month0: number } {
  const month0 = (3 + (fyMonthIndex - 1)) % 12;
  const year = fyMonthIndex <= 9 ? fyStart : fyStart + 1;
  return { year, month0 };
}

/**
 * Compute all due periods for a deadline whose due date falls within
 * [windowStart, windowEnd] (both inclusive, both UTC-midnight dates).
 *
 * `customDueDateDay` (from a client assignment) overrides `recurrenceDay` for
 * date math only — it does not change the period label.
 */
export function computeDuePeriods(
  deadline: DeadlineRecurrence,
  windowStart: Date,
  windowEnd: Date,
  customDueDateDay?: number | null,
): DuePeriod[] {
  if (windowStart.getTime() > windowEnd.getTime()) return [];

  switch (deadline.recurrence) {
    case Recurrence.MONTHLY:
      return monthlyPeriods(deadline, windowStart, windowEnd, customDueDateDay);
    case Recurrence.QUARTERLY:
      return quarterlyPeriods(deadline, windowStart, windowEnd, customDueDateDay);
    case Recurrence.HALF_YEARLY:
      return halfYearlyPeriods(deadline, windowStart, windowEnd, customDueDateDay);
    case Recurrence.ANNUALLY:
      return annuallyPeriods(deadline, windowStart, windowEnd, customDueDateDay);
    case Recurrence.ONE_OFF:
    default:
      return [];
  }
}

function monthlyPeriods(
  deadline: DeadlineRecurrence,
  windowStart: Date,
  windowEnd: Date,
  customDay?: number | null,
): DuePeriod[] {
  const day = customDay ?? deadline.recurrenceDay;
  if (day == null) return []; // malformed master — caller logs and skips

  const out: DuePeriod[] = [];
  // Iterate candidate due months using an absolute month index (year*12 +
  // month0). We scan from one month before the window to one month after, so
  // boundary clamping is covered and the loop is always bounded.
  const startAbs =
    windowStart.getUTCFullYear() * 12 + windowStart.getUTCMonth() - 1;
  const endAbs = windowEnd.getUTCFullYear() * 12 + windowEnd.getUTCMonth() + 1;

  for (let abs = startAbs; abs <= endAbs; abs++) {
    const year = Math.floor(abs / 12);
    const month0 = abs - year * 12;
    const due = utcDate(year, month0, clampDay(year, month0, day));

    if (inWindow(due, windowStart, windowEnd)) {
      // Covered period = previous calendar month.
      const pm = utcDate(year, month0 - 1, 1);
      out.push({
        periodLabel: `${MONTH_ABBR[pm.getUTCMonth()]} ${pm.getUTCFullYear()}`,
        dueDate: due,
      });
    }
  }
  return out;
}

function quarterlyPeriods(
  deadline: DeadlineRecurrence,
  windowStart: Date,
  windowEnd: Date,
  customDay?: number | null,
): DuePeriod[] {
  const day = customDay ?? deadline.recurrenceDay;
  const offset = deadline.quarterMonthOffset;
  if (day == null || offset == null) return [];

  const out: DuePeriod[] = [];
  for (
    let fyStart = fyStartYear(windowStart) - 1;
    fyStart <= fyStartYear(windowEnd) + 1;
    fyStart++
  ) {
    const { year, month0 } = fyMonthToCalendar(fyStart, offset);
    const due = utcDate(year, month0, clampDay(year, month0, day));
    if (inWindow(due, windowStart, windowEnd)) {
      out.push({ periodLabel: fyLabel(fyStartYear(due)), dueDate: due });
    }
  }
  return out;
}

function halfYearlyPeriods(
  deadline: DeadlineRecurrence,
  windowStart: Date,
  windowEnd: Date,
  customDay?: number | null,
): DuePeriod[] {
  const day = customDay ?? deadline.recurrenceDay;
  const baseMonth = deadline.recurrenceMonth; // 1-12
  if (day == null || baseMonth == null) return [];

  const out: DuePeriod[] = [];
  for (
    let year = windowStart.getUTCFullYear() - 1;
    year <= windowEnd.getUTCFullYear() + 1;
    year++
  ) {
    for (const monthNum of [baseMonth, ((baseMonth - 1 + 6) % 12) + 1]) {
      const m0 = monthNum - 1;
      const due = utcDate(year, m0, clampDay(year, m0, day));
      if (inWindow(due, windowStart, windowEnd)) {
        out.push({ periodLabel: fyLabel(fyStartYear(due)), dueDate: due });
      }
    }
  }
  return out;
}

function annuallyPeriods(
  deadline: DeadlineRecurrence,
  windowStart: Date,
  windowEnd: Date,
  customDay?: number | null,
): DuePeriod[] {
  const day = customDay ?? deadline.recurrenceDay;
  const month = deadline.recurrenceMonth; // 1-12
  if (day == null || month == null) return [];

  const m0 = month - 1;
  const out: DuePeriod[] = [];
  for (
    let year = windowStart.getUTCFullYear() - 1;
    year <= windowEnd.getUTCFullYear() + 1;
    year++
  ) {
    const due = utcDate(year, m0, clampDay(year, m0, day));
    if (inWindow(due, windowStart, windowEnd)) {
      out.push({ periodLabel: fyLabel(fyStartYear(due)), dueDate: due });
    }
  }
  return out;
}

/** Subtract whole days from a UTC-midnight date. */
export function subtractDays(d: Date, days: number): Date {
  return new Date(d.getTime() - days * 86_400_000);
}
