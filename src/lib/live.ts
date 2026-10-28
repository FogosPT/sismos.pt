import { classify, inBbox } from './region';
import type { Row } from './summary';

/**
 * Pure helpers for the realtime layer (src/scripts/live.ts): EMSC WebSocket
 * messages → rows, and the same "is this the same earthquake?" rule the
 * fogosapi merger uses, so an EMSC report of an event we already show is not
 * announced twice.
 */

export const EMSC_WS = 'wss://www.seismicportal.eu/standing_order/websocket';

/** Same-event tolerance (a little wider than fogosapi's 10 s / 30 km: EMSC's first solution moves). */
export const SAME_SECONDS = 15;
export const SAME_KM = 50;

export interface EmscMessage {
  action?: string;
  data?: { id?: string; properties?: Record<string, any>; geometry?: { coordinates?: number[] } };
}

/** An EMSC realtime message as a preliminary row, or null if it is not a Portuguese earthquake. */
export function rowFromEmsc(msg: EmscMessage): Row | null {
  if (msg?.action !== 'create' && msg?.action !== 'update') return null;
  const p = msg.data?.properties;
  if (!p) return null;

  const lat = Number(p.lat ?? msg.data?.geometry?.coordinates?.[1]);
  const lon = Number(p.lon ?? msg.data?.geometry?.coordinates?.[0]);
  const t = Date.parse(p.time);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(t) || !inBbox(lat, lon)) return null;
  if (p.evtype && !['ke', 'se'].includes(p.evtype)) return null;

  const r = classify(lat, lon);
  if (r === 'outro') return null;

  const depth = Number(p.depth);
  const mag = Number(p.mag);
  return {
    id: `emsc-${p.unid ?? msg.data?.id}`,
    t,
    lat,
    lon,
    d: Number.isFinite(depth) ? Math.abs(depth) : null,
    m: Number.isFinite(mag) ? mag : null,
    r,
    p: p.flynn_region ?? null,
    felt: false,
    u: null, // no page until fogosapi has it
    prelim: true,
  };
}

export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function sameEvent(a: Row, b: Row): boolean {
  return a.id === b.id || (Math.abs(a.t - b.t) <= SAME_SECONDS * 1000 && distanceKm(a, b) <= SAME_KM);
}

/** Rows of `incoming` that are not already in `known`. */
export function unseen(known: Row[], incoming: Row[]): Row[] {
  return incoming.filter((q) => !known.some((k) => sameEvent(k, q)));
}

/**
 * Authoritative rows (from fogosapi) plus the preliminary EMSC rows that
 * fogosapi does not have yet; a preliminary row disappears as soon as the
 * same earthquake arrives from fogosapi.
 */
export function mergeRows(authoritative: Row[], prelim: Row[]): Row[] {
  const pending = prelim.filter((p) => !authoritative.some((a) => sameEvent(a, p)));
  return [...pending, ...authoritative].sort((a, b) => b.t - a.t);
}
