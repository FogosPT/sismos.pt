import { classify, inBbox } from '../region';
import type { Earthquake } from '../types';
import { fetchJson, magType } from './http';

interface IpmaRow {
  time: string; lat: string; lon: string; depth: number | null; magnitud: string; magType: string;
  obsRegion: string; sensed: boolean | null; degree: string | null; local: string | null;
  sismoId: string; shakemapref: string;
}

/** IPMA open data (areas 3 = Azores, 7 = mainland + Madeira); times are UTC. */
export function parseIpma(json: { data?: IpmaRow[] }): Earthquake[] {
  if (!Array.isArray(json?.data)) throw new Error('ipma: unexpected payload');
  const out: Earthquake[] = [];
  for (const d of json.data) {
    const lat = +d.lat;
    const lon = +d.lon;
    if (!d.time || !Number.isFinite(lat) || !Number.isFinite(lon) || !inBbox(lat, lon)) continue;
    const t = new Date(d.time + 'Z');
    const m = Number(d.magnitud);
    const provisional = !Number.isFinite(m) || m <= -9;
    out.push({
      id: 'ipma-' + (d.sismoId || t.toISOString().replace(/\D/g, '').slice(0, 14)),
      slug: null,
      time: t.toISOString(),
      lat, lon,
      depth: d.depth ?? null,
      magnitude: provisional ? null : m,
      magType: magType(d.magType),
      magnitudeSource: provisional ? null : 'ipma',
      provisional,
      region: classify(lat, lon),
      place: d.obsRegion ? d.obsRegion.replace(/\s+/g, ' ').trim() : null,
      felt: d.sensed === true,
      intensity: d.degree || null,
      intensityMax: null,
      local: d.local || null,
      shakemapUrl: d.shakemapref || null,
      preferredSource: 'ipma',
      sourceNames: ['ipma'],
      updated: null,
    });
  }
  return out;
}

export async function fromIpma(): Promise<Earthquake[]> {
  const areas = await Promise.all([3, 7].map((a) => fetchJson<{ data?: IpmaRow[] }>(`https://api.ipma.pt/open-data/observation/seismic/${a}.json`)));
  return areas.flatMap(parseIpma);
}
