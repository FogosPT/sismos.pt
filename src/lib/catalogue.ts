import { fromEmsc, fromUsgs } from './sources/fdsn';
import { fromFogos } from './sources/fogos';
import { fromIpma } from './sources/ipma';
import type { Catalogue, Earthquake, Source } from './types';

export interface CatalogueEnv {
  FOGOS_API_KEY?: string;
  FOGOS_API_BASE?: string;
  /** Header that carries the token; default X-API-Key. */
  FOGOS_API_HEADER?: string;
}

/** How long a catalogue is reused at the edge before asking again. */
export const CACHE_SECONDS = 60;

/**
 * The last `days` days of earthquakes, newest first.
 *
 * fogosapi is the primary (merged, archived catalogue). If it is down the site
 * keeps working from the raw feeds, in order IPMA → EMSC → USGS, and tells the
 * reader which source it is showing.
 */
export async function getCatalogue(env: CatalogueEnv, days = 30, now = new Date()): Promise<Catalogue> {
  const from = new Date(now.getTime() - days * 864e5);
  const chain: [Source, () => Promise<Earthquake[]>][] = [
    ['fogos', () => fromFogos(from, { base: env.FOGOS_API_BASE, apiKey: env.FOGOS_API_KEY, apiHeader: env.FOGOS_API_HEADER })],
    ['ipma', () => fromIpma()],
    ['emsc', () => fromEmsc(from)],
    ['usgs', () => fromUsgs(from)],
  ];

  const errors: string[] = env.FOGOS_API_KEY ? [] : ['fogos: FOGOS_API_KEY not set (api.fogos.pt needs a token)'];
  for (const [source, load] of chain) {
    try {
      const events = (await load())
        .filter((q) => Date.parse(q.time) >= from.getTime())
        .sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
      if (events.length || source === 'usgs') {
        if (errors.length) console.warn(`[catalogue] using ${source}; skipped:`, errors.join(' | '));
        return { source, fetchedAt: now.toISOString(), events, errors };
      }
      errors.push(`${source}: empty`);
    } catch (e) {
      const err = e as Error;
      errors.push(`${source}: ${err.name === 'TimeoutError' ? 'timeout' : err.message}`);
    }
  }

  console.error('[catalogue] every source failed', errors);
  return { source: 'usgs', fetchedAt: now.toISOString(), events: [], errors };
}

/**
 * Edge-cached getCatalogue: one upstream call per minute per data centre,
 * however many readers. Falls back to a direct call where `caches` does not
 * exist (tests, Node).
 */
export async function getCachedCatalogue(env: CatalogueEnv, days = 30): Promise<Catalogue> {
  const cache = (globalThis as any).caches?.default as Cache | undefined;
  const key = new Request(`https://cache.sismos.pt/catalogue/${days}`);
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return (await hit.json()) as Catalogue;
  }

  const catalogue = await getCatalogue(env, days);
  if (cache && catalogue.events.length) {
    // Fallback data is cached for less time so fogosapi is retried soon.
    const ttl = catalogue.source === 'fogos' ? CACHE_SECONDS : 20;
    await cache.put(key, new Response(JSON.stringify(catalogue), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${ttl}` },
    }));
  }
  return catalogue;
}
