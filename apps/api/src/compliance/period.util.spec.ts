import {
  computeDuePeriods,
  utcDate,
  daysInMonth,
  fyStartYear,
  fyLabel,
  istToday,
  subtractDays,
  DeadlineRecurrence,
} from './period.util';

const iso = (d: Date) => d.toISOString().slice(0, 10);

// Deadline factory
function dl(over: Partial<DeadlineRecurrence>): DeadlineRecurrence {
  return {
    recurrence: 'MONTHLY',
    recurrenceDay: null,
    recurrenceMonth: null,
    quarterMonthOffset: null,
    ...over,
  };
}

describe('helpers', () => {
  it('daysInMonth is leap-aware', () => {
    expect(daysInMonth(2024, 1)).toBe(29); // Feb 2024 (leap)
    expect(daysInMonth(2026, 1)).toBe(28); // Feb 2026
    expect(daysInMonth(2026, 3)).toBe(30); // Apr
  });

  it('fyStartYear puts Jan-Mar in previous FY', () => {
    expect(fyStartYear(utcDate(2026, 3, 1))).toBe(2026); // Apr 2026
    expect(fyStartYear(utcDate(2026, 2, 31))).toBe(2025); // Mar 2026
    expect(fyStartYear(utcDate(2026, 11, 31))).toBe(2026); // Dec 2026
  });

  it('fyLabel formats correctly', () => {
    expect(fyLabel(2026)).toBe('FY26-27');
    expect(fyLabel(1999)).toBe('FY99-00');
  });

  it('istToday returns a UTC-midnight date', () => {
    const t = istToday(new Date('2026-07-20T20:00:00Z')); // 01:30 IST next day
    expect(iso(t)).toBe('2026-07-21');
    expect(t.getUTCHours()).toBe(0);
  });

  it('subtractDays crosses month boundary', () => {
    expect(iso(subtractDays(utcDate(2026, 2, 2), 5))).toBe('2026-02-25');
  });
});

describe('MONTHLY (GSTR-1, due 11th, covers previous month)', () => {
  const d = dl({ recurrence: 'MONTHLY', recurrenceDay: 11 });

  it('due dates and labels', () => {
    const out = computeDuePeriods(d, utcDate(2026, 3, 1), utcDate(2026, 5, 30));
    expect(out.map((p) => iso(p.dueDate))).toEqual([
      '2026-04-11', '2026-05-11', '2026-06-11',
    ]);
    expect(out.map((p) => p.periodLabel)).toEqual([
      'Mar 2026', 'Apr 2026', 'May 2026',
    ]);
  });

  it('year rollover Dec->Jan', () => {
    const out = computeDuePeriods(d, utcDate(2026, 11, 1), utcDate(2027, 0, 31));
    expect(out.map((p) => iso(p.dueDate))).toEqual(['2026-12-11', '2027-01-11']);
    expect(out[1].periodLabel).toBe('Dec 2026');
  });

  it('day-31 clamps in short months', () => {
    const out = computeDuePeriods(
      dl({ recurrence: 'MONTHLY', recurrenceDay: 31 }),
      utcDate(2026, 1, 1), // Feb
      utcDate(2026, 3, 30), // Apr
    );
    expect(out.map((p) => iso(p.dueDate))).toEqual([
      '2026-02-28', '2026-03-31', '2026-04-30',
    ]);
  });

  it('inclusive window boundaries', () => {
    const out = computeDuePeriods(d, utcDate(2026, 3, 11), utcDate(2026, 4, 11));
    expect(out.map((p) => iso(p.dueDate))).toEqual(['2026-04-11', '2026-05-11']);
  });

  it('customDueDateDay overrides date but not label', () => {
    const out = computeDuePeriods(d, utcDate(2026, 3, 1), utcDate(2026, 3, 30), 25);
    expect(iso(out[0].dueDate)).toBe('2026-04-25');
    expect(out[0].periodLabel).toBe('Mar 2026');
  });

  it('null recurrenceDay yields nothing', () => {
    expect(
      computeDuePeriods(dl({ recurrence: 'MONTHLY' }), utcDate(2026, 0, 1), utcDate(2026, 11, 31)),
    ).toEqual([]);
  });
});

describe('QUARTERLY (each Qn is its own code, fires once per FY)', () => {
  it('TDS Q1: offset 4 -> due 31 Jul', () => {
    const out = computeDuePeriods(
      dl({ recurrence: 'QUARTERLY', recurrenceDay: 31, quarterMonthOffset: 4 }),
      utcDate(2026, 3, 1),
      utcDate(2027, 2, 31),
    );
    expect(out).toHaveLength(1);
    expect(iso(out[0].dueDate)).toBe('2026-07-31');
    expect(out[0].periodLabel).toBe('FY26-27');
  });

  it('Advance Tax Q4: offset 12 -> due 15 Mar (same FY)', () => {
    const out = computeDuePeriods(
      dl({ recurrence: 'QUARTERLY', recurrenceDay: 15, quarterMonthOffset: 12 }),
      utcDate(2026, 3, 1),
      utcDate(2027, 2, 31),
    );
    expect(iso(out[0].dueDate)).toBe('2027-03-15');
    expect(out[0].periodLabel).toBe('FY26-27');
  });

  it('TDS Q4: offset 2 -> due 31 May (next calendar year)', () => {
    // Window covering May 2027 should surface the FY26-27 Q4 return.
    const out = computeDuePeriods(
      dl({ recurrence: 'QUARTERLY', recurrenceDay: 31, quarterMonthOffset: 2 }),
      utcDate(2027, 3, 1),
      utcDate(2027, 6, 31),
    );
    expect(iso(out[0].dueDate)).toBe('2027-05-31');
  });
});

describe('ANNUALLY', () => {
  it('GSTR-9: 31 Dec -> label FY of due date', () => {
    const out = computeDuePeriods(
      dl({ recurrence: 'ANNUALLY', recurrenceDay: 31, recurrenceMonth: 12 }),
      utcDate(2026, 0, 1),
      utcDate(2026, 11, 31),
    );
    expect(iso(out[0].dueDate)).toBe('2026-12-31');
    expect(out[0].periodLabel).toBe('FY26-27');
  });

  it('ITR individual: 31 Jul', () => {
    const out = computeDuePeriods(
      dl({ recurrence: 'ANNUALLY', recurrenceDay: 31, recurrenceMonth: 7 }),
      utcDate(2026, 0, 1),
      utcDate(2026, 11, 31),
    );
    expect(iso(out[0].dueDate)).toBe('2026-07-31');
    expect(out[0].periodLabel).toBe('FY26-27');
  });

  it('ROC AOC-4: recDay 29 (no clamp needed in Oct)', () => {
    const out = computeDuePeriods(
      dl({ recurrence: 'ANNUALLY', recurrenceDay: 29, recurrenceMonth: 10 }),
      utcDate(2026, 0, 1),
      utcDate(2026, 11, 31),
    );
    expect(iso(out[0].dueDate)).toBe('2026-10-29');
  });
});

describe('ONE_OFF never generates', () => {
  it('returns []', () => {
    expect(
      computeDuePeriods(dl({ recurrence: 'ONE_OFF' }), utcDate(2026, 0, 1), utcDate(2028, 0, 1)),
    ).toEqual([]);
  });
});

describe('inverted window', () => {
  it('returns [] when start > end', () => {
    expect(
      computeDuePeriods(
        dl({ recurrence: 'MONTHLY', recurrenceDay: 11 }),
        utcDate(2026, 5, 1),
        utcDate(2026, 3, 1),
      ),
    ).toEqual([]);
  });
});
