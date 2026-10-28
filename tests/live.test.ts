import { describe, expect, it } from 'vitest';
import fixture from './fixtures/emsc-ws.json';
import { mergeRows, rowFromEmsc, sameEvent, unseen } from '../src/lib/live';
import type { Row } from '../src/lib/summary';

const [chile, azores, quarry] = fixture.messages as any[];

const row = (o: Partial<Row>): Row => ({ id: 'x', t: Date.parse('2026-10-28T17:40:12Z'), lat: 37.84, lon: -26.25, d: 9, m: 3.1, r: 'acores', p: null, felt: false, ...o });

describe('EMSC realtime messages', () => {
  it('ignores events outside the Portuguese area (real recorded frame)', () => {
    expect(chile.action).toBe('update');
    expect(rowFromEmsc(chile)).toBeNull();
  });

  it('turns a Portuguese earthquake into a preliminary row', () => {
    expect(rowFromEmsc(azores)).toEqual({
      id: 'emsc-20261028_TEST01', t: Date.parse('2026-10-28T17:40:12.3Z'), lat: 37.84, lon: -26.25, d: 9, m: 3.1,
      r: 'acores', p: 'AZORES ISLANDS, PORTUGAL', felt: false, prelim: true,
    });
  });

  it('drops quarry blasts and malformed frames', () => {
    expect(rowFromEmsc(quarry)).toBeNull();
    expect(rowFromEmsc({} as any)).toBeNull();
    expect(rowFromEmsc({ action: 'create', data: { properties: { time: 'nope', lat: 38, lon: -9 } } })).toBeNull();
    expect(rowFromEmsc({ action: 'delete', data: azores.data })).toBeNull();
  });

  it('uses the absolute depth', () => {
    const neg = JSON.parse(JSON.stringify(azores));
    neg.data.properties.depth = -12;
    expect(rowFromEmsc(neg)?.d).toBe(12);
  });
});

describe('same-event rule', () => {
  it('matches within 15 s and 50 km, or by id', () => {
    const a = row({ id: 'fogos-1' });
    expect(sameEvent(a, row({ id: 'emsc-1', t: a.t + 14_000, lat: 37.9 }))).toBe(true);
    expect(sameEvent(a, row({ id: 'emsc-2', t: a.t + 16_000 }))).toBe(false);
    expect(sameEvent(a, row({ id: 'emsc-3', lat: 38.7, lon: -27.2 }))).toBe(false);
    expect(sameEvent(a, row({ id: 'fogos-1', t: a.t + 3_600_000 }))).toBe(true);
  });

  it('finds only unseen events', () => {
    const known = [row({ id: 'a' })];
    const incoming = [row({ id: 'b', t: known[0].t + 5_000 }), row({ id: 'c', t: known[0].t + 600_000 })];
    expect(unseen(known, incoming).map((q) => q.id)).toEqual(['c']);
  });

  it('keeps preliminary rows until fogosapi has the same earthquake', () => {
    const prelim = [row({ id: 'emsc-1', prelim: true, t: Date.parse('2026-10-28T18:00:00Z') })];
    const before = mergeRows([row({ id: 'old', t: Date.parse('2026-10-28T10:00:00Z') })], prelim);
    expect(before.map((q) => q.id)).toEqual(['emsc-1', 'old']);

    const after = mergeRows([row({ id: 'fogos-9', t: Date.parse('2026-10-28T18:00:05Z') })], prelim);
    expect(after.map((q) => q.id)).toEqual(['fogos-9']);
  });
});
