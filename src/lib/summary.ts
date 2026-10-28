import { quakeUrl } from './links';
import type { Earthquake, PtRegion } from './types';
import { REGIONS } from './types';

const DAY = 864e5;
const t = (q: Earthquake) => Date.parse(q.time);

export const isPt = (q: Earthquake): q is Earthquake & { region: PtRegion } => q.region !== 'outro';

export function within(events: Earthquake[], now: number, days: number) {
  return events.filter((q) => now - t(q) < days * DAY);
}

export function largest(events: Earthquake[]): Earthquake | null {
  return events.reduce<Earthquake | null>((a, q) => (q.magnitude != null && (!a || q.magnitude > (a.magnitude ?? -9)) ? q : a), null);
}

export function summarise(events: Earthquake[], now: number) {
  const pt = events.filter(isPt);
  const last30 = within(pt, now, 30);
  const counts = Object.fromEntries(REGIONS.map((r) => [r, last30.filter((q) => q.region === r).length])) as Record<PtRegion, number>;

  return {
    latest: pt[0] ?? null,
    last7: within(pt, now, 7).length,
    felt30: last30.filter((q) => q.felt).length,
    largest30: largest(last30),
    counts,
  };
}

export function regionSummary(events: Earthquake[], region: PtRegion, now: number) {
  const qs = within(events.filter((q) => q.region === region), now, 30);
  return { events: qs, largest: largest(qs), felt: qs.filter((q) => q.felt).length };
}

/** Compact rows for the client scripts (seismogram, maps). */
export interface Row {
  t: number; lat: number; lon: number; d: number | null; m: number | null; r: string; p: string | null; felt: boolean;
  /** Page of the earthquake, when it has one. */
  u: string | null;
}

export const toRows = (events: Earthquake[]): Row[] =>
  events.map((q) => ({ t: t(q), lat: q.lat, lon: q.lon, d: q.depth, m: q.magnitude, r: q.region, p: q.place, felt: q.felt, u: quakeUrl(q) }));
