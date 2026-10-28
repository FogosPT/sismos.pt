import type { APIRoute } from 'astro';
import { edgeCached } from '../lib/cache';
import { fogosOptions } from '../lib/catalogue';
import { workerEnv } from '../lib/env';
import { quakePath } from '../lib/links';
import { fogosSitemap } from '../lib/sources/fogos';
import { SITEMAP_MIN_MAGNITUDE } from './sitemap.xml';

export const GET: APIRoute = async ({ params, site }) => {
  const n = Number(params.n);
  if (!Number.isInteger(n) || n < 1) return new Response(null, { status: 404 });

  let page;
  try {
    page = await edgeCached(`sitemap/${n}`, 3600, () => fogosSitemap(n, SITEMAP_MIN_MAGNITUDE, fogosOptions(workerEnv)));
  } catch {
    return new Response(null, { status: 503, headers: { 'Retry-After': '600' } });
  }
  if (!page.data.length) return new Response(null, { status: 404 });

  const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${page.data
    .map((q) => `  <url><loc>${xml(new URL(quakePath(q), site).href)}</loc><lastmod>${q.updated}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
