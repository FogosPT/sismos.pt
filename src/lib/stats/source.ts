import type { CatalogueEnv } from '../catalogue';
import { FOGOS_BASE } from '../sources/fogos';
import { USER_AGENT } from '../sources/http';
import { normaliseStats } from './normalise';
import type { SeismicStats, StatsRegion, StatsResult, StatsWindow } from './types';

/** Stats are recomputed hourly by fogosapi; 5 minutes at the edge is plenty. */
export const STATS_CACHE_SECONDS = 300;

/** fogosapi `v2/seismic/stats` (precomputed, see SeismicStatsBuilder). */
export async function fromFogosStats(region: StatsRegion, window: StatsWindow, env: CatalogueEnv): Promise<StatsResult> {
  const url = `${env.FOGOS_API_BASE ?? FOGOS_BASE}/v2/seismic/stats?region=${region}&window=${window}`;
  const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': USER_AGENT };
  // api.fogos.pt requires the token for requests coming from Workers.
  if (env.FOGOS_API_KEY) headers[env.FOGOS_API_HEADER || 'X-API-Key'] = env.FOGOS_API_KEY;

  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    if (res.status === 404) return { ok: false, reason: 'not_computed' };
    if (!res.ok) {
      console.warn(`[stats] ${region}/${window}: HTTP ${res.status}`);
      return { ok: false, reason: 'unavailable' };
    }
    const json = (await res.json()) as { success?: boolean; computedAt?: string; data?: SeismicStats };
    if (!json?.success || !json.data) return { ok: false, reason: 'unavailable' };
    return { ok: true, stats: normaliseStats(json.data), computedAt: json.computedAt ?? null };
  } catch (e) {
    console.warn(`[stats] ${region}/${window}:`, (e as Error).message);
    return { ok: false, reason: 'unavailable' };
  }
}

/** Edge-cached fromFogosStats; only successful answers are cached. */
export async function getCachedStats(env: CatalogueEnv, region: StatsRegion, window: StatsWindow): Promise<StatsResult> {
  const cache = (globalThis as any).caches?.default as Cache | undefined;
  const key = new Request(`https://cache.sismos.pt/stats/${region}/${window}`);
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return (await hit.json()) as StatsResult;
  }

  const result = await fromFogosStats(region, window, env);
  if (cache && result.ok) {
    await cache.put(key, new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${STATS_CACHE_SECONDS}` },
    }));
  }
  return result;
}
