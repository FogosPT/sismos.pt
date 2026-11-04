import { edgeCached } from './cache';
import { fogosOptions, type CatalogueEnv } from './catalogue';
import { fogosEvents } from './sources/fogos';
import { getCachedStats } from './stats/source';
import type { SeriesPoint, YearCompleteness } from './stats/types';
import { isPt, largest } from './summary';
import type { Earthquake, PtRegion } from './types';
import { REGIONS } from './types';

/** Events listed on a year page; below this the catalogue is mostly micro-seismicity. */
export const YEAR_LIST_MIN_MAGNITUDE = 2.5;

export const FIRST_YEAR = 1900;

export interface YearCount {
  year: number;
  n: number;
  maxM: number | null;
}

/** Years with earthquakes (all of Portugal), from the precomputed yearly series. */
export async function yearCounts(env: CatalogueEnv): Promise<{ years: YearCount[]; completeness: YearCompleteness[] } | null> {
  const r = await getCachedStats(env, 'pt', 'all');
  if (!r.ok) return null;
  const years = r.stats.series.data
    .map((p: SeriesPoint) => ({ year: Number(p.t), n: p.n, maxM: p.maxM }))
    .filter((y) => Number.isInteger(y.year))
    .sort((a, b) => a.year - b.year);
  return { years, completeness: r.stats.completenessByYear ?? [] };
}

/** Count per region for one year, from each region's yearly series. */
export async function regionCounts(env: CatalogueEnv, year: number): Promise<Partial<Record<PtRegion, number>>> {
  const out: Partial<Record<PtRegion, number>> = {};
  await Promise.all(
    REGIONS.map(async (r) => {
      const s = await getCachedStats(env, r, 'all');
      if (s.ok) out[r] = s.stats.series.data.find((p) => Number(p.t) === year)?.n ?? 0;
    }),
  );
  return out;
}

export interface YearData {
  year: number;
  /** Portuguese earthquakes with M ≥ YEAR_LIST_MIN_MAGNITUDE, newest first. */
  events: Earthquake[];
  /** Felt earthquakes of any magnitude, newest first. */
  felt: Earthquake[];
  truncated: boolean;
}

/** The year's notable earthquakes; cached 6 h for past years, 10 min for the current one. */
export function yearData(env: CatalogueEnv, year: number, now = new Date()): Promise<YearData> {
  const current = year >= now.getUTCFullYear();
  return edgeCached(`historico/${year}`, current ? 600 : 6 * 3600, async () => {
    const range = { from: `${year}-01-01T00:00:00Z`, to: `${year}-12-31T23:59:59Z` };
    const [main, felt] = await Promise.all([
      fogosEvents({ ...range, minmag: YEAR_LIST_MIN_MAGNITUDE }, fogosOptions(env)),
      fogosEvents({ ...range, felt: true }, fogosOptions(env), 1),
    ]);
    return { year, events: main.events.filter(isPt), felt: felt.events.filter(isPt), truncated: main.truncated };
  });
}

/** Events per calendar month (UTC), January first. */
export function byMonth(events: Earthquake[]): number[] {
  const months = Array(12).fill(0);
  for (const q of events) months[new Date(q.time).getUTCMonth()]++;
  return months;
}

export function topByMagnitude(events: Earthquake[], n = 10): Earthquake[] {
  return events
    .filter((q) => q.magnitude != null)
    .slice()
    .sort((a, b) => (b.magnitude as number) - (a.magnitude as number) || Date.parse(a.time) - Date.parse(b.time))
    .slice(0, n);
}

export { largest };

export const isValidYear = (y: number, now = new Date()) => Number.isInteger(y) && y >= FIRST_YEAR && y <= now.getUTCFullYear();
