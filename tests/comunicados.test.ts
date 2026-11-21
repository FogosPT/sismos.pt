import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from './fixtures/comunicados.json';
import { assign, cleanText, comunicados, editionDate, matchScore, parseVersion, type Comunicado } from '../src/lib/sources/comunicados';

type Fixture = Record<string, { id: string; versions: Parameters<typeof parseVersion>[1][] }>;
const F = fixture as unknown as Fixture;
const all = (): Comunicado[] =>
  Object.values(F).flatMap((c) => c.versions.map((v) => parseVersion(c.id, v)).filter((x): x is Comunicado => x !== null));

const sines = { id: 'sines', time: '2026-11-20T17:37:00.000Z', magnitude: 3.6 };
const sinesAm = { id: 'sines-am', time: '2026-11-20T08:58:07.000Z', magnitude: 3.3 };
const corvo = { id: 'corvo', time: '2026-11-19T14:53:07.000Z', magnitude: 5.1 };
const faial = { id: 'faial', time: '2026-11-01T22:36:59.000Z', magnitude: 3.3 };
const summer = { id: 'summer', time: '2026-07-25T06:52:47.000Z', magnitude: 2.8 };

describe('comunicados', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the edition date as UTC', () => {
    expect(editionDate('<small><em>Data de Edição:</em> <b>Sáb, 25 Jul 2026 06:55:46</b></small>')).toBe('2026-07-25T06:55:46.000Z');
    expect(editionDate(null)).toBeNull();
    // Without the edition date, the archive's pubDate is taken as is.
    expect(parseVersion('x', { versionNumber: 1, title: 'Aviso de Sismo no Continente 25-07-2026 07:52', pubDate: '2026-07-25T06:55:46.000Z' })!.published).toBe('2026-07-25T06:55:46.000Z');
  });

  it('parses title, zone, magnitude and text', () => {
    const c = parseVersion('2026-11-20-sismo-continente-1736', F['2026-11-20-sismo-continente-1736'].versions[0])!;
    expect(c).toMatchObject({ local: '2026-11-20T17:36', zones: ['Europe/Lisbon'], magnitude: 3.6, felt: false, published: '2026-11-20T17:43:42.000Z' });
    expect(c.url).toBe('https://comunicados-ipma.vost.pt/c/2026-11-20-sismo-continente-1736/v/1');
    expect(c.text).toMatch(/^O Instituto Português do Mar e da Atmosfera informa/);
    expect(c.text).not.toMatch(/localização do epicentro/);
    const az = parseVersion('x', F['2026-11-01-aviso-sismo-sentido-arquipelago-acores-01'].versions[0])!;
    expect(az).toMatchObject({ zones: ['Atlantic/Azores'], felt: true });
    // "Rede Sísmica Nacional" near Corvo: no zone in the text, try them all.
    expect(parseVersion('x', F['2026-11-19-aviso-sismo-19-11-2026-13'].versions[0])!.zones).toHaveLength(3);
    expect(parseVersion('x', { versionNumber: 1, title: 'Chuva e vento - Comunicado nº1', pubDate: '2026-11-10T17:07:58.000Z' })).toBeNull();
    expect(cleanText(null)).toBeNull();
  });

  it('matches on local minute and magnitude', () => {
    const [v2, v1] = F['2026-11-20-aviso-sismo-sentido-continente-20-11'].versions.map((v) => parseVersion('id', v)!);
    expect(matchScore(v2, sines)).toBe(0);
    expect(matchScore(v1, sines)).toBeNull();
    expect(matchScore(v1, sinesAm)).toBe(0);
    expect(matchScore(v2, { ...sines, magnitude: 5 })).toBeNull();
    // 17:36 stamp, origin 17:37:00 → 0 s past the minute's end.
    expect(matchScore(parseVersion('a', F['2026-11-20-sismo-continente-1736'].versions[0])!, sines)).toBe(0);
    expect(matchScore(v2, { ...sines, time: '2026-11-20T17:41:00.000Z' })).toBeNull();
  });

  it('assigns each version (same archive id, different earthquakes) to its earthquake', () => {
    const m = assign(all(), [sines, sinesAm, corvo, faial, summer]);
    expect(m.get('sines')!.map((c) => c.title)).toEqual([
      'Aviso de Sismo no Continente 20-11-2026 17:36',
      'Aviso de Sismo Sentido no Continente 20-11-2026 17:37',
    ]);
    expect(m.get('sines-am')!.map((c) => c.version)).toEqual([1]);
    expect(m.get('corvo')).toHaveLength(1); // Azores local time (UTC−1)
    expect(m.get('faial')).toHaveLength(2);
    expect(m.get('summer')![0].published).toBe('2026-07-25T06:55:46.000Z');
  });

  it('fetches only what it needs from the archive', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (u: string) => {
      urls.push(u);
      const id = decodeURIComponent(u.match(/comunicados\/([^?]+)$/)?.[1] ?? '');
      const body = id
        ? F[id]
        : {
            items: Object.values(F).map((c) => ({ id: c.id, category: 'sismologia', title: c.versions[0].title, pubDate: c.versions[0].pubDate, versionCount: c.versions.length })),
            nextBefore: null,
          };
      return new Response(JSON.stringify(body));
    });
    const cs = await comunicados(new Date('2026-11-15T00:00:00Z'), null);
    // Only the multi-version id in range is expanded (01-11 and July are older).
    expect(urls.filter((u) => !u.includes('?')).map((u) => u.split('/').pop())).toEqual(['2026-11-20-aviso-sismo-sentido-continente-20-11']);
    expect(cs.map((c) => c.local).sort()).toEqual(['2026-11-19T13:53', '2026-11-20T08:58', '2026-11-20T17:36', '2026-11-20T17:37']);
    expect(urls[0]).toContain('category=sismologia');
  });

  it('follows the archive cursor down to the start of the range', async () => {
    const items = Object.values(F)
      .map((c) => ({ id: c.id, category: 'sismologia', title: c.versions[0].title, pubDate: c.versions[0].pubDate, versionCount: c.versions.length }))
      .sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate));
    const pages: string[] = [];
    vi.stubGlobal('fetch', async (u: string) => {
      const url = new URL(u);
      if (!url.search) return new Response(JSON.stringify(F[decodeURIComponent(url.pathname.split('/').pop()!)]));
      const before = url.searchParams.get('before');
      pages.push(before ?? '');
      const page = items.filter((i) => !before || i.pubDate < before).slice(0, Number(url.searchParams.get('limit')));
      return new Response(JSON.stringify({ items: page, nextBefore: page.length ? page.at(-1)!.pubDate : null }));
    });
    const cs = await comunicados(new Date('2026-11-19T00:00:00Z'), null, () => false, 2);
    expect(cs.map((c) => c.local).sort()).toEqual(['2026-11-19T13:53', '2026-11-20T08:58', '2026-11-20T17:36', '2026-11-20T17:37']);
    // Stops at the page that crosses the lower bound (the 01-11 entry), not at the end of the archive.
    expect(pages).toHaveLength(2);
  });
});
