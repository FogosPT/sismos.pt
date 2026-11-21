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

const SITE_HOST = 'sismos.pt';

/** Whether `href` points to another site (absolute or protocol-relative URL). */
export function isExternal(href: string, host = SITE_HOST): boolean {
  if (!/^(https?:)?\/\//i.test(href)) return false;
  try {
    const h = new URL(href, `https://${host}`).hostname;
    return h !== host && !h.endsWith(`.${host}`);
  } catch {
    return false;
  }
}

/** Adds target="_blank" (and rel="noopener noreferrer") to every external <a> that has no target. */
export function externalLinksInNewTab(html: string, host = SITE_HOST): string {
  return html.replace(/<a\b[^>]*>/gi, (tag) => {
    const m = tag.match(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const href = m?.[1] ?? m?.[2];
    if (!href || !isExternal(href.replace(/&amp;/g, '&'), host) || /\starget\s*=/i.test(tag)) return tag;
    return `${tag.slice(0, -1)} target="_blank"${/\srel\s*=/i.test(tag) ? '' : ' rel="noopener noreferrer"'}>`;
  });
}
