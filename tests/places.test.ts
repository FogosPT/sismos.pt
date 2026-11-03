import { describe, expect, it } from 'vitest';
import { nearText, placeLabel } from '../src/lib/format';
import { quakeCard } from '../src/lib/og';
import type { Place } from '../src/lib/types';

const place = (o: Partial<Place>): Place => ({ name: 'Vinhais', municipality: 'Vinhais', kind: 'concelho', km: 12.4, bearing: 'SO', ...o });

describe('nearest place text', () => {
  it('reads like Portuguese directions', () => {
    expect(nearText(place({}))).toBe('a 12 km a sudoeste de Vinhais');
    expect(nearText(place({ bearing: 'N', km: 3 }))).toBe('a 3 km a norte de Vinhais');
    expect(nearText(place({ bearing: 'O' }))).toBe('a 12 km a oeste de Vinhais');
    expect(nearText(place({ bearing: 'NO', km: 120.6 }))).toBe('a 121 km a noroeste de Vinhais');
  });

  it('names a parish with its municipality, unless they share the name', () => {
    expect(placeLabel(place({ name: 'Ginetes', municipality: 'Ponta Delgada', kind: 'freguesia' }))).toBe('Ginetes (Ponta Delgada)');
    expect(placeLabel(place({ name: 'Vinhais', municipality: 'Vinhais', kind: 'freguesia' }))).toBe('Vinhais');
    expect(nearText(place({ name: 'Ginetes', municipality: 'Ponta Delgada', kind: 'freguesia', km: 0.4 }))).toBe('em Ginetes (Ponta Delgada)');
  });

  it('says nothing when the place is missing or too far to help', () => {
    expect(nearText(null)).toBeNull();
    expect(nearText(undefined)).toBeNull();
    expect(nearText(place({ km: 400 }))).toBeNull();
  });

  it('adds the line to the share card only when present', () => {
    const text = (n: any): string => (typeof n === 'string' ? n : Array.isArray(n) ? n.map(text).join('|') : n?.props ? text(n.props.children) : '');
    const base = {
      id: 'x', slug: null, time: '2026-10-15T20:34:46.000Z', lat: 42.46, lon: -6.6, depth: 16, magnitude: 4.2, magType: 'ML', region: 'outro',
      place: 'NE Bragança', felt: true, intensity: 'III',
    } as any;
    expect(text(quakeCard({ ...base, nearest: place({ km: 48, bearing: 'NE' }) }))).toContain('A 48 km a nordeste de Vinhais');
    expect(text(quakeCard(base))).not.toContain(' km a ');
  });
});
