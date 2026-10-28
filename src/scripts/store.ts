import type { Row } from '../lib/summary';
import { readRows } from './ui';

/**
 * The rows the page draws (seismogram, maps), newest first. Starts from the
 * JSON the server embedded; live.ts replaces it when new earthquakes arrive
 * and every drawing re-renders through onRows().
 */
const initial = readRows('quakes-data');

export const store: { now: number; rows: Row[] } = { now: initial.now, rows: initial.rows };

const listeners = new Set<() => void>();

export function onRows(fn: () => void) {
  listeners.add(fn);
}

export function setRows(rows: Row[], now = Date.now()) {
  store.rows = rows.slice().sort((a, b) => b.t - a.t);
  store.now = now;
  listeners.forEach((fn) => fn());
}
