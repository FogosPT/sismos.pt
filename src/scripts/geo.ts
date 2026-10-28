import { geoMercator, type GeoProjection } from 'd3-geo';
import geo from '../data/geo.json';
import { EXTENT } from '../lib/region';
import type { PtRegion } from '../lib/types';

export type Ring = [number, number][];
export const COAST = geo.COAST as unknown as Record<PtRegion, Ring[]>;
export const BORDERS = geo.BORDERS as unknown as Ring[];
export const PLATES = geo.PLATES as unknown as Ring[];

export function projectionFor(r: PtRegion, w: number, h: number, pad: number): GeoProjection {
  const b = EXTENT[r];
  return geoMercator().fitExtent([[pad, pad], [w - pad, h - pad]], { type: 'MultiPoint', coordinates: [[b[0], b[1]], [b[2], b[3]]] });
}

export const ringPath = (rings: Ring[], p: GeoProjection, close = true) =>
  rings.map((r) => 'M' + r.map((c) => p(c)!.map((v) => v.toFixed(1)).join(',')).join('L') + (close ? 'Z' : '')).join('');

/** Area each coastline set was clipped to ([minLon, minLat, maxLon, maxLat], see build). */
const COAST_BOUNDS: Record<PtRegion, [number, number, number, number]> = {
  continente: [-17.3, 31.6, 4.4, 46.4],
  acores: [-31.3, 32.4, -14.4, 44.2],
  madeira: [-25.2, 25.8, -5.5, 37.3],
};

/** The coastline set that covers a point (for events outside the three regions). */
export function coastFor(lat: number, lon: number): PtRegion {
  const hit = (Object.keys(COAST_BOUNDS) as PtRegion[]).find((r) => {
    const [x0, y0, x1, y1] = COAST_BOUNDS[r];
    return lon >= x0 && lon <= x1 && lat >= y0 && lat <= y1;
  });
  return hit ?? 'continente';
}

/** A view centred on a point, `span` degrees of latitude each way. */
export function projectionAround(lat: number, lon: number, w: number, h: number, pad: number, span = 2.5): GeoProjection {
  const dLon = (span * 1.6) / Math.cos((lat * Math.PI) / 180);
  return geoMercator().fitExtent([[pad, pad], [w - pad, h - pad]], { type: 'MultiPoint', coordinates: [[lon - dLon, lat - span], [lon + dLon, lat + span]] });
}
