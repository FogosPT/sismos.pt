import type { Earthquake } from '../types';
import { fetchJson } from './http';

/**
 * IPMA seismology communiqués, through the VOST archive
 * (https://comunicados-ipma.vost.pt). IPMA's open-data feed is regenerated
 * once an hour; the automatic "Aviso de Sismo" usually comes out 5–10 min
 * after the origin, so communiqués are the fastest official word.
 *
 * Quirks:
 * - The title carries the origin as "dd-mm-yyyy hh:mm" in *local* time of the
 *   region (minute precision); the zone comes from the title or the network.
 * - IPMA's "Data de Edição" is UTC. The archive's `pubDate` reads it as Lisbon
 *   time (1 h early in summer), so the edition date is preferred.
 * - One archive id can hold different earthquakes of the same day as
 *   successive versions, so matching is done per version.
 */
export const COMUNICADOS_BASE = 'https://comunicados-ipma.vost.pt';

export interface Comunicado {
  id: string;
  version: number;
  title: string;
  /** Origin as written in the title, local wall clock "YYYY-MM-DDTHH:MM". */
  local: string;
  /** Candidate time zones of `local` (one when the region is known). */
  zones: string[];
  /** When IPMA issued it (UTC ISO). */
  published: string;
  /** "Aviso de Sismo Sentido": a follow-up with felt reports. */
  felt: boolean;
  magnitude: number | null;
  /** Informative paragraphs, without IPMA's boilerplate; null when not fetched. */
  text: string | null;
  /** Permalink in the archive. */
  url: string;
}

interface ApiItem {
  id: string;
  category: string;
  title: string;
  pubDate: string;
  versionCount: number;
}

interface ApiVersion {
  versionNumber: number;
  title: string;
  pubDate: string;
  bodyText: string | null;
  descriptionHtml: string | null;
}

const ZONES = ['Europe/Lisbon', 'Atlantic/Azores', 'Atlantic/Madeira'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Zone offset (ms, local − UTC) at instant `t`. */
export function zoneOffset(zone: string, t: number): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(t)
      .map((x) => [x.type, x.value]),
  );
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(t / 1000) * 1000;
}

/** Local wall clock of `t` in `zone`, as ms since the epoch read as UTC. */
const wall = (t: number, zone: string) => t + zoneOffset(zone, t);

function zonesOf(title: string, body: string): string[] {
  for (const s of [title, body]) {
    if (/A[çc]ores/i.test(s)) return ['Atlantic/Azores'];
    if (/Madeira/i.test(s)) return ['Atlantic/Madeira'];
    if (/Continente/i.test(s)) return ['Europe/Lisbon'];
  }
  return ZONES;
}

/** "Data de Edição: Sex, 20 Nov 2026 18:33:24" (UTC) → ISO. */
export function editionDate(html: string | null): string | null {
  const m = html?.match(/Data de Edi[çc][ãa]o:\s*(?:<[^>]+>\s*)*[^\d<]*(\d{1,2})\s+(\w{3})\w*\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/i);
  if (!m) return null;
  const mon = MONTHS.indexOf(m[2].toLowerCase());
  if (mon < 0) return null;
  return new Date(Date.UTC(+m[3], mon, +m[1], +m[4], +m[5], +m[6])).toISOString();
}

/** The archive's pubDate is IPMA's UTC edition read as Lisbon time: undo it. */
export const fixPubDate = (iso: string) => {
  const t = Date.parse(iso);
  return new Date(t + zoneOffset('Europe/Lisbon', t)).toISOString();
};

/** Body without the repeated title and IPMA's standard disclaimer. */
export function cleanText(body: string | null): string | null {
  if (!body) return null;
  let s = body.replace(/\s+/g, ' ').trim();
  const start = s.indexOf('O Instituto');
  if (start > 0) s = s.slice(start);
  const end = s.search(/A localização do epicentro|Toda e qualquer utilização/);
  if (end > 0) s = s.slice(0, end);
  return s.trim() || null;
}

/** One version of a communiqué; null when it is not about an earthquake. */
export function parseVersion(id: string, v: Pick<ApiVersion, 'versionNumber' | 'title' | 'pubDate'> & Partial<ApiVersion>): Comunicado | null {
  const title = v.title.replace(/\s+/g, ' ').trim();
  if (!/sismo/i.test(title)) return null;
  const body = v.bodyText ?? '';
  const m = `${title} ${body}`.match(/(\d{2})-(\d{2})-(\d{4})\s+(?:pelas\s+)?(\d{2}):(\d{2})/);
  if (!m) return null;
  const mag = body.match(/magnitude\s+(\d+(?:[.,]\d+)?)/i);
  return {
    id,
    version: v.versionNumber,
    title,
    local: `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}`,
    zones: zonesOf(title, body),
    published: editionDate(v.descriptionHtml ?? null) ?? fixPubDate(v.pubDate),
    felt: /sentido/i.test(title),
    magnitude: mag ? parseFloat(mag[1].replace(',', '.')) : null,
    text: cleanText(v.bodyText ?? null),
    url: `${COMUNICADOS_BASE}/c/${id}/v/${v.versionNumber}`,
  };
}

/** Origin is within this of the communiqué's minute (it may round or truncate). */
export const MATCH_SECONDS = 120;
/** Communiqué magnitude (Richter, preliminary) vs the catalogue's. */
export const MATCH_MAGNITUDE = 0.8;

/** Seconds between the earthquake and the communiqué's origin; null when they do not match. */
export function matchScore(c: Comunicado, q: Pick<Earthquake, 'time' | 'magnitude'>): number | null {
  if (c.magnitude != null && q.magnitude != null && Math.abs(c.magnitude - q.magnitude) > MATCH_MAGNITUDE) return null;
  const t = Date.parse(q.time);
  const minute = Date.parse(`${c.local}:00Z`);
  let best: number | null = null;
  for (const zone of c.zones) {
    const w = wall(t, zone);
    // A minute stamp covers [hh:mm, hh:mm+1): distance to that interval.
    const d = w < minute ? minute - w : Math.max(0, w - (minute + 6e4));
    if (d <= MATCH_SECONDS * 1000 && (best == null || d < best)) best = d;
  }
  return best == null ? null : best / 1000;
}

/** Each communiqué goes to its closest earthquake. Result is keyed by earthquake id, oldest communiqué first. */
export function assign(cs: Comunicado[], quakes: Pick<Earthquake, 'id' | 'time' | 'magnitude'>[]): Map<string, Comunicado[]> {
  const out = new Map<string, Comunicado[]>();
  for (const c of cs) {
    let best: string | null = null;
    let score = Infinity;
    for (const q of quakes) {
      const s = matchScore(c, q);
      if (s != null && s < score) {
        best = q.id;
        score = s;
      }
    }
    if (best) out.set(best, [...(out.get(best) ?? []), c]);
  }
  for (const list of out.values()) list.sort((a, b) => Date.parse(a.published) - Date.parse(b.published));
  return out;
}

async function list(params: Record<string, string>): Promise<ApiItem[]> {
  const qs = new URLSearchParams({ category: 'sismologia', ...params });
  const json = await fetchJson<{ items: ApiItem[] }>(`${COMUNICADOS_BASE}/api/comunicados?${qs}`, {}, 6000);
  if (!Array.isArray(json?.items)) throw new Error('comunicados: unexpected payload');
  return json.items;
}

async function versions(id: string): Promise<Comunicado[]> {
  const json = await fetchJson<{ versions: ApiVersion[] }>(`${COMUNICADOS_BASE}/api/comunicados/${encodeURIComponent(id)}`, {}, 6000);
  return (json?.versions ?? []).map((v) => parseVersion(id, v)).filter((c): c is Comunicado => c !== null);
}

/**
 * Communiqués published in [from, to]. Single-version ones come from the list
 * (title and date only, no text) unless `detail` asks for them; ids with
 * several versions are always fetched, since older versions may be other
 * earthquakes.
 */
export async function comunicados(from: Date, to: Date | null, detail: (c: Comunicado) => boolean = () => false, limit = 100): Promise<Comunicado[]> {
  const items = (await list({ limit: String(limit), ...(to ? { before: to.toISOString() } : {}) })).filter((i) => Date.parse(i.pubDate) >= from.getTime() - 36e5);
  const out = await Promise.all(
    items.map(async (i) => {
      const c = parseVersion(i.id, { versionNumber: i.versionCount, title: i.title, pubDate: i.pubDate });
      if (i.versionCount > 1 || (c && detail(c))) return versions(i.id);
      return c ? [c] : [];
    }),
  );
  return out.flat();
}
