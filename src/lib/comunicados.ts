import { edgeCached } from './cache';
import { comunicados, matchScore, type Comunicado } from './sources/comunicados';
import type { Earthquake } from './types';

/** Optional extra: when the archive is down the pages just go without it. */
async function safe(load: () => Promise<Comunicado[]>): Promise<{ ok: boolean; items: Comunicado[] }> {
  try {
    return { ok: true, items: await load() };
  } catch (e) {
    console.warn('[comunicados]', (e as Error).message);
    return { ok: false, items: [] };
  }
}

/** IPMA communiqués of the last `days` days (titles only), edge-cached. */
export async function recentComunicados(days = 30): Promise<Comunicado[]> {
  const v = await edgeCached(`comunicados/recent/${days}`, 300, () => safe(() => comunicados(new Date(Date.now() - days * 864e5), null)), (x) => x.ok);
  return v.items;
}

/** Communiqués issued around one earthquake (up to a week later), with their text. */
export async function comunicadosFor(q: Pick<Earthquake, 'id' | 'time' | 'magnitude'>): Promise<Comunicado[]> {
  const t = Date.parse(q.time);
  const settled = Date.now() - t > 7 * 864e5;
  const v = await edgeCached(
    `comunicados/sismo/${q.id}`,
    settled ? 86400 : 300,
    () => safe(() => comunicados(new Date(t), new Date(t + 7 * 864e5), (c) => matchScore(c, q) != null, 40)),
    (x) => x.ok,
  );
  return v.items;
}
