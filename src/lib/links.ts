import type { Earthquake } from './types';

/** Only fogosapi earthquakes have a page; fallback rows (ipma-…, emsc-…) do not. */
export const hasPage = (q: Pick<Earthquake, 'id'>) => /^[a-f0-9]{24}$/.test(q.id);

export const quakePath = (q: Pick<Earthquake, 'id' | 'slug'>) => `/sismo/${q.id}${q.slug ? '-' + q.slug : ''}`;

export const quakeUrl = (q: Pick<Earthquake, 'id' | 'slug'>) => (hasPage(q as Earthquake) ? quakePath(q) : null);

/** "/sismo/<24 hex>-<slug>" → id and slug. */
export function parseQuakeRef(ref: string): { id: string; slug: string } | null {
  const m = ref.match(/^([a-f0-9]{24})(?:-(.*))?$/);
  return m ? { id: m[1], slug: m[2] ?? '' } : null;
}
