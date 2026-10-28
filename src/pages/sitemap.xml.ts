import type { APIRoute } from 'astro';
import { edgeCached } from '../lib/cache';
import { fogosOptions } from '../lib/catalogue';
import { workerEnv } from '../lib/env';
import { fogosSitemap } from '../lib/sources/fogos';

/** Earthquakes below this magnitude get pages but are not indexed (thin content). */
export const SITEMAP_MIN_MAGNITUDE = 2;

/** Sitemap index: static pages + one file per 5000 earthquakes. */
export const GET: APIRoute = async ({ site }) => {
  let pages: number;
  try {
    const first = await edgeCached(`sitemap/1`, 3600, () => fogosSitemap(1, SITEMAP_MIN_MAGNITUDE, fogosOptions(workerEnv)));
    pages = first.pages;
  } catch (e) {
    // Never publish an index without the earthquake sitemaps: crawlers would
    // treat them as removed. A 503 tells them to come back later.
    console.warn('[sitemap] fogosapi unavailable:', (e as Error).message);
    return new Response(null, { status: 503, headers: { 'Retry-After': '600', 'Cache-Control': 'no-store' } });
  }

  const urls = [new URL('/sitemap-paginas.xml', site).href, ...Array.from({ length: pages }, (_, i) => new URL(`/sitemap-sismos-${i + 1}.xml`, site).href)];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <sitemap><loc>${u}</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
