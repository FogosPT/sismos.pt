import { afterEach, describe, expect, it, vi } from 'vitest';
import emsc from './fixtures/emsc.json';
import ipma from './fixtures/ipma-3.json';
import usgs from './fixtures/usgs.json';
import { getCatalogue } from '../src/lib/catalogue';
import { depthLong, depthShort, feltLocal, fmtMag, placeName, relative } from '../src/lib/format';
import { classify } from '../src/lib/region';
import { parseEmsc, parseUsgs } from '../src/lib/sources/fdsn';
import { magType } from '../src/lib/sources/http';
import { parseIpma } from '../src/lib/sources/ipma';
import { summarise } from '../src/lib/summary';

describe('region', () => {
  it.each([
    [38.72, -9.14, 'continente'],
    [36.6, -11.5, 'continente'],
    [42.462, -6.602, 'outro'],
    [37.74, -25.67, 'acores'],
    [30.14, -15.87, 'madeira'],
    [28.1, -15.4, 'outro'],
  ])('%f,%f → %s (same as fogosapi)', (lat, lon, r) => expect(classify(lat, lon)).toBe(r));
});

describe('format', () => {
  it('names places and felt localities in Portuguese', () => {
    expect(placeName('NE  Bragança')).toBe('A nordeste de Bragança');
    expect(placeName('Fossa de Hirondelle')).toBe('Fossa de Hirondelle');
    expect(placeName(null)).toBe('Local por determinar');
    expect(feltLocal('S.Miguel: Ginetes (Ponta Delgada)')).toBe('S. Miguel, Ginetes (Ponta Delgada)');
  });

  it('treats depth 0 as undetermined', () => {
    expect(depthLong(0)).toBe('não determinada');
    expect(depthShort(0)).toBe('prof. n/d');
    expect(depthShort(12.4)).toBe('12 km');
  });

  it('formats magnitudes and relative times', () => {
    expect(fmtMag(3.9)).toBe('3,9');
    expect(fmtMag(null)).toBe('—');
    const now = Date.parse('2026-10-28T16:00:00Z');
    expect(relative(now - 30e3, now)).toBe('agora mesmo');
    expect(relative(now - 60e3, now)).toBe('há 1 minuto');
    expect(relative(now - 3 * 36e5, now)).toBe('há 3 horas');
    expect(relative(now - 2 * 864e5, now)).toBe('há 2 dias');
  });

  it('normalises magnitude types like fogosapi', () => {
    expect(['ml', 'L', 'Mw', 'mww', 'mbLg', 'M', ''].map(magType)).toEqual(['ML', 'ML', 'MW', 'MWW', 'MBLG', 'M', null]);
  });
});

describe('fallback parsers', () => {
  it('parses IPMA', () => {
    const qs = parseIpma(ipma as any);
    const main = qs.find((q) => q.time === '2026-10-20T18:07:19.000Z')!;
    expect(main).toMatchObject({ magnitude: 5.3, magType: 'MW', region: 'acores', felt: true, intensity: 'IV/V', id: 'ipma-20261020180718A' });
  });

  it('parses EMSC and USGS', () => {
    expect(parseEmsc(emsc as any)).toHaveLength(7);
    const [u] = parseUsgs(usgs as any);
    expect(u).toMatchObject({ id: 'usgs-us6000u3p1', magnitude: 5.1, magType: 'MWW', depth: 10, felt: true, region: 'acores' });
  });

  it('rejects garbage', () => {
    expect(() => parseIpma({} as any)).toThrow();
    expect(() => parseEmsc({} as any)).toThrow();
  });
});

describe('catalogue fallback chain', () => {
  afterEach(() => vi.unstubAllGlobals());
  const now = new Date('2026-10-28T16:00:00Z');

  const respond = (routes: Record<string, () => Response>) =>
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const host = new URL(url).host;
      const route = Object.entries(routes).find(([h]) => host.includes(h));
      if (!route) throw new Error(`unexpected ${url}`);
      return route[1]();
    }));

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it('uses fogosapi when it answers', async () => {
    respond({ 'api.fogos.pt': () => json({ success: true, data: [{ id: 'a', time: '2026-10-28T15:00:00.000Z', region: 'acores', magnitude: 3 }] }) });
    const c = await getCatalogue({}, 30, now);
    expect(c.source).toBe('fogos');
    expect(c.events).toHaveLength(1);
  });

  it('falls back to IPMA, then EMSC, when fogosapi is down', async () => {
    const recentIpma = { data: (ipma as any).data.map((d: any) => ({ ...d, time: '2026-10-27T10:00:00' })) };
    respond({ 'api.fogos.pt': () => json({}, 502), 'api.ipma.pt': () => json(recentIpma) });
    expect((await getCatalogue({}, 30, now)).source).toBe('ipma');

    respond({ 'api.fogos.pt': () => json({}, 502), 'api.ipma.pt': () => json({}, 500), seismicportal: () => json(emsc) });
    const c = await getCatalogue({}, 30, now);
    expect(c.source).toBe('emsc');
    expect(c.events.length).toBeGreaterThan(0);
  });

  it('records why fogosapi was skipped (WAF / challenge pages)', async () => {
    const recentIpma = { data: (ipma as any).data.map((d: any) => ({ ...d, time: '2026-10-27T10:00:00' })) };
    respond({
      'api.fogos.pt': () => new Response('<html><title>Just a moment...</title></html>', { status: 403, headers: { 'cf-ray': 'abc-LIS' } }),
      'api.ipma.pt': () => json(recentIpma),
    });
    const c = await getCatalogue({ FOGOS_API_KEY: 'k' }, 30, now);
    expect(c.source).toBe('ipma');
    expect(c.errors?.[0]).toMatch(/^fogos: api\.fogos\.pt: HTTP 403 \(cf-ray abc-LIS\) — <html><title>Just a moment/);
  });

  it('reports a 200 that is not JSON', async () => {
    respond({ 'api.fogos.pt': () => new Response('<html>blocked</html>', { headers: { 'content-type': 'text/html' } }), 'api.ipma.pt': () => json({}, 500), seismicportal: () => json(emsc) });
    const c = await getCatalogue({ FOGOS_API_KEY: 'k' }, 30, now);
    expect(c.errors?.[0]).toMatch(/not JSON \(text\/html\)/);
  });

  it('says when the token is missing', async () => {
    respond({ 'api.fogos.pt': () => json({ success: true, data: [{ id: 'a', time: '2026-10-28T15:00:00.000Z', region: 'acores', magnitude: 3 }] }) });
    expect((await getCatalogue({}, 30, now)).errors).toEqual(['fogos: FOGOS_API_KEY not set (api.fogos.pt needs a token)']);
  });

  it('can send the token in another header', async () => {
    const f = vi.fn(async () => json({ success: true, data: [] }));
    vi.stubGlobal('fetch', f);
    await getCatalogue({ FOGOS_API_KEY: 'k', FOGOS_API_HEADER: 'FPTSC' }, 30, now).catch(() => {});
    expect((f.mock.calls[0] as any)[1].headers.FPTSC).toBe('k');
  });

  it('sends the API key when configured', async () => {
    const f = vi.fn(async () => json({ success: true, data: [] }));
    vi.stubGlobal('fetch', f);
    await getCatalogue({ FOGOS_API_KEY: 'k' }, 30, now).catch(() => {});
    expect((f.mock.calls[0] as any)[1].headers['X-API-Key']).toBe('k');
  });
});

describe('summary', () => {
  it('ignores events outside Portugal for the headline', () => {
    const now = Date.parse('2026-10-28T16:00:00Z');
    const ev = (time: string, region: any, magnitude: number, felt = false) => ({ time, region, magnitude, felt }) as any;
    const s = summarise([ev('2026-10-28T15:00:00Z', 'outro', 4), ev('2026-10-28T14:00:00Z', 'acores', 2, true), ev('2026-10-01T10:00:00Z', 'madeira', 3)], now);
    expect(s.latest?.region).toBe('acores');
    expect(s.counts).toEqual({ continente: 0, acores: 1, madeira: 1 });
    expect(s.felt30).toBe(1);
    expect(s.largest30?.magnitude).toBe(3);
  });
});
