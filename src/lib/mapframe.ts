import type { Region } from './types';

/** Zoom when there is no nearby place to frame. */
export function detailZoom(r: Region, km: number | null): number {
  if (r === 'outro') return 7;
  if (km == null) return 9;
  return km < 15 ? 10 : km < 40 ? 9 : km < 90 ? 8 : 7;
}

const COMPASS_DEG: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SO: 225, O: 270, NO: 315 };

/**
 * Approximate position of the nearest place, from the epicentre, the distance
 * and the compass bearing *from the place to the epicentre* (so we walk back
 * the opposite way). Good enough to frame both on the map.
 */
export function placeFrom(lat: number, lon: number, km: number, bearing: string): [number, number] | null {
  const deg = COMPASS_DEG[bearing];
  if (deg == null || !(km > 0)) return null;
  const R = 6371;
  const d = km / R;
  const th = ((deg + 180) % 360) * (Math.PI / 180);
  const p1 = lat * (Math.PI / 180);
  const l1 = lon * (Math.PI / 180);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(th));
  const l2 = l1 + Math.atan2(Math.sin(th) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [(l2 * 180) / Math.PI, (p2 * 180) / Math.PI];
}
