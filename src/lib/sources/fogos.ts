import type { Earthquake, EarthquakeDetail } from '../types';
import { fetchJson } from './http';

export const FOGOS_BASE = 'https://api.fogos.pt';

/** Earthquakes from fogosapi (v2/seismic/events), newest first. */
export interface FogosOptions {
  base?: string;
  apiKey?: string;
  apiHeader?: string;
}

// api.fogos.pt requires a token (https://fogos.pt/pt/api) for requests from Workers.
const auth = (o: FogosOptions): Record<string, string> => (o.apiKey ? { [o.apiHeader || 'X-API-Key']: o.apiKey } : {});

export async function fromFogos(from: Date, opts: FogosOptions = {}): Promise<Earthquake[]> {
  const url = `${opts.base ?? FOGOS_BASE}/v2/seismic/events?from=${encodeURIComponent(from.toISOString())}&limit=2000`;
  const json = await fetchJson<{ success: boolean; data: Earthquake[] }>(url, auth(opts));
  if (!json?.success || !Array.isArray(json.data)) throw new Error('fogosapi: unexpected payload');
  return json.data;
}

/** One earthquake with every source, aftershocks and local history; null when unknown. */
export async function fogosDetail(id: string, opts: FogosOptions = {}): Promise<EarthquakeDetail | null> {
  try {
    const json = await fetchJson<{ success: boolean; data: EarthquakeDetail }>(`${opts.base ?? FOGOS_BASE}/v2/seismic/events/${id}`, auth(opts));
    return json?.success ? json.data : null;
  } catch (e) {
    if (/HTTP 404/.test((e as Error).message)) return null;
    throw e;
  }
}

export interface SitemapPage {
  page: number;
  pages: number;
  total: number;
  data: { id: string; slug: string; region: string; magnitude: number | null; updated: string }[];
}

export async function fogosSitemap(page: number, minMagnitude: number, opts: FogosOptions = {}): Promise<SitemapPage> {
  return fetchJson<SitemapPage>(`${opts.base ?? FOGOS_BASE}/v2/seismic/sitemap?page=${page}&minmag=${minMagnitude}`, auth(opts), 15000);
}
