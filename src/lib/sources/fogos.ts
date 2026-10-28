import type { Earthquake } from '../types';
import { fetchJson } from './http';

export const FOGOS_BASE = 'https://api.fogos.pt';

/** Earthquakes from fogosapi (v2/seismic/events), newest first. */
export async function fromFogos(from: Date, opts: { base?: string; apiKey?: string } = {}): Promise<Earthquake[]> {
  const url = `${opts.base ?? FOGOS_BASE}/v2/seismic/events?from=${encodeURIComponent(from.toISOString())}&limit=2000`;
  const json = await fetchJson<{ success: boolean; data: Earthquake[] }>(url, opts.apiKey ? { 'X-API-Key': opts.apiKey } : {});
  if (!json?.success || !Array.isArray(json.data)) throw new Error('fogosapi: unexpected payload');
  return json.data;
}
