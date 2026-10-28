import { TIMEZONE } from './region';
import type { Earthquake, Region } from './types';

const DIR: Record<string, string> = {
  N: 'norte', S: 'sul', E: 'este', W: 'oeste', NE: 'nordeste', NW: 'noroeste', SE: 'sudeste', SW: 'sudoeste',
  NNE: 'nor-nordeste', NNW: 'nor-noroeste', ENE: 'lés-nordeste', ESE: 'lés-sudeste', SSE: 'su-sudeste',
  SSW: 'su-sudoeste', WNW: 'oés-noroeste', WSW: 'oés-sudoeste',
};

export const ms = (q: Pick<Earthquake, 'time'>) => Date.parse(q.time);

export function num(x: number, digits = 1): string {
  return x.toLocaleString('pt-PT', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export const fmtMag = (m: number | null) => (m == null ? '—' : num(m, 1));

/** "MW" → "Mw" style is not needed: fogosapi already normalises to "ML", "MW"… */
export const magTypeLabel = (t: string | null) => (t ? t : 'M');

function dt(t: number, r: Region, o: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: TIMEZONE[r], ...o }).format(t);
}

export const hm = (t: number, r: Region) => dt(t, r, { hour: '2-digit', minute: '2-digit' });
export const dayMonth = (t: number, r: Region) => dt(t, r, { day: 'numeric', month: 'short' }).replace('.', '');
export const hourOf = (t: number, r: Region) => +dt(t, r, { hour: '2-digit', hourCycle: 'h23' });
export const utcHm = (t: number) => new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' }).format(t);
export const longDate = (t: number, r: Region) => dt(t, r, { day: 'numeric', month: 'long', year: 'numeric' });

export function relative(t: number, now: number): string {
  const min = Math.floor((now - t) / 6e4);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} minuto${min === 1 ? '' : 's'}`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} hora${h === 1 ? '' : 's'}`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d === 1 ? '' : 's'}`;
}

export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** IPMA "NE Bragança" → "A nordeste de Bragança". */
export function placeName(p: string | null): string {
  if (!p) return 'Local por determinar';
  const s = p.replace('(ESP)', '(Espanha)').replace(/\s+/g, ' ').trim();
  const m = s.match(/^([NSEW]{1,3})\s+(.+)$/);
  return m && DIR[m[1]] ? `A ${DIR[m[1]]} de ${m[2]}` : s;
}

/** IPMA "S.Miguel: Ginetes (Ponta Delgada)" → "S. Miguel, Ginetes (Ponta Delgada)". */
export const feltLocal = (s: string | null) => (s ? s.replace(/\s*:\s*/, ', ').replace(/\.(?=\S)/g, '. ') : '');

/** 0 km in IPMA/EMSC means a fixed, undetermined depth. */
export const depthKnown = (d: number | null): d is number => d != null && d > 0;
export const depthShort = (d: number | null) => (depthKnown(d) ? `${num(d, 0)} km` : 'prof. n/d');
export const depthLong = (d: number | null) => (depthKnown(d) ? `${num(d, 0)} km` : 'não determinada');

/** Marker radius in px. */
export const radius = (m: number | null) => 2.5 * Math.pow(1.75, m == null ? 1 : m);

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export const SOURCE_NAME: Record<string, string> = {
  fogos: 'sismos.pt', ipma: 'IPMA', emsc: 'EMSC', usgs: 'USGS', geofon: 'GFZ', ign: 'IGN', isc: 'ISC',
};
