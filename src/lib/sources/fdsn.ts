import { BBOX, classify } from '../region';
import type { Earthquake } from '../types';
import { fetchJson, magType } from './http';

interface Feature {
  id: string;
  geometry: { coordinates: number[] };
  properties: Record<string, any>;
}

function base(source: 'emsc' | 'usgs', id: string, t: Date, lat: number, lon: number): Earthquake {
  return {
    id: `${source}-${id}`, slug: null, time: t.toISOString(), lat, lon, depth: null, magnitude: null, magType: null,
    magnitudeSource: source, provisional: false, region: classify(lat, lon), place: null, felt: false, intensity: null,
    intensityMax: null, local: null, shakemapUrl: null, preferredSource: source, sourceNames: [source], updated: null,
  };
}

/** EMSC FDSN GeoJSON. Explosions / quarry blasts are dropped. */
export function parseEmsc(json: { features?: Feature[] }): Earthquake[] {
  if (!Array.isArray(json?.features)) throw new Error('emsc: unexpected payload');
  return json.features
    .filter((f) => ['ke', 'se', '', undefined].includes(f.properties?.evtype))
    .map((f) => {
      const p = f.properties;
      const q = base('emsc', String(p.unid ?? f.id), new Date(p.time), +p.lat, +p.lon);
      return { ...q, depth: p.depth ?? null, magnitude: p.mag ?? null, magType: magType(p.magtype), place: p.flynn_region ?? null };
    });
}

/** USGS FDSN GeoJSON (coverage in Portugal is roughly M4+). */
export function parseUsgs(json: { features?: Feature[] }): Earthquake[] {
  if (!Array.isArray(json?.features)) throw new Error('usgs: unexpected payload');
  return json.features.map((f) => {
    const p = f.properties;
    const [lon, lat, depth] = f.geometry.coordinates;
    const q = base('usgs', f.id, new Date(p.time), lat, lon);
    return { ...q, depth: depth ?? null, magnitude: p.mag ?? null, magType: magType(p.magType), place: p.place ?? null, felt: !!p.felt };
  });
}

const iso = (d: Date) => d.toISOString().slice(0, 19);

export async function fromEmsc(from: Date): Promise<Earthquake[]> {
  const q = new URLSearchParams({
    format: 'json', starttime: iso(from), minlat: `${BBOX.minLat}`, maxlat: `${BBOX.maxLat}`,
    minlon: `${BBOX.minLon}`, maxlon: `${BBOX.maxLon}`, orderby: 'time', limit: '2000',
  });
  return parseEmsc(await fetchJson(`https://www.seismicportal.eu/fdsnws/event/1/query?${q}`));
}

export async function fromUsgs(from: Date): Promise<Earthquake[]> {
  const q = new URLSearchParams({
    format: 'geojson', starttime: iso(from), minlatitude: `${BBOX.minLat}`, maxlatitude: `${BBOX.maxLat}`,
    minlongitude: `${BBOX.minLon}`, maxlongitude: `${BBOX.maxLon}`, orderby: 'time',
  });
  return parseUsgs(await fetchJson(`https://earthquake.usgs.gov/fdsnws/event/1/query?${q}`));
}
