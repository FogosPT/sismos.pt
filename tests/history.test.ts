import { describe, expect, it } from 'vitest';
import { byMonth, isValidYear, topByMagnitude } from '../src/lib/history';

const q = (time: string, magnitude: number | null) => ({ time, magnitude }) as any;

describe('history', () => {
  it('counts events per month in UTC', () => {
    const m = byMonth([q('1969-02-28T02:40:33Z', 7.8), q('1969-02-28T04:25:38Z', 6.1), q('1969-12-31T23:59:59Z', 3)]);
    expect(m[1]).toBe(2);
    expect(m[11]).toBe(1);
    expect(m.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it('ranks by magnitude, earlier first on ties, ignoring unknown magnitudes', () => {
    const top = topByMagnitude([q('1969-03-01T00:00:00Z', 4), q('1969-02-28T00:00:00Z', 7.8), q('1969-01-01T00:00:00Z', 4), q('1969-05-01T00:00:00Z', null)], 3);
    expect(top.map((x) => x.time)).toEqual(['1969-02-28T00:00:00Z', '1969-01-01T00:00:00Z', '1969-03-01T00:00:00Z']);
  });

  it('accepts only years from 1900 to now', () => {
    const now = new Date('2026-11-03T00:00:00Z');
    expect(isValidYear(1969, now)).toBe(true);
    expect(isValidYear(1899, now)).toBe(false);
    expect(isValidYear(2027, now)).toBe(false);
    expect(isValidYear(1969.5, now)).toBe(false);
  });
});
