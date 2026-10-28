import { distanceKm } from './geo-math';
import { magType } from './sources/http';
import type { EarthquakeDetail, SourceReport } from './types';

/** Display order of catalogues on the page. */
export const SOURCE_ORDER = ['ipma', 'emsc', 'usgs', 'geofon', 'ign', 'isc'];

/** Approximate Moho depth (crust–mantle boundary), km, for the cross-section. */
export const MOHO: Record<string, number> = { continente: 30, acores: 13, madeira: 15, outro: 30 };

/** Reports first seen this long after the origin are imports, not publication latency. */
export const LIVE_LATENCY_MS = 12 * 36e5;

export interface SourceRow {
  name: string;
  report: SourceReport;
  magType: string | null;
  /** Origin-time difference to the preferred solution, seconds. */
  dtSeconds: number;
  /** Epicentre distance to the preferred solution, km. */
  km: number;
  /** How long after the origin we first saw it, ms; null when not live. */
  latencyMs: number | null;
  preferred: boolean;
}

export function sourceRows(q: EarthquakeDetail): SourceRow[] {
  const t0 = Date.parse(q.time);
  return Object.entries(q.sources ?? {})
    .sort(([a], [b]) => SOURCE_ORDER.indexOf(a) - SOURCE_ORDER.indexOf(b))
    .map(([name, r]) => {
      const seen = r.firstSeenAt ? Date.parse(r.firstSeenAt) - Date.parse(r.time) : null;
      return {
        name,
        report: r,
        magType: magType(r.magType),
        dtSeconds: (Date.parse(r.time) - t0) / 1000,
        km: distanceKm(q.lat, q.lon, r.lat, r.lon),
        latencyMs: seen != null && seen >= 0 && seen < LIVE_LATENCY_MS ? seen : null,
        preferred: name === q.preferredSource,
      };
    });
}

/** log10 E[J] = 1.5 M + 4.8 (Gutenberg & Richter). */
export const energyJ = (m: number) => 10 ** (1.5 * m + 4.8);
export const TNT_TONNE_J = 4.184e9;

export function latencyLabel(ms: number): string {
  if (ms < 6e4) return `${Math.round(ms / 1e3)} s`;
  if (ms < 36e5) return `${Math.round(ms / 6e4)} min`;
  return `${(ms / 36e5).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} h`;
}
