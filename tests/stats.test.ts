import { describe, expect, it } from 'vitest';
import acores30 from './fixtures/stats/acores-30d.json';
import madeira30 from './fixtures/stats/madeira-30d.json';
import pt1y from './fixtures/stats/pt-1y.json';
import ptAll from './fixtures/stats/pt-all.json';
import { asMap, normaliseStats } from '../src/lib/stats/normalise';
import {
  every, headline, parseWindow, stories, storyCompleteness, storyDepth, storyEnergy, storyGutenbergRichter, storyHour, storyRate,
  storySequences, storySources, tnt, windowPhrase,
} from '../src/lib/stats/text';
import type { SeismicStats } from '../src/lib/stats/types';

// Recorded from api.fogos.pt v2/seismic/stats on 2026-10-28.
const load = (j: unknown) => normaliseStats((j as { data: SeismicStats }).data);
const acores = load(acores30);
const madeira = load(madeira30);
const pt = load(pt1y);
const all = load(ptAll);
const text = (s: SeismicStats) => JSON.stringify(stories(s)) + JSON.stringify(headline(s));

describe('normalise', () => {
  it('turns PHP empty arrays into maps', () => {
    expect(asMap([])).toEqual({});
    expect(asMap(null)).toEqual({});
    expect(asMap({ a: 1 })).toEqual({ a: 1 });
    expect(madeira.sourceQuality).toEqual({ magnitudeDifference: {}, latencyMinutes: {} });
  });
});

describe('formatting', () => {
  it('parses the window parameter with a safe default', () => {
    expect(parseWindow('1y')).toBe('1y');
    expect(parseWindow('nope')).toBe('30d');
    expect(parseWindow(null)).toBe('30d');
  });

  it('describes periods and quantities in PT-PT', () => {
    expect(windowPhrase('all', '1915-07-11T11:28:36Z')).toBe('desde 1915');
    expect(windowPhrase('1y')).toBe('no último ano');
    expect(tnt(1450.51)).toBe('1,5 mil toneladas');
    expect(tnt(8633892)).toBe('8,6 milhões de toneladas');
    expect(tnt(2.39)).toBe('2 toneladas');
    expect(every(0.23)).toBe('a cada 3 meses');
    expect(every(1.6)).toBe('a cada 1,6 anos');
    expect(every(11.25)).toBe('a cada 11 anos');
  });
});

describe('stories', () => {
  it('headline counts earthquakes and names the largest', () => {
    const h = headline(acores);
    expect(h.title).toBe('75 sismos nos Açores nos últimos 30 dias.');
    expect(h.sub).toContain('3 foram sentidos');
    expect(h.sub).toContain('magnitude 5,3');
    expect(headline(all).title).toMatch(/^12\s?423 sismos em Portugal desde 1915\.$/);
  });

  it('Gutenberg-Richter needs enough events, and gives return periods for long windows', () => {
    expect(storyGutenbergRichter(acores).say).toContain('poucos sismos');
    const gr = storyGutenbergRichter(pt);
    expect(gr.say).toContain('<em>7</em> de magnitude 2');
    expect(gr.sub).toContain('valor b é 0,85');
    expect(gr.sub).toContain('magnitude 5 ou mais em Portugal ocorre em média a cada 1,6 anos');
    expect(gr.how.join(' ')).toContain('não previsões');
  });

  it('energy is "libertada", never "acumulada"', () => {
    const e = storyEnergy(acores);
    expect(e.say).toContain('libertou <em>93%</em>');
    expect(e.sub).toContain('1,5 mil toneladas de TNT');
    for (const s of [acores, pt, all, madeira]) expect(text(s)).not.toMatch(/acumulad/i);
  });

  it('depth talks about the litosfera and undetermined depths', () => {
    const d = storyDepth(acores);
    expect(d.say).toBe('Metade dos sismos ocorreu a menos de <em>5 km</em> da superfície.');
    expect(d.sub).toContain('litosfera');
    expect(d.sub).toContain('Num sismo, a profundidade não foi determinada.');
    for (const s of [acores, pt, all, madeira]) expect(text(s)).not.toMatch(/crosta|rasos/i);
  });

  it('time of day has no percentage of earthquakes by hour', () => {
    const h = storyHour(acores);
    expect(h.say + h.sub + h.how.join(' ')).not.toMatch(/%|8h|19h/);
  });

  it('rate anomaly is sober', () => {
    const r = storyRate(acores)!;
    expect(r.say).toContain('<em>64</em> sismos de magnitude 2,2 ou mais');
    expect(r.sub).toContain('Não quer dizer que venha aí um sismo maior.');
    expect(storyRate(pt)).toBeNull();
  });

  it('sequences, completeness and sources', () => {
    const q = storySequences(acores)!;
    expect(q.say).toContain('foi seguido de <em>43</em> réplicas');
    expect(q.how.join(' ')).toContain('expoente p é 0,70');
    expect(storySequences(madeira)).toBeNull();
    expect(storyCompleteness(acores)).toBeNull();
    expect(storyCompleteness(all)?.say).toMatch(/^Em \d{4}, o catálogo só registava/);
    expect(storySources(madeira)).toBeNull();
    expect(storySources(pt)!.say).toContain('a mesma magnitude');
  });

  it('escapes data placed in HTML headlines', () => {
    const evil = { ...acores, sequences: [{ ...acores.sequences![0], mainshock: { ...acores.sequences![0].mainshock, place: '<script>x</script>' } }] };
    expect(storySequences(evil)!.say).not.toContain('<script>');
  });
});

import { bucketEnd, bucketLabel, isBucket } from '../src/lib/stats/buckets';

describe('energy buckets (10y / all windows)', () => {
  it('places a bucket total at the end of the bucket, never before its events', () => {
    // The 28 Feb 1969 M7.8 is inside the "1969" bucket: its energy must not show before 1 Jan 1970.
    expect(bucketEnd('1969').toISOString()).toBe('1970-01-01T00:00:00.000Z');
    expect(bucketEnd('1969').getTime()).toBeGreaterThan(Date.parse('1969-02-28T02:40:33Z'));
    expect(bucketEnd('2024-12').toISOString()).toBe('2025-01-01T00:00:00.000Z');
    expect(bucketEnd('2024-03').toISOString()).toBe('2024-04-01T00:00:00.000Z');
  });

  it('labels and recognises buckets', () => {
    expect(isBucket('1969')).toBe(true);
    expect(isBucket('2024-03')).toBe(true);
    expect(isBucket('2026-10-20T18:07:19Z')).toBe(false);
    expect(bucketLabel('1969')).toBe('até ao fim de 1969');
    expect(bucketLabel('2024-03')).toBe('até ao fim de março de 2024');
  });
});
