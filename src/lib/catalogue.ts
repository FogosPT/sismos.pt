import { edgeCached } from './cache';
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

export const fogosOptions = (env: CatalogueEnv) => ({ base: env.FOGOS_API_BASE, apiKey: env.FOGOS_API_KEY, apiHeader: env.FOGOS_API_HEADER });

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
    ['fogos', () => fromFogos(from, fogosOptions(env))],
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
 * however many readers. Fallback data is kept for less time so fogosapi is
 * retried soon.
 */
export function getCachedCatalogue(env: CatalogueEnv, days = 30): Promise<Catalogue> {
  return edgeCached(`catalogue/${days}`, (c) => (c.source === 'fogos' ? CACHE_SECONDS : 20), () => getCatalogue(env, days), (c) => c.events.length > 0);
}
