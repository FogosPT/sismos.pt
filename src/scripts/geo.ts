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
