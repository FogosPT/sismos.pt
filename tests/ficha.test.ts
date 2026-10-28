import { describe, expect, it } from 'vitest';
import { latencyLabel, sourceRows } from '../src/lib/detail';
import { hasPage, parseQuakeRef, quakePath, quakeUrl } from '../src/lib/links';
import { quakeCard, siteCard } from '../src/lib/og';
import type { EarthquakeDetail } from '../src/lib/types';

const base = {
  id: '6ae221717daeaf4d3c05b40a', slug: '2026-10-20-1807-m5-3-fossa-de-hirondelle', time: '2026-10-20T18:07:19.000Z',
  lat: 37.854, lon: -26.272, depth: 2, magnitude: 5.3, magType: 'MW', magnitudeSource: 'ipma', provisional: false, region: 'acores',
  place: 'Fossa de Hirondelle', felt: true, intensity: 'IV/V', intensityMax: 4.5, local: null, shakemapUrl: null, preferredSource: 'ipma',
  sourceNames: ['ipma', 'emsc'], updated: null, aftershocks: { window: null, count: 0, data: [] }, nearbyHistory: [],
} as const;

const report = (o: Partial<EarthquakeDetail['sources'][string]>) => ({
  id: 'x', time: base.time, lat: base.lat, lon: base.lon, depth: 10, magnitude: 5.1, magType: 'mw', place: null, felt: null,
  intensity: null, local: null, url: null, updatedAt: null, ...o,
});

describe('links', () => {
  it('parses refs and builds canonical paths', () => {
    expect(parseQuakeRef('6ae221717daeaf4d3c05b40a-2026-10-20-1807-m5-3-fossa-de-hirondelle')).toEqual({ id: '6ae221717daeaf4d3c05b40a', slug: '2026-10-20-1807-m5-3-fossa-de-hirondelle' });
    expect(parseQuakeRef('6ae221717daeaf4d3c05b40a')).toEqual({ id: '6ae221717daeaf4d3c05b40a', slug: '' });
    expect(parseQuakeRef('ipma-20261020180718A')).toBeNull();
    expect(quakePath(base)).toBe('/sismo/6ae221717daeaf4d3c05b40a-2026-10-20-1807-m5-3-fossa-de-hirondelle');
  });

  it('only fogosapi earthquakes have pages', () => {
    expect(hasPage({ id: 'ipma-20261020180718A' })).toBe(false);
    expect(quakeUrl({ id: 'emsc-1', slug: null })).toBeNull();
    expect(quakeUrl(base)).toMatch(/^\/sismo\//);
  });
});

describe('source rows', () => {
  it('orders catalogues, measures differences and only reports live latency', () => {
    const q = {
      ...base,
      sources: {
        emsc: report({ time: '2026-10-20T18:07:18.920Z', lat: 37.9318, lon: -26.2788, firstSeenAt: '2026-10-20T18:15:19Z' }),
        ipma: report({ magnitude: 5.3, depth: 2, firstSeenAt: '2026-10-28T16:23:13Z' }),
        usgs: report({ magType: 'mww', firstSeenAt: null }),
      },
    } as unknown as EarthquakeDetail;
    const rows = sourceRows(q);

    expect(rows.map((r) => r.name)).toEqual(['ipma', 'emsc', 'usgs']);
    expect(rows[0].preferred).toBe(true);
    // IPMA seen 8 days later = import, not latency.
    expect(rows[0].latencyMs).toBeNull();
    expect(rows[1].latencyMs).toBe(8 * 6e4 + 0.08e3);
    expect(rows[1].dtSeconds).toBeCloseTo(-0.08, 2);
    expect(rows[1].km).toBeCloseTo(8.7, 0);
    expect(rows[2].magType).toBe('MWW');
  });

  it('labels latencies', () => {
    expect(latencyLabel(42e3)).toBe('42 s');
    expect(latencyLabel(8 * 6e4)).toBe('8 min');
    expect(latencyLabel(5.5 * 36e5)).toBe('5,5 h');
  });
});

describe('og cards', () => {
  const text = (n: any): string => (typeof n === 'string' ? n : Array.isArray(n) ? n.map(text).join('') : n?.props ? text(n.props.children) : '');

  it('renders the magnitude, place and local time', () => {
    const t = text(quakeCard(base as any));
    expect(t).toContain('5,3');
    expect(t).toContain('Fossa de Hirondelle, Açores');
    expect(t).toContain('18:07 hora dos Açores');
    expect(t).toContain('sentido (IV/V)');
  });

  it('handles provisional magnitudes and the site card', () => {
    expect(text(quakeCard({ ...base, magnitude: null, depth: 0, felt: false } as any))).toContain('profundidade não determinada');
    expect(text(siteCard())).toContain('sismos.pt');
  });
});
